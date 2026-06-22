import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { AddressPickerModal } from "@/components/shop/AddressPickerModal";
import {
  CashfreeCheckoutModal,
  CASHFREE_RETURN_URL,
} from "@/components/shop/CashfreeCheckoutModal";
import { ApiError } from "@/lib/api";
import {
  useAddresses,
  useCheckout,
  createCashfreeOrder,
  getOrderPaymentStatus,
  type Address,
} from "@/lib/commerce";

function formatRupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function apiMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { message?: string } } | null;
    return data?.error?.message ?? fallback;
  }
  return fallback;
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { items, subtotalPaise, gstPaise, totalPaise } = useCart();
  const { data: addresses = [], isLoading: addressesLoading } = useAddresses();
  const checkout = useCheckout();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Cashfree payment session for the just-placed order(s). When set, the WebView
  // checkout sheet is shown; the gateway webhook confirms the order server-side.
  const [payment, setPayment] = useState<{
    sessionId: string;
    payOrderId: string;
    orderIds: string[];
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Selected address: explicit pick → default → first saved.
  const selectedAddress: Address | undefined = useMemo(() => {
    if (chosenId) return addresses.find((a) => a.id === chosenId);
    return addresses.find((a) => a.isDefault) ?? addresses[0];
  }, [addresses, chosenId]);

  // The backend splits the cart into one order per merchant org. Preview that
  // here from the (server-sourced) cart so the customer isn't surprised; the
  // authoritative split comes back from checkout.
  const merchantCount = useMemo(
    () => new Set(items.map((i) => i.organizationId).filter(Boolean)).size,
    [items],
  );

  const goToConfirmation = (ids: string[]) => {
    router.replace(
      `/(tabs)/resources/shop/confirmation?ids=${ids.join(",")}` as any,
    );
  };

  const placeOrder = async () => {
    if (items.length === 0) return;
    if (!selectedAddress) {
      Alert.alert("Address required", "Please add a delivery address to continue.");
      setPickerOpen(true);
      return;
    }
    try {
      setProcessing(true);
      const orders = await checkout.mutateAsync(selectedAddress.id);
      const ids = orders.map((o) => o.orderId).filter(Boolean);
      if (ids.length === 0) {
        Alert.alert("Order Failed", "No order was created. Please try again.");
        return;
      }

      // Initiate Cashfree payment for the placed order. (For a multi-merchant cart
      // each order is paid separately; we start with the first and the rest remain
      // payable from My Orders.) If the gateway isn't configured (503), fall back to
      // the order confirmation directly so dev/demo flows still work.
      try {
        const session = await createCashfreeOrder(ids[0], CASHFREE_RETURN_URL);
        setPayment({ sessionId: session.paymentSessionId, payOrderId: ids[0], orderIds: ids });
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          goToConfirmation(ids);
          return;
        }
        throw err;
      }
    } catch (err) {
      Alert.alert(
        "Order Failed",
        apiMessage(err, "We couldn't place your order. Please try again."),
      );
    } finally {
      setProcessing(false);
    }
  };

  // The WebView signalled the payment attempt finished. The gateway webhook is the
  // source of truth; we nudge a status read (best-effort) then show confirmation,
  // where the order's live status reflects whether payment was captured.
  const onPaymentComplete = async () => {
    const sess = payment;
    setPayment(null);
    if (!sess) return;
    await getOrderPaymentStatus(sess.payOrderId).catch(() => null);
    goToConfirmation(sess.orderIds);
  };

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
          Checkout
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 120 }}
      >
        {/* Delivery Address */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Delivery Address
            </Text>
            <Pressable onPress={() => setPickerOpen(true)}>
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                {selectedAddress ? "Change" : "Add"}
              </Text>
            </Pressable>
          </View>
          {addressesLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : selectedAddress ? (
            <View style={[styles.addressBox, { backgroundColor: colors.muted }]}>
              <View style={styles.addressRow}>
                <Feather name="map-pin" size={14} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressName, { color: colors.foreground }]}>
                    {selectedAddress.name} · {selectedAddress.label}
                  </Text>
                  <Text style={[styles.addressLine, { color: colors.mutedForeground }]}>
                    {selectedAddress.line1}
                    {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                  </Text>
                  <Text style={[styles.addressLine, { color: colors.mutedForeground }]}>
                    {selectedAddress.city}, {selectedAddress.state} – {selectedAddress.pincode}
                  </Text>
                  <Text style={[styles.addressLine, { color: colors.mutedForeground }]}>
                    {selectedAddress.phone}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.addAddressBtn, { borderColor: colors.primary }]}
              onPress={() => setPickerOpen(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
                Add delivery address
              </Text>
            </Pressable>
          )}
        </View>

        {/* Order summary */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Order Summary
          </Text>
          {items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <Text style={[styles.summaryItemName, { color: colors.foreground }]} numberOfLines={1}>
                {item.name} · {item.variantName}
              </Text>
              <Text style={[styles.summaryItemQty, { color: colors.mutedForeground }]}>
                ×{item.qty}
              </Text>
              <Text style={[styles.summaryItemPrice, { color: colors.foreground }]}>
                {formatRupees(item.pricePaise * item.qty)}
              </Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.lineRow}>
            <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.lineValue, { color: colors.foreground }]}>
              {formatRupees(subtotalPaise)}
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>GST</Text>
            <Text style={[styles.lineValue, { color: colors.foreground }]}>
              {formatRupees(gstPaise)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {formatRupees(totalPaise)}
            </Text>
          </View>
        </View>

        {/* Per-merchant split notice */}
        {merchantCount > 1 && (
          <View style={[styles.splitNotice, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
            <Feather name="info" size={16} color="#B45309" />
            <Text style={styles.splitText}>
              Your items are sold by {merchantCount} sellers, so this will be placed
              as {merchantCount} separate orders — each tracked and invoiced on its own.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
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
        <View style={styles.ctaInfo}>
          <Text style={[styles.ctaLabel, { color: colors.mutedForeground }]}>
            Total payable
          </Text>
          <Text style={[styles.ctaTotal, { color: colors.foreground }]}>
            {formatRupees(totalPaise)}
          </Text>
        </View>
        <Pressable
          style={[
            styles.placeOrderBtn,
            { backgroundColor: colors.primary },
            (checkout.isPending || processing || items.length === 0) && { opacity: 0.7 },
          ]}
          onPress={placeOrder}
          disabled={checkout.isPending || processing || items.length === 0}
        >
          {checkout.isPending || processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderText}>Pay Now →</Text>
          )}
        </Pressable>
      </View>

      <AddressPickerModal
        visible={pickerOpen}
        addresses={addresses}
        selectedId={selectedAddress?.id ?? null}
        onSelect={(a) => setChosenId(a.id)}
        onClose={() => setPickerOpen(false)}
      />

      <CashfreeCheckoutModal
        visible={!!payment}
        paymentSessionId={payment?.sessionId ?? ""}
        onComplete={onPaymentComplete}
        onClose={() => {
          // User dismissed without finishing: the order stays pending and is payable
          // again from My Orders. Send them to confirmation to see its status.
          const ids = payment?.orderIds ?? [];
          setPayment(null);
          if (ids.length > 0) goToConfirmation(ids);
        }}
      />
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
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryItemName: { flex: 1, fontSize: 13 },
  summaryItemQty: { fontSize: 13 },
  summaryItemPrice: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1 },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lineLabel: { fontSize: 13 },
  lineValue: { fontSize: 13, fontWeight: "600" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontSize: 15, fontWeight: "800" },
  totalValue: { fontSize: 17, fontWeight: "800" },
  addressBox: { borderRadius: 12, padding: 12 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  addressName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  addressLine: { fontSize: 12, lineHeight: 18 },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
  },
  splitNotice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  splitText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#92400E" },
  ctaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaInfo: { flex: 1 },
  ctaLabel: { fontSize: 12 },
  ctaTotal: { fontSize: 20, fontWeight: "800" },
  placeOrderBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    minWidth: 140,
  },
  placeOrderText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
