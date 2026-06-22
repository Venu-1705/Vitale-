import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { OrderTimeline } from "@/components/shop/OrderTimeline";
import { useCart } from "@/context/CartContext";
import { ApiError } from "@/lib/api";
import {
  downloadInvoicePdf,
  useCancelOrder,
  useOrder,
  useReorder,
} from "@/lib/commerce";

// rpc_cancel_order only permits pending→cancelled (server state-machine guard);
// surfacing the action for any other status would just 422.
const CANCELLABLE = ["pending"];

function apiMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { message?: string } } | null;
    return data?.error?.message ?? fallback;
  }
  return fallback;
}

export default function OrderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useCart();

  const { data: order, isLoading } = useOrder(id);
  const cancel = useCancelOrder();
  const reorder = useReorder();

  async function downloadInvoice() {
    try {
      const saved = await downloadInvoicePdf(id!);
      if (!saved) {
        Alert.alert(
          "Invoice",
          "Invoice fetched. Saving to this device isn't supported yet — open the web app to download it.",
        );
      }
    } catch (err) {
      Alert.alert("Invoice", apiMessage(err, "Could not download the invoice."));
    }
  }

  async function reorderItems() {
    try {
      const { items } = await reorder.mutateAsync(id!);
      items.forEach((it) =>
        addItem({
          productId: it.productId,
          variantId: it.variantId,
          qty: it.qty,
          name: it.name,
          variantName: it.variantName,
        }),
      );
      Alert.alert("Reorder", "Items added to your cart.", [
        { text: "Keep browsing", style: "cancel" },
        {
          text: "Go to Cart",
          onPress: () => router.push("/(tabs)/resources/shop/cart" as any),
        },
      ]);
    } catch (err) {
      Alert.alert("Reorder failed", apiMessage(err, "Could not reorder. Please try again."));
    }
  }

  function cancelOrder() {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: async () => {
          try {
            await cancel.mutateAsync({ id: id! });
            Alert.alert("Cancelled", "Your order has been cancelled.");
          } catch (err) {
            Alert.alert("Error", apiMessage(err, "Could not cancel this order."));
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Order #{order.id.slice(-8).toUpperCase()}
          </Text>
          <Text style={[styles.headerDate, { color: colors.mutedForeground }]}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <Pressable onPress={downloadInvoice}>
          <Feather name="download" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}>
        {/* Order Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tracking</Text>
          <OrderTimeline currentStatus={order.status} events={order.events ?? []} />
        </View>

        {/* Items */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Items ({order.items?.length ?? 0})
          </Text>
          {order.items?.map((item: any, i: number) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <View style={[styles.itemThumb, { backgroundColor: colors.muted }]}>
                <Feather name="package" size={18} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.itemVariant, { color: colors.mutedForeground }]}>
                  {item.variantName} · x{item.qty}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                ₹{Math.round((item.pricePaise * item.qty) / 100).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Price Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Price Breakdown</Text>
          {([
            ["Subtotal", `₹${Math.round(order.subtotalPaise / 100).toLocaleString()}`],
            ["GST", `₹${Math.round(order.gstPaise / 100).toLocaleString()}`],
            ["Shipping", order.shippingPaise === 0 ? "Free" : `₹${Math.round(order.shippingPaise / 100).toLocaleString()}`],
            order.discountPaise > 0
              ? ["Discount", `-₹${Math.round(order.discountPaise / 100).toLocaleString()}`]
              : null,
          ] as ([string, string] | null)[])
            .filter((row): row is [string, string] => row !== null)
            .map(([k, v], i, arr) => (
              <View
                key={k!}
                style={[
                  styles.priceRow,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.priceKey, { color: colors.mutedForeground }]}>{k}</Text>
                <Text style={[styles.priceVal, { color: colors.foreground }]}>{v}</Text>
              </View>
            ))}
          <View style={[styles.priceRowTotal, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalKey, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.totalVal, { color: colors.foreground }]}>
              ₹{Math.round(order.totalPaise / 100).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Payment info */}
        {order.gatewayPaymentId && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceKey, { color: colors.mutedForeground }]}>Payment ID</Text>
              <Text style={[styles.priceVal, { color: colors.foreground }]} numberOfLines={1}>
                {order.gatewayPaymentId}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {CANCELLABLE.includes(order.status) && (
          <Pressable
            style={[styles.cancelBtn, { borderColor: "#FCA5A5" }]}
            onPress={cancelOrder}
          >
            <Feather name="x-circle" size={16} color="#DC2626" />
            <Text style={[styles.cancelText]}>Cancel Order</Text>
          </Pressable>
        )}

        {order.status === "delivered" && (
          <Pressable
            style={[
              styles.reorderBtn,
              { backgroundColor: "#22C55E" },
              reorder.isPending && { opacity: 0.7 },
            ]}
            disabled={reorder.isPending}
            onPress={reorderItems}
          >
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.reorderText}>
              {reorder.isPending ? "Adding…" : "Reorder"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerDate: { fontSize: 12, marginTop: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  itemThumb: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemVariant: { fontSize: 12, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "700" },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  priceKey: { fontSize: 13 },
  priceVal: { fontSize: 13, fontWeight: "600" },
  priceRowTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  totalKey: { fontSize: 15, fontWeight: "800" },
  totalVal: { fontSize: 18, fontWeight: "900" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelText: { color: "#DC2626", fontSize: 14, fontWeight: "700" },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  reorderText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
