import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  qty: number;
  min?: number;
  max?: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "md";
}

export function QuantityStepper({
  qty,
  min = 1,
  max = 99,
  onInc,
  onDec,
  size = "md",
}: Props) {
  const colors = useColors();
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.row,
        { borderColor: colors.border },
        isSmall && styles.rowSm,
      ]}
    >
      <Pressable
        onPress={onDec}
        disabled={qty <= min}
        style={[styles.btn, isSmall && styles.btnSm]}
      >
        <Feather
          name="minus"
          size={isSmall ? 12 : 16}
          color={qty <= min ? colors.mutedForeground : colors.foreground}
        />
      </Pressable>
      <Text
        style={[
          styles.qty,
          { color: colors.foreground },
          isSmall && styles.qtySm,
        ]}
      >
        {qty}
      </Text>
      <Pressable
        onPress={onInc}
        disabled={qty >= max}
        style={[styles.btn, isSmall && styles.btnSm]}
      >
        <Feather
          name="plus"
          size={isSmall ? 12 : 16}
          color={qty >= max ? colors.mutedForeground : colors.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: "hidden",
  },
  rowSm: { borderRadius: 8 },
  btn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSm: { width: 28, height: 28 },
  qty: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  qtySm: { minWidth: 22, fontSize: 13 },
});
