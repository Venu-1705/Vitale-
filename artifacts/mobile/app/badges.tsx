import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMeal, type Badge } from "@/context/MealContext";

const ICON_MAP: Record<string, string> = {
  leaf: "leaf-outline",
  flame: "flame-outline",
  star: "star-outline",
  award: "ribbon-outline",
  "check-circle": "checkmark-circle-outline",
  "book-open": "book-outline",
  heart: "heart-outline",
  users: "people-outline",
  "trending-up": "trending-up-outline",
};

function BadgeCard({ badge }: { badge: Badge }) {
  const colors = useColors();
  const unlocked = !!badge.unlockedAt;
  const iconName = ICON_MAP[badge.icon] ?? "star-outline";

  return (
    <TouchableOpacity
      style={[
        styles.badgeCard,
        {
          backgroundColor: unlocked ? badge.color + "12" : colors.muted,
          borderColor: unlocked ? badge.color + "44" : colors.border,
        },
      ]}
      onPress={() =>
        Alert.alert(
          badge.title,
          unlocked
            ? `${badge.description}\n\nEarned: ${new Date(badge.unlockedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
            : `${badge.description}\n\nNot yet earned — keep going!`,
          [{ text: "OK" }]
        )
      }
    >
      <View
        style={[
          styles.badgeIcon,
          { backgroundColor: unlocked ? badge.color + "28" : colors.border + "88" },
        ]}
      >
        <Ionicons
          name={iconName as any}
          size={28}
          color={unlocked ? badge.color : colors.mutedForeground}
        />
        {!unlocked && (
          <View style={[styles.lockOverlay, { backgroundColor: colors.background + "cc" }]}>
            <Feather name="lock" size={12} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.badgeTitle,
          { color: unlocked ? colors.foreground : colors.mutedForeground },
        ]}
        numberOfLines={2}
      >
        {badge.title}
      </Text>
      <Text
        style={[styles.badgeSub, { color: colors.mutedForeground }]}
        numberOfLines={2}
      >
        {badge.description}
      </Text>
      {unlocked && (
        <View style={[styles.earnedPill, { backgroundColor: badge.color + "22" }]}>
          <Feather name="check" size={10} color={badge.color} />
          <Text style={[styles.earnedText, { color: badge.color }]}>Earned</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function BadgesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { badges } = useMeal();

  const unlocked = badges.filter((b) => !!b.unlockedAt);
  const locked = badges.filter((b) => !b.unlockedAt);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Badge Collection</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {unlocked.length}/{badges.length} earned
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {unlocked.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EARNED ({unlocked.length})</Text>
            <View style={styles.grid}>
              {unlocked.map((b) => <BadgeCard key={b.id} badge={b} />)}
            </View>
          </View>
        )}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LOCKED ({locked.length})</Text>
          <View style={styles.grid}>
            {locked.map((b) => <BadgeCard key={b.id} badge={b} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 38 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    width: "30%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lockOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  badgeSub: { fontSize: 10, textAlign: "center", lineHeight: 13 },
  earnedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  earnedText: { fontSize: 10, fontWeight: "700" },
});
