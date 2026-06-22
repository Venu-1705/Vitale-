import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export interface LabPackageData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  testsCount: number;
  pricePaise: number;
  mrpPaise: number;
  turnaroundDays: number;
  popular: boolean;
  sampleType?: string;
  fastingRequired?: boolean;
  color?: string;
}

interface Props {
  pkg: LabPackageData;
  compact?: boolean;
  style?: object;
}

export function PackageCard({ pkg, compact = false, style }: Props) {
  const colors = useColors();
  const disc = Math.round(((pkg.mrpPaise - pkg.pricePaise) / pkg.mrpPaise) * 100);
  const accent = pkg.color ?? "#2563EB";

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.compact,
        style,
      ]}
      onPress={() => router.push(`/(tabs)/resources/lab/package/${pkg.slug}` as any)}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={compact ? 1 : 2}>
              {pkg.name}
            </Text>
            {!compact && pkg.description && (
              <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
                {pkg.description}
              </Text>
            )}
          </View>
          {pkg.popular && (
            <View style={[styles.popularBadge, { backgroundColor: "#FEF9C3" }]}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Feather name="droplet" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {pkg.sampleType ?? "Blood"}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Feather name="list" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {pkg.testsCount} tests
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {pkg.turnaroundDays === 1 ? "Next day" : `${pkg.turnaroundDays} days`}
            </Text>
          </View>
          {pkg.fastingRequired && (
            <View style={styles.metaChip}>
              <Feather name="alert-circle" size={11} color="#D97706" />
              <Text style={[styles.metaText, { color: "#D97706" }]}>Fasting</Text>
            </View>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            ₹{Math.round(pkg.pricePaise / 100)}
          </Text>
          <Text style={[styles.mrp, { color: colors.mutedForeground }]}>
            ₹{Math.round(pkg.mrpPaise / 100)}
          </Text>
          {disc > 0 && (
            <View style={[styles.discBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.discText, { color: "#16A34A" }]}>{disc}% off</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            style={[styles.bookBtn, { backgroundColor: accent }]}
            onPress={() => router.push(`/(tabs)/resources/lab/package/${pkg.slug}` as any)}
          >
            <Text style={styles.bookBtnText}>Book</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  compact: { minHeight: 80 },
  accentBar: { width: 5 },
  body: { flex: 1, padding: 12, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  desc: { fontSize: 12, lineHeight: 16 },
  popularBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  popularText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  price: { fontSize: 16, fontWeight: "800" },
  mrp: { fontSize: 12, textDecorationLine: "line-through" },
  discBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  discText: { fontSize: 11, fontWeight: "700" },
  bookBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  bookBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
