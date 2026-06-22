import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const STATS = [
  { label: "Users", value: "12K+" },
  { label: "Rated", value: "4.7 ★" },
  { label: "Coaches", value: "200+" },
  { label: "Avg Streak", value: "9 days" },
];

export function StatStrip() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {STATS.map((s, i) => (
        <View key={s.label} style={styles.item}>
          <Text style={styles.value}>{s.value}</Text>
          <Text style={styles.label}>{s.label}</Text>
          {i < STATS.length - 1 && <View style={styles.sep} />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
  },
  item: {
    alignItems: "center",
    paddingHorizontal: 20,
    position: "relative",
  },
  value: {
    fontSize: 18,
    fontWeight: "800",
    color: "#22C55E",
  },
  label: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 1,
  },
  sep: {
    position: "absolute",
    right: 0,
    top: "15%",
    height: "70%",
    width: 1,
    backgroundColor: "#E5E7EB",
  },
});
