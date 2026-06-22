import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { downloadInvoicePdf, useOrders } from "@/lib/commerce";

type StatusFilter = "all" | "active" | "shipped" | "delivered" | "cancelled";

// Keys are the backend `order_status` enum values (no "placed" — `pending`
// renders as "Order Placed", matching the confirmation screen).
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#EFF6FF", text: "#2563EB" },
  confirmed: { bg: "#EFF6FF", text: "#2563EB" },
  packed: { bg: "#FEF9C3", text: "#D97706" },
  shipped: { bg: "#F0FDF4", text: "#16A34A" },
  delivered: { bg: "#DCFCE7", text: "#15803D" },
  cancelled: { bg: "#FEF2F2", text: "#DC2626" },
  refunded: { bg: "#FEF2F2", text: "#DC2626" },
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "Order Placed",
    confirmed: "Confirmed",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return map[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function handleInvoiceDownload(orderId: string) {
  try {
    const saved = await downloadInvoicePdf(orderId);
    if (!saved) {
      Alert.alert(
        "Invoice",
        "Invoice fetched. Saving to this device isn't supported yet — open the web app to download it.",
      );
    }
  } catch {
    Alert.alert("Invoice", "Could not download the invoice. Please try again.");
  }
}

function OrderCard({ order, colors }: { order: any; colors: any }) {
  const cfg = STATUS_COLOR[order.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
  const itemCount = order.items?.length ?? 0;
  const firstItem = order.items?.[0];
  return (
    <Pressable
      style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/order/${order.id}` as any)}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={[styles.orderId, { color: colors.mutedForeground }]}>
            #{order.id.slice(-8).toUpperCase()}
          </Text>
          <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.text }]}>{statusLabel(order.status)}</Text>
        </View>
      </View>

      {firstItem && (
        <View style={[styles.itemPreview, { borderTopColor: colors.border }]}>
          <View style={[styles.itemThumb, { backgroundColor: colors.muted }]}>
            <Feather name="package" size={18} color={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
              {firstItem.name}
            </Text>
            {itemCount > 1 && (
              <Text style={[styles.moreItems, { color: colors.mutedForeground }]}>
                +{itemCount - 1} more item{itemCount > 2 ? "s" : ""}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.orderTotal, { color: colors.foreground }]}>
              ₹{Math.round(order.totalPaise / 100).toLocaleString()}
            </Text>
            <Text style={[styles.itemsCount, { color: colors.mutedForeground }]}>
              {itemCount} item{itemCount > 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.orderFooter}>
        <Pressable
          style={[styles.footerBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push(`/order/${order.id}` as any)}
        >
          <Text style={[styles.footerBtnText, { color: colors.foreground }]}>Track Order</Text>
        </Pressable>
        {order.status === "delivered" && (
          <Pressable
            style={[styles.footerBtn, { backgroundColor: "#F0FDF4" }]}
            onPress={() => handleInvoiceDownload(order.id)}
          >
            <Feather name="download" size={13} color="#16A34A" />
            <Text style={{ color: "#16A34A", fontSize: 13, fontWeight: "600" }}>Invoice</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export default function MyOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: orders = [], isLoading, refetch, isFetching } = useOrders();

  const filtered =
    filter === "all"
      ? orders
      : filter === "active"
        ? orders.filter((o) => ["pending", "confirmed", "packed"].includes(o.status))
        : filter === "shipped"
          ? orders.filter((o) => o.status === "shipped")
          : orders.filter((o) => o.status === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Orders</Text>
        <Pressable onPress={() => router.push("/invoices" as any)}>
          <Feather name="file" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.filterChip,
              { backgroundColor: filter === f.value ? "#22C55E" : colors.card, borderColor: filter === f.value ? "#22C55E" : colors.border },
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, { color: filter === f.value ? "#fff" : colors.foreground }]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#22C55E" />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#22C55E" size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {filter === "all" ? "Your order history will appear here" : `No ${filter} orders found`}
            </Text>
            <Pressable
              style={[styles.shopBtn, { backgroundColor: "#22C55E" }]}
              onPress={() => router.push("/(tabs)/resources" as any)}
            >
              <Text style={styles.shopBtnText}>Shop Now</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map((order: any) => (
            <OrderCard key={order.id} order={order} colors={colors} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  filterBar: { borderBottomWidth: 1 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 60, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  shopBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 20, marginTop: 8 },
  shopBtnText: { color: "#fff", fontWeight: "700" },
  orderCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
  },
  orderId: { fontSize: 12, fontWeight: "700" },
  orderDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
  itemPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
  },
  itemThumb: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "600" },
  moreItems: { fontSize: 12, marginTop: 2 },
  orderTotal: { fontSize: 15, fontWeight: "800" },
  itemsCount: { fontSize: 11, marginTop: 2 },
  orderFooter: { flexDirection: "row", gap: 8, padding: 12, paddingTop: 8 },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  footerBtnText: { fontSize: 13, fontWeight: "600" },
});
