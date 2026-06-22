/**
 * D12 commerce data layer for the storefront.
 *
 * One module owns every commerce contract the app talks to — addresses,
 * checkout, orders, invoices — expressed as React Query hooks over the typed
 * `lib/api` transport (identity headers + snake→camel normalization happen
 * there, not here). The cart itself lives in `context/CartContext` so the
 * existing `useCart()` surface stays stable, but it shares the query keys
 * defined here so checkout/cancel invalidations line up.
 *
 * Types mirror the *camelized* backend payloads (the server is uniformly
 * snake_case; `apiRequest` rewrites keys before they reach these hooks), so a
 * field like `total_paise` is read as `totalPaise`.
 */
import { Platform } from "react-native";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiGetBlob, apiPatch, apiPost } from "./api";

// ── Shared query keys ──────────────────────────────────────────────────────
// Centralized so mutations elsewhere (checkout, cancel, the cart context)
// invalidate exactly the queries these hooks register.
export const commerceKeys = {
  cart: ["cart"] as const,
  addresses: ["addresses"] as const,
  orders: (filter?: string) =>
    (filter ? ["orders", filter] : ["orders"]) as readonly unknown[],
  order: (id: string) => ["order", id] as const,
  invoices: ["invoices"] as const,
};

// ── DTOs (camelized) ────────────────────────────────────────────────────────

export interface ServerCartItem {
  id: string;
  qty: number;
  productId: string;
  variantId: string;
  productName: string;
  productImages: string[] | null;
  productGstRate: number;
  organizationId: string;
  variantName: string;
  pricePaise: number;
  mrpPaise: number;
  stockQty: number;
}

export interface ServerCart {
  cartId: string;
  items: ServerCartItem[];
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AddressInput {
  label?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  qty: number;
  pricePaise: number;
  gstRate: number;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  organizationId: string;
  invoiceNumber: string;
  sellerSnapshot: Record<string, unknown> | null;
  buyerSnapshot: Record<string, unknown> | null;
  totalPaise: number;
  pdfUrl: string | null;
  issuedAt: string;
}

export interface InvoiceListItem extends Invoice {
  orderStatus: string;
  orderCreatedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  organizationId: string;
  addressId: string | null;
  status: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  gstPaise: number;
  totalPaise: number;
  gatewayProvider: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  couponCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events?: OrderEvent[];
  invoice?: Invoice | null;
}

/** One element of the `rpc_checkout` result — a per-merchant order summary. */
export interface CheckoutOrder {
  orderId: string;
  organizationId: string;
  itemCount: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  status: string;
}

/** A reorder line — only enough to re-add the variant to the cart. */
export interface ReorderItem {
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  qty: number;
}

// ── Addresses ───────────────────────────────────────────────────────────────

export function useAddresses() {
  return useQuery({
    queryKey: commerceKeys.addresses,
    queryFn: () => apiGet<Address[]>("/addresses"),
    staleTime: 60_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddressInput) => apiPost<Address>("/addresses", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AddressInput> }) =>
      apiPatch<Address>(`/addresses/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: true }>(`/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * Place order(s) from the caller's server cart. The ONLY input is the delivery
 * address — `rpc_checkout` is server-authoritative (prices, GST, per-merchant
 * split, stock locking, cart emptying). Returns the array of created orders.
 */
export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addressId: string | null) => {
      const { orders } = await apiPost<{ orders: CheckoutOrder[] }>(
        "/orders/checkout",
        { addressId },
      );
      return orders;
    },
    onSuccess: () => {
      // Cart is emptied server-side; orders list now has new rows.
      qc.invalidateQueries({ queryKey: commerceKeys.cart });
      qc.invalidateQueries({ queryKey: commerceKeys.orders() });
    },
  });
}

// ── Payments (Cashfree) ──────────────────────────────────────────────────────

/** The session a Cashfree order yields — fed to the checkout SDK/WebView. */
export interface CashfreeOrderSession {
  /** Our shop_orders.id (also the Cashfree order_id). */
  orderId: string;
  /** The Cashfree payment_session_id the checkout SDK renders against. */
  paymentSessionId: string;
}

/**
 * Create a Cashfree order for a pending shop order. The amount + customer identity
 * are taken server-side from the order (never trusted from the client). `returnUrl`
 * is the deep-link/sentinel the hosted checkout returns to so the WebView can detect
 * completion.
 */
export async function createCashfreeOrder(
  orderId: string,
  returnUrl?: string,
): Promise<CashfreeOrderSession> {
  return apiPost<CashfreeOrderSession>("/shop/cashfree/order", {
    orderId,
    ...(returnUrl ? { returnUrl } : {}),
  });
}

/** The order's payment status — local truth + authoritative gateway status. */
export interface OrderPaymentStatus {
  orderId: string;
  /** Our order status: pending | confirmed | … */
  localStatus: string;
  /** Cashfree status: ACTIVE | PAID | EXPIRED | … (null when gateway unconfigured). */
  gatewayStatus: string | null;
}

/** Poll the authoritative payment status for an order (post-checkout). */
export async function getOrderPaymentStatus(orderId: string): Promise<OrderPaymentStatus> {
  return apiGet<OrderPaymentStatus>(`/shop/orders/${orderId}/status`);
}

// ── Orders ──────────────────────────────────────────────────────────────────

export function useOrders(filter?: string) {
  return useQuery({
    queryKey: commerceKeys.orders(filter),
    queryFn: () =>
      apiGet<Order[]>(
        filter ? `/orders?status=${encodeURIComponent(filter)}` : "/orders",
      ),
    staleTime: 30_000,
  });
}

export function useOrder(
  id: string | undefined,
  options?: Partial<UseQueryOptions<Order>>,
) {
  return useQuery({
    queryKey: commerceKeys.order(id ?? "unknown"),
    queryFn: () => apiGet<Order>(`/orders/${id}`),
    enabled: !!id,
    refetchInterval: 15_000,
    ...options,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiPost<Order>(`/orders/${id}/cancel`, note ? { note } : {}),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: commerceKeys.order(id) });
      qc.invalidateQueries({ queryKey: commerceKeys.orders() });
    },
  });
}

export function useReorder() {
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ items: ReorderItem[]; message: string }>(
        `/orders/${id}/reorder`,
      ),
  });
}

// ── Invoices ────────────────────────────────────────────────────────────────

export function useInvoices() {
  return useQuery({
    queryKey: commerceKeys.invoices,
    queryFn: () => apiGet<InvoiceListItem[]>("/invoices"),
    staleTime: 60_000,
  });
}

/**
 * Fetch an order's invoice PDF through the authenticated transport (so the
 * identity header is carried — a bare `fetch` to the URL would 401). On web the
 * blob is saved via an object URL; native file-save needs expo-file-system +
 * expo-sharing (not yet a dependency), so the caller surfaces a notice there.
 *
 * @returns `true` if the PDF was downloaded (web), `false` if it was only
 *          fetched/validated (native).
 */
export async function downloadInvoicePdf(orderId: string): Promise<boolean> {
  const blob = await apiGetBlob(`/orders/${orderId}/invoice.pdf`);

  if (Platform.OS === "web") {
    const g = globalThis as unknown as {
      URL?: { createObjectURL(b: Blob): string; revokeObjectURL(u: string): void };
      document?: any;
    };
    if (g.URL && g.document) {
      const url = g.URL.createObjectURL(blob);
      const a = g.document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId.slice(-8).toUpperCase()}.pdf`;
      g.document.body.appendChild(a);
      a.click();
      a.remove();
      g.URL.revokeObjectURL(url);
      return true;
    }
  }
  return false;
}
