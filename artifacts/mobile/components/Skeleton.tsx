import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

function SkeletonPulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.muted, borderRadius: 8, opacity }, style]}
    />
  );
}

export function SkeletonRect({
  width,
  height = 14,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonPulse
      style={[{ width: width ?? "100%", height, borderRadius }, style]}
    />
  );
}

export function SkeletonCircle({ size }: { size: number }) {
  return (
    <SkeletonPulse style={{ width: size, height: size, borderRadius: size / 2 }} />
  );
}

export function PostCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sk.row}>
        <SkeletonCircle size={40} />
        <View style={{ flex: 1, gap: 7 }}>
          <SkeletonRect width="50%" height={13} />
          <SkeletonRect width="32%" height={11} />
        </View>
      </View>
      <SkeletonRect height={13} />
      <SkeletonRect width="75%" height={13} />
      <SkeletonRect height={180} borderRadius={12} />
      <View style={sk.row}>
        <SkeletonRect width={64} height={30} borderRadius={20} />
        <SkeletonRect width={64} height={30} borderRadius={20} />
        <SkeletonRect width={48} height={30} borderRadius={20} />
      </View>
    </View>
  );
}

export function RecipeCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonRect height={140} borderRadius={0} style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
      <View style={{ padding: 12, gap: 7 }}>
        <SkeletonRect width="70%" height={14} />
        <SkeletonRect width="45%" height={11} />
      </View>
    </View>
  );
}

export function ProgramCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonRect height={120} borderRadius={0} style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
      <View style={{ padding: 14, gap: 8 }}>
        <SkeletonRect width="55%" height={17} />
        <SkeletonRect width="85%" height={12} />
        <SkeletonRect width="40%" height={12} />
      </View>
    </View>
  );
}

export function ProfileSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: 14, padding: 16 }}>
      <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
          <SkeletonCircle size={88} />
          <SkeletonRect width={120} height={20} />
          <SkeletonRect width={90} height={13} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[sk.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SkeletonCircle size={22} />
            <SkeletonRect width={36} height={16} />
            <SkeletonRect width={52} height={10} />
          </View>
        ))}
      </View>
      <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 14, gap: 12 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[sk.row, { paddingVertical: 6 }]}>
            <SkeletonCircle size={34} />
            <SkeletonRect width="60%" height={14} />
            <SkeletonRect width={18} height={18} borderRadius={9} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function LeaderboardRowSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.leaderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonRect width={28} height={14} borderRadius={4} />
      <SkeletonCircle size={38} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonRect width="52%" height={13} />
        <SkeletonRect width="35%" height={10} />
      </View>
      <SkeletonRect width={52} height={22} borderRadius={11} />
    </View>
  );
}

export function HomeSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: 14, padding: 16 }}>
      <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
        <View style={sk.row}>
          <SkeletonCircle size={80} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonRect width="60%" height={22} />
            <SkeletonRect width="45%" height={14} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[sk.miniCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SkeletonCircle size={36} />
            <SkeletonRect width={28} height={14} />
            <SkeletonRect width={42} height={10} />
          </View>
        ))}
      </View>
      <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16, gap: 12 }]}>
        <SkeletonRect width="40%" height={16} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[sk.row, { paddingVertical: 4 }]}>
            <SkeletonCircle size={20} />
            <View style={{ flex: 1, gap: 5 }}>
              <SkeletonRect width="70%" height={13} />
              <SkeletonRect width="45%" height={10} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  postCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginHorizontal: 16 },
  recipeCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  card: { borderRadius: 16, borderWidth: 1 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  miniCard: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
});
