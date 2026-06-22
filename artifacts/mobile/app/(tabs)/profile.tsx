import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { ProfileSkeleton } from "@/components/Skeleton";
import { useMeal, type Badge } from "@/context/MealContext";
import { useMyEnrollments } from "@/lib/programs";
import { useMessaging } from "@/context/MessagingContext";

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

function BadgeCircle({ badge }: { badge: Badge }) {
  const colors = useColors();
  const unlocked = !!badge.unlockedAt;
  const iconName = ICON_MAP[badge.icon] ?? "star-outline";
  return (
    <TouchableOpacity
      style={[
        styles.badgeCircle,
        { backgroundColor: unlocked ? badge.color + "20" : colors.muted, borderColor: unlocked ? badge.color + "44" : colors.border },
      ]}
      onPress={() =>
        Alert.alert(badge.title, unlocked ? badge.description : `${badge.description}\nNot yet earned — keep going!`)
      }
    >
      <Ionicons name={iconName as any} size={22} color={unlocked ? badge.color : colors.mutedForeground} />
      {!unlocked && (
        <View style={[styles.badgeLock, { backgroundColor: colors.background }]}>
          <Feather name="lock" size={9} color={colors.mutedForeground} />
        </View>
      )}
    </TouchableOpacity>
  );
}

type SectionItem = {
  icon: string;
  label: string;
  color: string;
  badge?: number;
  onPress: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 380);
    return () => clearTimeout(t);
  }, []);
  const { xp, streak, badges } = useMeal();
  const { data: enrollments = [] } = useMyEnrollments();
  const { totalUnread } = useMessaging();

  const programsCompleted = enrollments.filter((e) => e.status === "completed").length;
  const unlockedCount = badges.filter((b) => !!b.unlockedAt).length;

  const STATS = [
    { icon: "zap",      value: String(streak),           label: "Streak",    color: "#F59E0B", iconLib: "feather" as const },
    { icon: "star",     value: String(xp),               label: "Total XP",  color: colors.primary, iconLib: "feather" as const },
    { icon: "shield",   value: "Silver",                 label: "League",    color: "#94A3B8", iconLib: "feather" as const },
    { icon: "award",    value: String(programsCompleted), label: "Completed", color: "#F97316", iconLib: "feather" as const },
  ];

  const SECTIONS: SectionItem[][] = [
    [
      { icon: "grid",        label: "My Programs",    color: "#22C55E", onPress: () => router.push("/(tabs)/programs" as any) },
      { icon: "book-open",   label: "My Recipes",     color: "#F97316", onPress: () => router.push("/(tabs)/recipes" as any) },
      { icon: "activity",    label: "Health Profile", color: "#3B82F6", onPress: () => router.push("/health-profile") },
      { icon: "calendar",    label: "My Sessions",    color: "#8B5CF6", onPress: () => router.push("/my-sessions" as any) },
    ],
    [
      { icon: "shopping-bag", label: "My Orders",      color: "#2563EB", onPress: () => router.push("/my-orders" as any) },
      { icon: "file-text",    label: "Lab Reports",    color: "#DC2626", onPress: () => router.push("/(tabs)/resources/lab/reports" as any) },
      { icon: "file",         label: "Invoices",       color: "#6B7280", onPress: () => router.push("/invoices" as any) },
    ],
    [
      { icon: "users",          label: "Friends",   color: "#06B6D4", onPress: () => router.push("/search-friends") },
      { icon: "message-circle", label: "Messages",  color: "#22C55E", badge: totalUnread, onPress: () => router.push("/messages") },
      { icon: "bell",           label: "Notifications", color: "#F59E0B", onPress: () => router.push("/notifications") },
      { icon: "settings",       label: "Settings",  color: "#6B7280", onPress: () => router.push("/settings") },
    ],
    [
      { icon: "help-circle", label: "Help & Support", color: "#94A3B8", onPress: () => Alert.alert("Help & Support", "Contact us at support@vitale.app\n\nResponse within 24 hours. For urgent DPDP-related queries, email grievance@vitale.app") },
      { icon: "log-out",     label: "Log Out",        color: "#EF4444", danger: true, onPress: () => Alert.alert("Log Out", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Log Out", style: "destructive", onPress: () => {} }]) },
    ],
  ];

  if (booting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ProfileSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        <TouchableOpacity
          style={[styles.editIconBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push("/edit-profile")}
        >
          <Feather name="edit-2" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.avatarWrap, { backgroundColor: colors.primary }]} onPress={() => router.push("/edit-profile")}>
            <Text style={styles.avatarLetter}>A</Text>
            <View style={[styles.avatarCam, { backgroundColor: colors.card }]}>
              <Feather name="camera" size={11} color={colors.foreground} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.profileName, { color: colors.foreground }]}>Alex</Text>
          <Text style={[styles.memberSince, { color: colors.mutedForeground }]}>Member since May 2025</Text>
          <View style={[styles.leagueBadge, { backgroundColor: "#94A3B822" }]}>
            <MaterialCommunityIcons name="shield-star" size={13} color="#94A3B8" />
            <Text style={[styles.leagueText, { color: "#94A3B8" }]}>Silver League</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Badges</Text>
            <TouchableOpacity onPress={() => router.push("/badges")}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>View All ({badges.length}) →</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.badgesProgress, { borderColor: colors.border }]}>
            <View style={[styles.badgesProgressBar, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.badgesProgressFill,
                  { backgroundColor: colors.primary, width: `${(unlockedCount / badges.length) * 100}%` as any },
                ]}
              />
            </View>
            <Text style={[styles.badgesProgressText, { color: colors.mutedForeground }]}>
              {unlockedCount}/{badges.length} earned
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
            {badges.map((b) => <BadgeCircle key={b.id} badge={b} />)}
          </ScrollView>
        </View>

        {SECTIONS.map((group, gi) => (
          <View key={gi} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {group.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.sectionRow,
                  i < group.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: item.color + "20" }]}>
                  <Feather name={item.icon as any} size={17} color={item.danger ? item.color : item.color} />
                </View>
                <Text style={[styles.rowLabel, { color: item.danger ? "#EF4444" : colors.foreground }]}>
                  {item.label}
                </Text>
                {item.badge && item.badge > 0 ? (
                  <View style={[styles.rowBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.rowBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                {!item.danger && <Feather name="chevron-right" size={16} color={colors.border} />}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={styles.privacyNote}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
              Your health data is protected under the DPDP Act 2023. You control who sees your data.
            </Text>
            <TouchableOpacity onPress={() => Alert.alert("Privacy Policy", "Full policy at vitale.app/privacy")}>
              <Text style={[styles.privacyLink, { color: colors.primary }]}>Privacy Policy →</Text>
            </TouchableOpacity>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  editIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  profileCard: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 20, gap: 6 },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarLetter: { fontSize: 34, fontWeight: "900", color: "#fff" },
  avatarCam: {
    position: "absolute", bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  profileName: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  memberSince: { fontSize: 13 },
  leagueBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  leagueText: { fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statValue: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  section: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  viewAll: { fontSize: 13, fontWeight: "600" },
  badgesProgress: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  badgesProgressBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  badgesProgressFill: { height: "100%", borderRadius: 3 },
  badgesProgressText: { fontSize: 12, fontWeight: "600" },
  badgesScroll: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  badgeCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, position: "relative",
  },
  badgeLock: {
    position: "absolute", bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  sectionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  rowBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  rowBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  privacyNote: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 16, alignItems: "flex-start" },
  privacyText: { fontSize: 12, lineHeight: 18 },
  privacyLink: { fontSize: 12, fontWeight: "600", marginTop: 4 },
});
