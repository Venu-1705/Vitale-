import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function fetchPackage(slug: string) {
  const res = await fetch(`${API_BASE}/labs/packages/${slug}`);
  if (!res.ok) throw new Error("Package not found");
  return res.json();
}

function QuickFactsRow({ pkg, colors }: { pkg: any; colors: any }) {
  const facts = [
    { icon: "list", label: "Tests", value: `${pkg.testsCount}` },
    { icon: "droplet", label: "Sample", value: pkg.sampleType ?? "Blood" },
    { icon: "alert-circle", label: "Fasting", value: pkg.fastingRequired ? "Required" : "Not needed" },
    { icon: "clock", label: "Report ETA", value: pkg.turnaroundDays === 1 ? "Next day" : `${pkg.turnaroundDays} days` },
  ];
  return (
    <View style={[styles.quickFacts, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {facts.map((f, i) => (
        <View key={f.label} style={[styles.factItem, i < facts.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
          <Feather name={f.icon as any} size={16} color="#22C55E" />
          <Text style={[styles.factValue, { color: colors.foreground }]}>{f.value}</Text>
          <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Accordion({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable style={styles.accordionHeader} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.accordionTitle, { color: colors.foreground }]}>{title}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </Pressable>
      {open && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
}

export default function PackageDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data: pkg, isLoading } = useQuery({
    queryKey: ["lab-package", slug],
    queryFn: () => fetchPackage(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (!pkg) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Package not found</Text>
      </View>
    );
  }

  const disc = Math.round(((pkg.mrpPaise - pkg.pricePaise) / pkg.mrpPaise) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: pkg.color ?? "#2563EB", paddingTop: insets.top + 12 },
          ]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          {pkg.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
          <Text style={styles.packageName}>{pkg.name}</Text>
          {pkg.description && (
            <Text style={styles.packageDesc}>{pkg.description}</Text>
          )}
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          <QuickFactsRow pkg={pkg} colors={colors} />

          {/* Price */}
          <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.foreground }]}>
                ₹{Math.round(pkg.pricePaise / 100)}
              </Text>
              <Text style={[styles.mrp, { color: colors.mutedForeground }]}>
                ₹{Math.round(pkg.mrpPaise / 100)}
              </Text>
              {disc > 0 && (
                <View style={styles.discBadge}>
                  <Text style={styles.discText}>{disc}% off</Text>
                </View>
              )}
            </View>
            <Text style={[styles.priceNote, { color: colors.mutedForeground }]}>
              Includes home sample collection · All taxes included
            </Text>
          </View>

          {/* Tests Included */}
          {pkg.tests && pkg.tests.length > 0 && (
            <Accordion title={`Tests Included (${pkg.tests.length})`} colors={colors}>
              {pkg.tests.map((t: any, i: number) => (
                <View
                  key={t.id}
                  style={[
                    styles.testRow,
                    i < pkg.tests.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.testDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.testName, { color: colors.foreground }]}>{t.name}</Text>
                    {t.section && (
                      <Text style={[styles.testSection, { color: colors.mutedForeground }]}>{t.section}</Text>
                    )}
                  </View>
                  {t.unit && (
                    <Text style={[styles.testUnit, { color: colors.mutedForeground }]}>{t.unit}</Text>
                  )}
                </View>
              ))}
            </Accordion>
          )}

          {/* Why This Test */}
          {pkg.whyThisTest && (
            <Accordion title="Why This Test?" colors={colors}>
              <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{pkg.whyThisTest}</Text>
            </Accordion>
          )}

          {/* Recommended For */}
          {pkg.recommendedFor && pkg.recommendedFor.length > 0 && (
            <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.accordionHeader}>
                <Text style={[styles.accordionTitle, { color: colors.foreground }]}>Recommended For</Text>
              </View>
              <View style={[styles.accordionBody, styles.chipWrap]}>
                {pkg.recommendedFor.map((r: string) => (
                  <View key={r} style={[styles.chip, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Book Button */}
      <View
        style={[
          styles.stickyFooter,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.footerPrice, { color: colors.foreground }]}>
            ₹{Math.round(pkg.pricePaise / 100)}
          </Text>
          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>Home collection included</Text>
        </View>
        <Pressable
          style={[styles.bookBtn, { backgroundColor: pkg.color ?? "#22C55E" }]}
          onPress={() =>
            router.push({ pathname: "/(tabs)/resources/lab/book" as any, params: { packageId: pkg.id, packageSlug: slug } })
          }
        >
          <Feather name="home" size={16} color="#fff" />
          <Text style={styles.bookBtnText}>Book Home Collection</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { padding: 20, paddingBottom: 24 },
  backBtn: { marginBottom: 16, width: 36 },
  popularBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  popularText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  packageName: { fontSize: 24, fontWeight: "900", color: "#fff", lineHeight: 30 },
  packageDesc: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 6, lineHeight: 20 },
  quickFacts: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  factItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 4,
  },
  factValue: { fontSize: 13, fontWeight: "700" },
  factLabel: { fontSize: 10 },
  priceCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 26, fontWeight: "900" },
  mrp: { fontSize: 15, textDecorationLine: "line-through" },
  discBadge: { backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  discText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  priceNote: { fontSize: 12 },
  accordion: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  accordionTitle: { fontSize: 15, fontWeight: "700" },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  testRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 10 },
  testDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E", marginTop: 5 },
  testName: { fontSize: 13, fontWeight: "500" },
  testSection: { fontSize: 11, marginTop: 2 },
  testUnit: { fontSize: 11 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "500" },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerPrice: { fontSize: 20, fontWeight: "900" },
  footerNote: { fontSize: 12 },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
  },
  bookBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
