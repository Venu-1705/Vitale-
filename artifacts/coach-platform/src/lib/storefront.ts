/**
 * D12 Commerce / Storefront data layer (MERCHANT side) for the coach platform.
 *
 * The customer storefront lives in the mobile app (lib/commerce). This module is
 * the merchant/management surface: orders + fulfilment, REAL revenue, and catalog
 * CRUD (products / variants / banners / coach recommendations). Authorization is
 * the backend's: catalog writes need `manage_products`; order reads/fulfilment
 * need `view_revenue` / `manage_products` (RLS by org membership).
 *
 * Casing: merchant bodies + queries are camelCase (`organizationId`, `pricePaise`,
 * `gatewayProvider`). Merchant order list returns a raw array; revenue returns an
 * object; the shop catalog returns `{ products, total, page, … }`.
 *
 * DOCUMENTED GAPS (verified absent from merchant.ts / shop.ts):
 *   • No merchant product-LIST endpoint. The only product read is the buyer
 *     catalog (`/shop/categories/:slug/products`), which is platform-wide and
 *     ACTIVE-ONLY. We filter client-side to the caller's org, so DRAFT/INACTIVE
 *     products are not listable here.
 *   • No list endpoints for banners/recommendations beyond the curated
 *     `/shop/home` payload; we read them from there.
 *   • Payment capture itself is D8-deferred — `confirmOrderPayment` is the
 *     gateway-NEUTRAL merchant confirm, not a payment flow.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

// ── Enums ───────────────────────────────────────────────────────────────────
export type OrderStatus =
  | "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled" | "refunded";
export const FULFILLABLE_STATUSES: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

// ── DTOs (camelized) ────────────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  pricePaise: number;
  mrpPaise: number;
  stockQty: number;
  weightG: number | null;
  attributes: Record<string, string>;
  isActive: boolean;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  brand: string | null;
  images: string[];
  tags: string[];
  benefits: string[];
  isActive: boolean;
  isFeatured: boolean;
  isBestseller: boolean;
  isNewInStore: boolean;
  hsnCode: string | null;
  gstRate: number;
  avgRating: number;
  reviewCount: number;
  variants?: ProductVariant[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Banner {
  id: string;
  organizationId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  bgColor: string;
  link: string | null;
  sortOrder: number;
  isActive: boolean;
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
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  organizationId: string;
  status: OrderStatus;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  gstPaise: number;
  totalPaise: number;
  gatewayProvider: string | null;
  gatewayPaymentId: string | null;
  couponCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  events: OrderEvent[];
}

export interface RevenueSummary {
  revenuePaise: number;
  gstCollectedPaise: number;
  revenueOrders: number;
}
export interface RevenueByStatusRow {
  status: OrderStatus;
  orders: number;
  totalPaise: number;
  gstPaise: number;
}
export interface MerchantRevenue {
  revenue: RevenueSummary;
  countedStatuses: OrderStatus[];
  byStatus: RevenueByStatusRow[];
}

interface CatalogEnvelope { products: Product[]; total: number; page: number }
interface ShopHome { banners: Banner[]; categories: ProductCategory[]; bestsellers: Product[]; offers: Product[]; newInStore: Product[]; featured: Product | null }

// ── Query keys ──────────────────────────────────────────────────────────────
export const storefrontKeys = {
  home: ["shop-home"] as const,
  products: (orgId: string) => ["storefront-products", orgId] as const,
  orders: (filter?: string) => (filter ? ["merchant-orders", filter] : ["merchant-orders"]) as readonly unknown[],
  order: (id: string) => ["merchant-order", id] as const,
  revenue: (orgId: string) => ["merchant-revenue", orgId] as const,
};

// ── Catalog reads ───────────────────────────────────────────────────────────
export function useShopHome(options?: Partial<UseQueryOptions<ShopHome>>) {
  return useQuery({
    queryKey: storefrontKeys.home,
    queryFn: () => apiGet<ShopHome>("/shop/home"),
    staleTime: 60_000,
    ...options,
  });
}

/**
 * The org's products — read from the buyer catalog (active-only, platform-wide)
 * filtered client-side to `organizationId`. Drafts/inactive are NOT returned
 * (no merchant list endpoint — documented gap).
 */
export function useStorefrontProducts(organizationId: string | undefined, options?: Partial<UseQueryOptions<Product[]>>) {
  return useQuery({
    queryKey: storefrontKeys.products(organizationId ?? "unknown"),
    queryFn: async () => {
      const res = await apiGet<CatalogEnvelope>("/shop/categories/all/products?limit=100");
      return res.products.filter((p) => p.organizationId === organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30_000,
    ...options,
  });
}

// ── Merchant orders + revenue ───────────────────────────────────────────────
export interface MerchantOrdersParams { organizationId?: string; status?: OrderStatus; page?: number; limit?: number }

function ordersQuery(params: MerchantOrdersParams): string {
  const q = new URLSearchParams();
  if (params.organizationId) q.set("organizationId", params.organizationId);
  if (params.status) q.set("status", params.status);
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function useMerchantOrders(params: MerchantOrdersParams = {}, options?: Partial<UseQueryOptions<Order[]>>) {
  const key = ordersQuery(params);
  return useQuery({
    queryKey: storefrontKeys.orders(key),
    queryFn: () => apiGet<Order[]>(`/merchant/orders${key}`),
    staleTime: 20_000,
    ...options,
  });
}

export function useMerchantOrder(id: string | undefined, options?: Partial<UseQueryOptions<OrderDetail>>) {
  return useQuery({
    queryKey: storefrontKeys.order(id ?? "unknown"),
    queryFn: () => apiGet<OrderDetail>(`/merchant/orders/${id}`),
    enabled: !!id,
    staleTime: 20_000,
    ...options,
  });
}

export function useMerchantRevenue(organizationId: string | undefined, options?: Partial<UseQueryOptions<MerchantRevenue>>) {
  return useQuery({
    queryKey: storefrontKeys.revenue(organizationId ?? "unknown"),
    queryFn: () => apiGet<MerchantRevenue>(`/merchant/revenue?organizationId=${organizationId}`),
    enabled: !!organizationId,
    staleTime: 30_000,
    ...options,
  });
}

export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      apiPost(`/merchant/orders/${id}/advance`, { status, ...(note ? { note } : {}) }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: storefrontKeys.orders() });
      qc.invalidateQueries({ queryKey: storefrontKeys.order(id) });
    },
  });
}

/** Gateway-neutral merchant confirm (NOT a payment capture — D8 deferred). */
export function useConfirmOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, gatewayProvider, gatewayOrderId, gatewayPaymentId }: { id: string; gatewayProvider: string; gatewayOrderId: string; gatewayPaymentId: string }) =>
      apiPost(`/merchant/orders/${id}/confirm-payment`, { gatewayProvider, gatewayOrderId, gatewayPaymentId }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: storefrontKeys.orders() });
      qc.invalidateQueries({ queryKey: storefrontKeys.order(id) });
    },
  });
}

// ── Catalog writes (manage_products) ────────────────────────────────────────
export interface ProductInput {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  categoryId: string;
  brand?: string;
  images?: string[];
  tags?: string[];
  benefits?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNewInStore?: boolean;
  hsnCode?: string;
  gstRate?: number;
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) => apiPost<Product>("/merchant/products", body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: storefrontKeys.products(vars.organizationId) }),
  });
}

export function useUpdateProduct(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ProductInput> & { id: string }) => apiPatch<Product>(`/merchant/products/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: storefrontKeys.products(organizationId) }),
  });
}

export function useDeleteProduct(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/merchant/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: storefrontKeys.products(organizationId) }),
  });
}

export interface VariantInput {
  productId: string;
  name: string;
  sku: string;
  pricePaise: number;
  mrpPaise: number;
  stockQty?: number;
  weightG?: number;
  attributes?: Record<string, string>;
  isActive?: boolean;
}
export function useCreateVariant(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VariantInput) => apiPost<ProductVariant>("/merchant/variants", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: storefrontKeys.products(organizationId) }),
  });
}

export interface BannerInput {
  organizationId: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  bgColor?: string;
  link?: string;
  sortOrder?: number;
  isActive?: boolean;
}
export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BannerInput) => apiPost<Banner>("/merchant/banners", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: storefrontKeys.home }),
  });
}
export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/merchant/banners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: storefrontKeys.home }),
  });
}

// ── Display helpers (no fabricated data) ────────────────────────────────────
export function rupeesFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
