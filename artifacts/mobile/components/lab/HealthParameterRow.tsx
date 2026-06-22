import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface HealthParam {
  testName: string;
  value: number;
  unit?: string | null;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  flag: string;
  isAbnormal: boolean;
  section?: string;
}

interface Props {
  param: HealthParam;
  showSection?: boolean;
  isLast?: boolean;
}

const FLAG_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  normal: { label: "Normal", bg: "#DCFCE7", text: "#16A34A" },
  high: { label: "↑ High", bg: "#FEE2E2", text: "#DC2626" },
  low: { label: "↓ Low", bg: "#FEF9C3", text: "#B45309" },
};

export function HealthParameterRow({ param, isLast }: Props) {
  const colors = useColors();
  const cfg = FLAG_CONFIG[param.flag] ?? FLAG_CONFIG.normal;
  const rangeText =
    param.referenceRangeLow != null && param.referenceRangeHigh != null
      ? `${param.referenceRangeLow}–${param.referenceRangeHigh} ${param.unit ?? ""}`
      : param.referenceRangeHigh != null
        ? `< ${param.referenceRangeHigh} ${param.unit ?? ""}`
        : "";

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.left}>
        {param.isAbnormal && (
          <View style={styles.dotWrap}>
            <View style={[styles.dot, { backgroundColor: cfg.text }]} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]}>{param.testName}</Text>
          {rangeText.trim() !== "" && (
            <Text style={[styles.range, { color: colors.mutedForeground }]}>
              Ref: {rangeText.trim()}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.value, { color: colors.foreground }]}>
          {param.value} {param.unit ?? ""}
        </Text>
        <View style={[styles.flagPill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.flagText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dotWrap: { paddingTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  name: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  range: { fontSize: 11, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  value: { fontSize: 13, fontWeight: "700" },
  flagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  flagText: { fontSize: 11, fontWeight: "700" },
});
