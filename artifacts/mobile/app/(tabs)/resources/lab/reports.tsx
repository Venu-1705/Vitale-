import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { getAuthHeaders } from "@/lib/session";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function fetchReports() {
  const res = await fetch(`${API_BASE}/labs/reports`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<any[]>;
}

async function fetchBookings() {
  const res = await fetch(`${API_BASE}/labs/bookings`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<any[]>;
}

type Tab = "recent" | "all";

export default function MyReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("recent");

  const { data: reports = [], isLoading: loadingReports, refetch: refetchReports, isFetching: fetchingReports } = useQuery({
    queryKey: ["lab-reports"],
    queryFn: fetchReports,
    staleTime: 30_000,
  });

  const { data: bookings = [], isLoading: loadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ["lab-bookings"],
    queryFn: fetchBookings,
    staleTime: 30_000,
  });

  const displayed = tab === "recent" ? reports.slice(0, 5) : reports;
  const upcoming = bookings.filter((b: any) => ["booked", "sample_collected", "processing"].includes(b.status));

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lab Reports</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
        {(["recent", "all"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, { backgroundColor: tab === t ? colors.card : "transparent" }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.foreground : colors.mutedForeground, fontWeight: tab === t ? "700" : "400" }]}>
              {t === "recent" ? "Recent" : `All (${reports.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={fetchingReports} onRefresh={() => { refetchReports(); refetchBookings(); }} tintColor="#22C55E" />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }}
      >
        {/* Upcoming Bookings */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming Collections</Text>
            {upcoming.map((b: any) => (
              <View key={b.id} style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: "#2563EB" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookingName, { color: colors.foreground }]}>{b.package?.name ?? "Lab Test"}</Text>
                  <Text style={[styles.bookingMeta, { color: colors.mutedForeground }]}>
                    {b.slotDate} · {b.slotTime} · {b.collectionType === "home" ? "Home" : "Centre"}
                  </Text>
                </View>
                <Pressable
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    fetch(`${API_BASE}/labs/bookings/${b.id}/cancel`, { method: "POST", headers: getAuthHeaders() })
                      .then(() => refetchBookings());
                  }}
                >
                  <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Reports List */}
        {loadingReports ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#22C55E" />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reports yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Book a lab test to see your results here
            </Text>
            <Pressable
              style={[styles.bookBtn, { backgroundColor: "#22C55E" }]}
              onPress={() => router.back()}
            >
              <Text style={styles.bookBtnText}>Book a Test</Text>
            </Pressable>
          </View>
        ) : (
          displayed.map((r: any) => {
            const hasAbnormal = (r.abnormalCount ?? 0) > 0;
            return (
              <Pressable
                key={r.id}
                style={[styles.reportCard, { backgroundColor: colors.card, borderColor: hasAbnormal ? "#FECACA" : colors.border }]}
                onPress={() => router.push(`/(tabs)/resources/lab/report/${r.id}` as any)}
              >
                <View style={[styles.reportIcon, { backgroundColor: hasAbnormal ? "#FEF2F2" : "#F0FDF4" }]}>
                  <Feather name="file-text" size={22} color={hasAbnormal ? "#DC2626" : "#22C55E"} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {r.title ?? r.packageName}
                    </Text>
                    {hasAbnormal && (
                      <View style={styles.abnormalDot} />
                    )}
                  </View>
                  <Text style={[styles.reportDate, { color: colors.mutedForeground }]}>
                    {new Date(r.reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                  {hasAbnormal && (
                    <Text style={styles.abnormalLabel}>{r.abnormalCount} abnormal result{r.abnormalCount > 1 ? "s" : ""}</Text>
                  )}
                </View>
                <View style={styles.reportActions}>
                  <Pressable
                    style={[styles.viewBtn, { backgroundColor: "#F0FDF4" }]}
                    onPress={() => router.push(`/(tabs)/resources/lab/report/${r.id}` as any)}
                  >
                    <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "700" }}>View</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.viewBtn, { backgroundColor: colors.muted }]}
                    onPress={() => {
                      // Download PDF (stub)
                      fetch(`${API_BASE}/labs/reports/${r.id}/pdf`);
                    }}
                  >
                    <Feather name="download" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
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
  tabs: {
    flexDirection: "row",
    margin: 16,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabText: { fontSize: 14 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  bookingName: { fontSize: 13, fontWeight: "600" },
  bookingMeta: { fontSize: 11, marginTop: 2 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  cancelText: { fontSize: 12 },
  loading: { paddingVertical: 40, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  bookBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 20, marginTop: 8 },
  bookBtnText: { color: "#fff", fontWeight: "700" },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  reportIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reportTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reportTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  abnormalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" },
  reportDate: { fontSize: 12 },
  abnormalLabel: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  reportActions: { flexDirection: "row", gap: 6 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
});
