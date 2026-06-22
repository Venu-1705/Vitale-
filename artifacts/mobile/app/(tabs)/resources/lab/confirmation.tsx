import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function LabConfirmationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookingId, slotDate, slotTime } = useLocalSearchParams<{
    bookingId: string;
    slotDate: string;
    slotTime: string;
  }>();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: "center", padding: 24 }}
    >
      {/* Checkmark */}
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { backgroundColor: "#22C55E" }]}>
          <Feather name="check" size={44} color="#fff" />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Booking Confirmed! 🎉</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your home sample collection has been scheduled. Our phlebotomist will arrive at the selected time.
      </Text>

      {/* Details Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          ["Booking ID", bookingId?.slice(0, 16).toUpperCase() ?? "—"],
          ["Collection Date", slotDate ?? "—"],
          ["Collection Time", slotTime ?? "—"],
          ["Provider", "Thyrocare"],
          ["Status", "Confirmed"],
        ].map(([k, v], i, arr) => (
          <View
            key={k}
            style={[
              styles.row,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.rowKey, { color: colors.mutedForeground }]}>{k}</Text>
            <Text style={[styles.rowVal, { color: k === "Status" ? "#22C55E" : colors.foreground }]}>{v}</Text>
          </View>
        ))}
      </View>

      {/* What's Next */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>What happens next?</Text>
        {[
          { icon: "check-circle", label: "Booking confirmed", done: true },
          { icon: "user", label: "Phlebotomist assigned", done: false },
          { icon: "droplet", label: "Sample collected at home", done: false },
          { icon: "file-text", label: "Report ready in 24–48 hrs", done: false },
        ].map((s, i) => (
          <View key={s.label} style={[styles.stepRow, i > 0 && { marginTop: 14 }]}>
            <View style={[styles.stepDot, { backgroundColor: s.done ? "#22C55E" : colors.muted }]}>
              <Feather name={s.icon as any} size={14} color={s.done ? "#fff" : colors.mutedForeground} />
            </View>
            <Text style={[styles.stepLabel, { color: s.done ? colors.foreground : colors.mutedForeground, fontWeight: s.done ? "700" : "400" }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.primaryBtn, { backgroundColor: "#22C55E" }]}
        onPress={() => router.push("/(tabs)/resources/lab/reports" as any)}
      >
        <Feather name="file-text" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>View My Reports</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
        onPress={() => router.replace("/(tabs)/resources" as any)}
      >
        <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  iconWrap: { marginTop: 24, marginBottom: 20 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  card: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    padding: 16,
    gap: 0,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  rowKey: { fontSize: 13 },
  rowVal: { fontSize: 13, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 14 },
  primaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { width: "100%", paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
});
