import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function Shimmer({ style }: { style: object }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return <Animated.View style={[style, { opacity }]} />;
}

export function SkeletonCard() {
  const colors = useColors();
  const bg = colors.border;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Shimmer style={[styles.avatar, { backgroundColor: bg }]} />
        <View style={styles.headerLines}>
          <Shimmer style={[styles.line, { width: 100, backgroundColor: bg }]} />
          <Shimmer style={[styles.line, { width: 60, height: 10, backgroundColor: bg, marginTop: 4 }]} />
        </View>
      </View>
      <View style={styles.body}>
        <Shimmer style={[styles.line, { width: "100%", backgroundColor: bg }]} />
        <Shimmer style={[styles.line, { width: "90%", backgroundColor: bg, marginTop: 8 }]} />
        <Shimmer style={[styles.line, { width: "75%", backgroundColor: bg, marginTop: 8 }]} />
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Shimmer style={[styles.iconLine, { backgroundColor: bg }]} />
        <Shimmer style={[styles.iconLine, { backgroundColor: bg }]} />
        <Shimmer style={[styles.iconLine, { backgroundColor: bg }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, shadowColor: "#000" },
      android: { elevation: 2 },
    }),
  },
  header: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headerLines: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: 14 },
  footer: { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-around" },
  line: { height: 13, borderRadius: 6 },
  iconLine: { width: 60, height: 13, borderRadius: 6 },
});
