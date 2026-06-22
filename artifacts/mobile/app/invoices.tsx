import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
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
import { downloadInvoicePdf, useInvoices } from "@/lib/commerce";

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

export default function InvoicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: invoices = [], isLoading, refetch, isFetching } = useInvoices();

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Invoices</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#22C55E" />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 40 }}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#22C55E" size="large" />
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="file" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No invoices yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Invoices for your completed orders will appear here
            </Text>
          </View>
        ) : (
          invoices.map((inv) => (
            <View key={inv.id} style={[styles.invCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.invIcon, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="file-text" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.invNumber, { color: colors.foreground }]}>
                  {inv.invoiceNumber ?? `INV-${inv.orderId?.slice(-6).toUpperCase()}`}
                </Text>
                <Text style={[styles.invOrder, { color: colors.mutedForeground }]}>
                  Order #{inv.orderId?.slice(-8).toUpperCase()}
                </Text>
                <Text style={[styles.invAmount, { color: colors.foreground }]}>
                  ₹{Math.round(inv.totalPaise / 100).toLocaleString()}
                </Text>
                <Text style={[styles.invDate, { color: colors.mutedForeground }]}>
                  {new Date(inv.issuedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </Text>
              </View>
              <View style={styles.invActions}>
                <Pressable
                  style={[styles.downloadBtn, { backgroundColor: "#EFF6FF" }]}
                  onPress={() => handleInvoiceDownload(inv.orderId)}
                >
                  <Feather name="download" size={16} color="#2563EB" />
                </Pressable>
                <Pressable
                  style={[styles.viewOrderBtn, { backgroundColor: colors.muted }]}
                  onPress={() => router.push(`/order/${inv.orderId}` as any)}
                >
                  <Text style={[styles.viewOrderText, { color: colors.foreground }]}>View</Text>
                </Pressable>
              </View>
            </View>
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
  loading: { paddingVertical: 60, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  invCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  invIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  invNumber: { fontSize: 14, fontWeight: "700" },
  invOrder: { fontSize: 12, marginTop: 2 },
  invAmount: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  invDate: { fontSize: 11, marginTop: 2 },
  invActions: { gap: 6 },
  downloadBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  viewOrderBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignItems: "center" },
  viewOrderText: { fontSize: 12, fontWeight: "600" },
});
