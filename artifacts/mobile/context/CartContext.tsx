/**
 * Server-backed cart.
 *
 * Previously the cart lived in AsyncStorage and never touched the backend — so
 * checkout, pricing, and stock were all client fictions. It now mirrors the D12
 * `/cart` endpoints (one server cart per user, hydrated line items) behind the
 * *same* `useCart()` surface the screens already consume, so no caller changed:
 *
 *   GET    /cart            → source of truth (React Query, key `["cart"]`)
 *   POST   /cart            → addItem (server bumps qty for an existing variant)
 *   PATCH  /cart/:itemId    → updateQty (qty<=0 deletes the line)
 *   DELETE /cart/:itemId    → removeItem / clearCart (no bulk-clear endpoint)
 *
 * Mutations apply optimistic updates to the cached cart for snappy steppers and
 * roll back on error, then revalidate against the server. Totals are derived
 * client-side with the *same* per-line GST rounding the checkout RPC uses, so
 * the displayed total matches what the backend will charge.
 */
import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPatch, apiPost, apiGet } from "@/lib/api";
import {
  commerceKeys,
  type ServerCart,
  type ServerCartItem,
} from "@/lib/commerce";

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  pricePaise: number;
  mrpPaise: number;
  imageUrl: string;
  qty: number;
  stockQty: number;
  gstRate: number;
  organizationId: string;
}

/**
 * What `addItem` accepts. Only `productId`/`variantId`/`qty` are sent to the
 * server (which derives the rest); the remaining fields, when supplied, drive
 * the optimistic insert so the UI updates before the refetch lands.
 */
export interface AddItemInput {
  productId: string;
  variantId: string;
  qty?: number;
  name?: string;
  variantName?: string;
  pricePaise?: number;
  mrpPaise?: number;
  imageUrl?: string;
  stockQty?: number;
  gstRate?: number;
  organizationId?: string;
  /** Accepted for backwards-compat with old callers; ignored. */
  id?: string;
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  addItem: (item: AddItemInput) => void;
  removeItem: (itemId: string) => void;
  updateQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  getItemByVariant: (variantId: string) => CartItem | undefined;
}

const CartContext = createContext<CartContextType | null>(null);

function toCartItem(s: ServerCartItem): CartItem {
  return {
    id: s.id,
    productId: s.productId,
    variantId: s.variantId,
    name: s.productName,
    variantName: s.variantName,
    pricePaise: s.pricePaise,
    mrpPaise: s.mrpPaise,
    imageUrl: s.productImages?.[0] ?? "",
    qty: s.qty,
    stockQty: s.stockQty,
    gstRate: s.productGstRate,
    organizationId: s.organizationId,
  };
}

const EMPTY_CART: ServerCart = { cartId: "", items: [] };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: commerceKeys.cart,
    queryFn: () => apiGet<ServerCart>("/cart"),
    staleTime: 15_000,
  });

  const items = useMemo(
    () => (data?.items ?? []).map(toCartItem),
    [data],
  );

  const setCart = (updater: (old: ServerCart) => ServerCart) =>
    qc.setQueryData<ServerCart>(commerceKeys.cart, (old) =>
      updater(old ?? EMPTY_CART),
    );

  const revalidate = () =>
    qc.invalidateQueries({ queryKey: commerceKeys.cart });

  // ── add ─────────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (v: AddItemInput) =>
      apiPost("/cart", {
        productId: v.productId,
        variantId: v.variantId,
        qty: v.qty ?? 1,
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: commerceKeys.cart });
      const prev = qc.getQueryData<ServerCart>(commerceKeys.cart);
      const addQty = v.qty ?? 1;
      setCart((old) => {
        const existing = old.items.find((i) => i.variantId === v.variantId);
        if (existing) {
          return {
            ...old,
            items: old.items.map((i) =>
              i.variantId === v.variantId ? { ...i, qty: i.qty + addQty } : i,
            ),
          };
        }
        const optimistic: ServerCartItem = {
          id: `optimistic-${v.variantId}`,
          qty: addQty,
          productId: v.productId,
          variantId: v.variantId,
          productName: v.name ?? "",
          productImages: v.imageUrl ? [v.imageUrl] : [],
          productGstRate: v.gstRate ?? 0,
          organizationId: v.organizationId ?? "",
          variantName: v.variantName ?? "",
          pricePaise: v.pricePaise ?? 0,
          mrpPaise: v.mrpPaise ?? 0,
          stockQty: v.stockQty ?? addQty,
        };
        return { ...old, items: [...old.items, optimistic] };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(commerceKeys.cart, ctx.prev);
    },
    onSettled: revalidate,
  });

  // ── update qty (absolute; qty<=0 removes server-side) ─────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      apiPatch(`/cart/${itemId}`, { qty }),
    onMutate: async ({ itemId, qty }) => {
      await qc.cancelQueries({ queryKey: commerceKeys.cart });
      const prev = qc.getQueryData<ServerCart>(commerceKeys.cart);
      setCart((old) => ({
        ...old,
        items:
          qty <= 0
            ? old.items.filter((i) => i.id !== itemId)
            : old.items.map((i) => (i.id === itemId ? { ...i, qty } : i)),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(commerceKeys.cart, ctx.prev);
    },
    onSettled: revalidate,
  });

  // ── remove ────────────────────────────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => apiDelete(`/cart/${itemId}`),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: commerceKeys.cart });
      const prev = qc.getQueryData<ServerCart>(commerceKeys.cart);
      setCart((old) => ({
        ...old,
        items: old.items.filter((i) => i.id !== itemId),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(commerceKeys.cart, ctx.prev);
    },
    onSettled: revalidate,
  });

  // ── clear (no bulk endpoint → delete each line) ───────────────────────────
  const clearMutation = useMutation({
    mutationFn: async () => {
      const current = qc.getQueryData<ServerCart>(commerceKeys.cart);
      await Promise.all(
        (current?.items ?? [])
          .filter((i) => !i.id.startsWith("optimistic-"))
          .map((i) => apiDelete(`/cart/${i.id}`)),
      );
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: commerceKeys.cart });
      const prev = qc.getQueryData<ServerCart>(commerceKeys.cart);
      setCart((old) => ({ ...old, items: [] }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(commerceKeys.cart, ctx.prev);
    },
    onSettled: revalidate,
  });

  const addItem = useCallback(
    (item: AddItemInput) => addMutation.mutate(item),
    [addMutation],
  );
  const removeItem = useCallback(
    (itemId: string) => removeMutation.mutate(itemId),
    [removeMutation],
  );
  const updateQty = useCallback(
    (itemId: string, qty: number) => updateMutation.mutate({ itemId, qty }),
    [updateMutation],
  );
  const clearCart = useCallback(() => clearMutation.mutate(), [clearMutation]);
  const getItemByVariant = useCallback(
    (variantId: string) => items.find((i) => i.variantId === variantId),
    [items],
  );

  // Totals mirror rpc_checkout: per-line GST rounded, then summed.
  const subtotalPaise = items.reduce((s, i) => s + i.pricePaise * i.qty, 0);
  const gstPaise = items.reduce(
    (s, i) => s + Math.round((i.pricePaise * i.qty * i.gstRate) / 100),
    0,
  );
  const totalPaise = subtotalPaise + gstPaise;
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        subtotalPaise,
        gstPaise,
        totalPaise,
        getItemByVariant,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
