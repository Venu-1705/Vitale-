import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { QuantityStepper } from "@/components/shop/QuantityStepper";

function formatRupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    items,
    removeItem,
    updateQty,
    subtotalPaise,
    gstPaise,
    totalPaise,
    totalItems,
    clearCart,
  } = useCart();

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "web" ? 16 : insets.top,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Cart
          </Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Feather name="shopping-cart" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your cart is empty
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Add products from the shop to get started
          </Text>
          <Pressable
            style={[styles.shopBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.shopBtnText}>Browse Shop</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 16 : insets.top,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Cart ({totalItems})
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert("Clear Cart", "Remove all items?", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: clearCart },
            ])
          }
        >
          <Feather name="trash-2" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Line Items */}
        <View style={styles.itemsList}>
          {items.map((item) => (
            <View
              key={item.id}
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.itemImage}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[styles.itemVariant, { color: colors.mutedForeground }]}>
                  {item.variantName}
                </Text>
                <View style={styles.itemPriceRow}>
                  <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                    {formatRupees(item.pricePaise)}
                  </Text>
                  {item.mrpPaise > item.pricePaise && (
                    <Text style={[styles.itemMrp, { color: colors.mutedForeground }]}>
                      {formatRupees(item.mrpPaise)}
                    </Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <QuantityStepper
                    qty={item.qty}
                    max={item.stockQty}
                    onInc={() => updateQty(item.id, item.qty + 1)}
                    onDec={() => updateQty(item.id, item.qty - 1)}
                    size="sm"
                  />
                  <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Order Summary — pricing is authoritative (subtotal + GST). Any
            discounts/shipping are applied server-side at checkout, not faked here. */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            Order Summary
          </Text>
          <SummaryRow label="Subtotal" value={formatRupees(subtotalPaise)} colors={colors} />
          <SummaryRow label="GST" value={formatRupees(gstPaise)} colors={colors} />
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>
              {formatRupees(totalPaise)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout CTA — final pricing & any per-merchant split are computed by
          the backend; we pass no client totals. */}
      <View
        style={[
          styles.checkoutBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/resources/shop/checkout" as any)}
        >
          <Text style={styles.checkoutBtnText}>
            Checkout · {formatRupees(totalPaise)}
          </Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  colors,
  green,
}: {
  label: string;
  value: string;
  colors: any;
  green?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: green ? "#16A34A" : colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  shopBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  shopBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  itemsList: { padding: 16, gap: 12 },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemImage: { width: 80, height: 80, borderRadius: 10 },
  itemName: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  itemVariant: { fontSize: 12 },
  itemPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemPrice: { fontSize: 15, fontWeight: "800" },
  itemMrp: { fontSize: 12, textDecorationLine: "line-through" },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  removeBtn: { padding: 6 },
  summary: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  summaryTitle: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: "600" },
  summaryDivider: { height: 1 },
  totalLabel: { fontSize: 16, fontWeight: "800" },
  totalValue: { fontSize: 18, fontWeight: "800" },
  checkoutBar: {
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
