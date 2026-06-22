import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { PackageCard, type LabPackageData } from "@/components/lab/PackageCard";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const NICHES = [
  { label: "PCOD / PCOS", icon: "activity", color: "#EC4899" },
  { label: "Diabetes", icon: "droplet", color: "#F59E0B" },
  { label: "Thyroid", icon: "zap", color: "#8B5CF6" },
  { label: "Cardiac", icon: "heart", color: "#EF4444" },
  { label: "Liver", icon: "shield", color: "#F97316" },
  { label: "Kidney", icon: "filter", color: "#3B82F6" },
  { label: "Vitamin Deficiency", icon: "sun", color: "#F59E0B" },
  { label: "Allergy", icon: "alert-triangle", color: "#10B981" },
  { label: "Women's Hormonal", icon: "user", color: "#EC4899" },
  { label: "Full Body", icon: "check-circle", color: "#22C55E" },
];

async function fetchLabHome() {
  const res = await fetch(`${API_BASE}/labs/home`);
  if (!res.ok) throw new Error("Failed to fetch lab home");
  return res.json() as Promise<{
    popular: LabPackageData[];
    all: LabPackageData[];
    coachRecommended: any[];
    upcomingBookings: any[];
    recentReports: any[];
  }>;
}

function TrustStrip({ colors }: { colors: any }) {
  const items = [
    { icon: "home", label: "Home collection" },
    { icon: "clock", label: "4-hr turnaround" },
    { icon: "shield", label: "NABL certified" },
    { icon: "star", label: "Thyrocare partner" },
  ];
  return (
    <View style={[styles.trustStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {items.map((it, i) => (
        <View key={it.label} style={styles.trustItem}>
          <Feather name={it.icon as any} size={14} color="#22C55E" />
          <Text style={[styles.trustText, { color: colors.mutedForeground }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Hero({ colors }: { colors: any }) {
  return (
    <View style={[styles.hero, { backgroundColor: "#0F1923" }]}>
      <View style={styles.heroContent}>
        <Text style={styles.heroTag}>NABL CERTIFIED · HOME COLLECTION</Text>
        <Text style={styles.heroTitle}>Get tested at{"\n"}home in 4 hours</Text>
        <View style={styles.benefitChips}>
          {["Free home pickup", "Digital reports", "Doctor consult"].map((b) => (
            <View key={b} style={styles.benefitChip}>
              <Feather name="check" size={11} color="#22C55E" />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={styles.thyrocareLockup}>
          <Feather name="award" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.thyrocareText}>Powered by Thyrocare</Text>
        </View>
      </View>
    </View>
  );
}

function UpcomingBookingCard({ booking, colors }: { booking: any; colors: any }) {
  const statusColor: Record<string, string> = {
    booked: "#2563EB",
    sample_collected: "#8B5CF6",
    processing: "#F59E0B",
    reported: "#22C55E",
  };
  const color = statusColor[booking.status] ?? "#6B7280";
  return (
    <Pressable
      style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/resources/lab/reports` as any)}
    >
      <View style={[styles.bookingDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bookingName, { color: colors.foreground }]} numberOfLines={1}>
          {booking.package?.name ?? "Lab Test"}
        </Text>
        <Text style={[styles.bookingDate, { color: colors.mutedForeground }]}>
          {booking.slotDate} · {booking.slotTime}
        </Text>
      </View>
      <View style={[styles.bookingStatus, { backgroundColor: color + "20" }]}>
        <Text style={[styles.bookingStatusText, { color }]}>
          {booking.status.replace(/_/g, " ")}
        </Text>
      </View>
    </Pressable>
  );
}

function ReportPreviewRow({ report, colors }: { report: any; colors: any }) {
  return (
    <Pressable
      style={[styles.reportRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/resources/lab/report/${report.id}` as any)}
    >
      <View style={[styles.reportIcon, { backgroundColor: "#FEF2F2" }]}>
        <Feather name="file-text" size={18} color="#DC2626" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reportTitle, { color: colors.foreground }]} numberOfLines={1}>
          {report.title ?? report.packageName}
        </Text>
        <Text style={[styles.reportDate, { color: colors.mutedForeground }]}>
          {new Date(report.reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </Text>
      </View>
      {(report.abnormalCount ?? 0) > 0 && (
        <View style={styles.abnormalBadge}>
          <Text style={styles.abnormalText}>{report.abnormalCount} abnormal</Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function LabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["labs-home"],
    queryFn: fetchLabHome,
    staleTime: 60_000,
  });

  const popular = data?.popular ?? [];
  const coachRecs = data?.coachRecommended ?? [];
  const upcoming = data?.upcomingBookings ?? [];
  const reports = data?.recentReports ?? [];

  const filteredPopular = search
    ? popular.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : popular;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#22C55E" />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search tests, packages…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <Hero colors={colors} />
      <TrustStrip colors={colors} />

      {/* Popular Packages */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular Packages</Text>
              <Pressable onPress={() => router.push("/(tabs)/resources/lab/reports" as any)}>
                <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600" }}>See all</Text>
              </Pressable>
            </View>
            {filteredPopular.slice(0, 6).map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} style={{ marginHorizontal: 16, marginBottom: 10 }} />
            ))}
            {filteredPopular.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No packages found</Text>
            )}
          </View>

          {/* Book by Niche */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16 }]}>
              Book by Health Goal
            </Text>
            <View style={styles.nicheGrid}>
              {NICHES.map((n) => (
                <Pressable
                  key={n.label}
                  style={[styles.nicheChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    setSearch(n.label.split("/")[0].trim());
                    /* scroll up happens naturally */
                  }}
                >
                  <Feather name={n.icon as any} size={15} color={n.color} />
                  <Text style={[styles.nicheText, { color: colors.foreground }]} numberOfLines={1}>
                    {n.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Coach Recommended */}
          {coachRecs.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16 }]}>
                Recommended by Your Coach
              </Text>
              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {coachRecs.map((rec: any) => (
                  <View key={rec.id} style={[styles.recCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {rec.note && (
                      <View style={styles.recNote}>
                        <Feather name="message-square" size={13} color="#22C55E" />
                        <Text style={[styles.recNoteText, { color: colors.mutedForeground }]}>"{rec.note}"</Text>
                      </View>
                    )}
                    {rec.package && <PackageCard pkg={rec.package} compact />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Upcoming Bookings */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming Bookings</Text>
              </View>
              <View style={{ paddingHorizontal: 16, gap: 8 }}>
                {upcoming.map((b: any) => (
                  <UpcomingBookingCard key={b.id} booking={b} colors={colors} />
                ))}
              </View>
            </View>
          )}

          {/* My Reports */}
          {reports.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Reports</Text>
                <Pressable onPress={() => router.push("/(tabs)/resources/lab/reports" as any)}>
                  <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600" }}>See all</Text>
                </Pressable>
              </View>
              <View style={[styles.reportsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {reports.map((r: any, i: number) => (
                  <ReportPreviewRow
                    key={r.id}
                    report={r}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
    padding: 22,
  },
  heroContent: { gap: 10 },
  heroTag: { fontSize: 10, fontWeight: "700", color: "#22C55E", letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff", lineHeight: 32 },
  benefitChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  benefitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  benefitText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "500" },
  thyrocareLockup: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  thyrocareText: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "500" },
  trustStrip: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  trustItem: { flex: 1, alignItems: "center", gap: 4 },
  trustText: { fontSize: 10, textAlign: "center", fontWeight: "500" },
  section: { paddingTop: 22 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
  },
  nicheChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    width: "47%",
  },
  nicheText: { fontSize: 12, fontWeight: "600", flex: 1 },
  recCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  recNote: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  recNoteText: { flex: 1, fontSize: 12, fontStyle: "italic", lineHeight: 17 },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bookingDot: { width: 10, height: 10, borderRadius: 5 },
  bookingName: { fontSize: 14, fontWeight: "600" },
  bookingDate: { fontSize: 12, marginTop: 2 },
  bookingStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  bookingStatusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  reportsCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  reportIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 13, fontWeight: "600" },
  reportDate: { fontSize: 11, marginTop: 2 },
  abnormalBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  abnormalText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  loading: { paddingVertical: 40, alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 14, paddingVertical: 16 },
});
