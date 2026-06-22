import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { apiGet, type ApiError } from "@/lib/api";
import { type Order } from "@/lib/commerce";

const STATUS_LABEL: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function formatRupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString()}`;
}

export default function ConfirmationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // `ids` (comma-separated, one per merchant order) is the canonical param;
  // `orderId` is accepted for backwards-compatible single-order deep links.
  const { ids, orderId } = useLocalSearchParams<{ ids?: string; orderId?: string }>();

  const orderIds = useMemo(() => {
    const raw = ids ?? orderId ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [ids, orderId]);

  // Authoritative: fetch each created order from the backend. Because the ids
  // live in the route, this survives refresh / deep-link / cold restart.
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["confirmation", orderIds],
    queryFn: () => Promise.all(orderIds.map((id) => apiGet<Order>(`/orders/${id}`))),
    enabled: orderIds.length > 0,
  });

  const single = orders?.length === 1 ? orders[0] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 20,
          paddingBottom: insets.bottom + 40,
          alignItems: "center",
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Green check */}
        <View style={styles.checkCircle}>
          <LinearGradient colors={["#16A34A", "#22C55E"]} style={styles.checkGradient}>
            <Feather name="check" size={44} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          Order Placed! 🎉
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {orders && orders.length > 1
            ? `Your ${orders.length} orders have been placed and are being prepared.`
            : "Your order has been successfully placed and is being prepared."}
        </Text>

        {isLoading && (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
        )}

        {isError && !isLoading && (
          <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
            Your order was placed, but we couldn't load the details right now.
            You can view it from My Orders.
          </Text>
        )}

        {/* One card per (per-merchant) order, populated from the backend. */}
        {(orders ?? []).map((order) => (
          <Pressable
            key={order.id}
            style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/order/${order.id}` as any)}
          >
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Order ID</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                #{order.id.slice(-8).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Items</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {order.items?.length ?? 0}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {formatRupees(order.totalPaise)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Status</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}

        {/* Steps */}
        <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stepsTitle, { color: colors.foreground }]}>
            What happens next?
          </Text>
          {[
            { icon: "check-circle", label: "Order confirmed", done: true },
            { icon: "package", label: "Packed & dispatched", done: false },
            { icon: "truck", label: "Out for delivery", done: false },
            { icon: "home", label: "Delivered to your door", done: false },
          ].map((step) => (
            <View key={step.label} style={styles.step}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: step.done ? "#DCFCE7" : colors.muted },
                ]}
              >
                <Feather
                  name={step.icon as any}
                  size={16}
                  color={step.done ? "#16A34A" : colors.mutedForeground}
                />
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: step.done ? colors.foreground : colors.mutedForeground },
                  step.done && { fontWeight: "700" },
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() =>
            single
              ? router.push(`/order/${single.id}` as any)
              : router.push("/my-orders" as any)
          }
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            {single ? "View Order Details" : "View Orders"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/resources/shop" as any)}
        >
          <Text style={styles.primaryBtnText}>Continue Shopping</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#16A34A",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  checkGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  infoCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" },
  statusText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  stepsCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  stepsTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 14 },
  ctaBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "700", fontSize: 13 },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
