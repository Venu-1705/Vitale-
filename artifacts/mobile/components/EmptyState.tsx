import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  secondaryLabel?: string;
  onAction?: () => void;
  onSecondary?: () => void;
  mode?: "empty" | "error";
};

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
  mode = "empty",
}: Props) {
  const colors = useColors();
  const iconColor = mode === "error" ? "#EF4444" : colors.primary;
  const bgColor = mode === "error" ? "#EF444420" : colors.primary + "18";
  const btnColor = mode === "error" ? "#EF4444" : colors.primary;

  return (
    <View style={styles.container}>
      <View style={[styles.iconRing, { backgroundColor: bgColor }]}>
        <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
          <Feather name={icon as any} size={38} color={iconColor} />
        </View>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.actions}>
        {actionLabel && onAction ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: btnColor }]} onPress={onAction}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {secondaryLabel && onSecondary ? (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={onSecondary}
          >
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  iconRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 260 },
  actions: { gap: 10, marginTop: 6, width: "100%" },
  actionBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600" },
});
