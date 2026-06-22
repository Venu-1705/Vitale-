import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useNotifications, type AppNotification, type NotifType } from "@/context/NotificationContext";

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string }> = {
  meal_reminder:  { icon: "coffee",         color: "#F59E0B" },
  streak:         { icon: "zap",            color: "#F97316" },
  leaderboard:    { icon: "trending-up",    color: "#EC4899" },
  badge:          { icon: "star",           color: "#F59E0B" },
  session:        { icon: "calendar",       color: "#8B5CF6" },
  community:      { icon: "heart",          color: "#EF4444" },
  coach_message:  { icon: "message-circle", color: "#22C55E" },
  program_update: { icon: "book-open",      color: "#3B82F6" },
  weekly_summary: { icon: "bar-chart-2",    color: "#06B6D4" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function NotifCard({ notif }: { notif: AppNotification }) {
  const colors = useColors();
  const { markAsRead, dismiss } = useNotifications();
  const cfg = TYPE_CONFIG[notif.type];

  function handlePress() {
    markAsRead(notif.id);
    if (notif.route) router.push(notif.route as any);
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: notif.read ? colors.card : colors.primary + "08",
          borderColor: notif.read ? colors.border : colors.primary + "33",
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={[styles.typeIcon, { backgroundColor: cfg.color + "20" }]}>
        <Feather name={cfg.icon as any} size={18} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {notif.title}
          </Text>
          <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(notif.timestamp)}</Text>
        </View>
        <Text style={[styles.cardBody2, { color: colors.mutedForeground }]} numberOfLines={2}>
          {notif.body}
        </Text>
      </View>
      <View style={styles.cardRight}>
        {!notif.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        <TouchableOpacity onPress={() => dismiss(notif.id)} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAllAsRead, dismiss } = useNotifications();

  React.useEffect(() => {
    const timer = setTimeout(() => markAllAsRead(), 1500);
    return () => clearTimeout(timer);
  }, [markAllAsRead]);

  const now = Date.now();
  const todayStart = now - 24 * 3600000;
  const weekStart = now - 7 * 24 * 3600000;

  const today = notifications.filter((n) => n.timestamp >= todayStart);
  const thisWeek = notifications.filter((n) => n.timestamp >= weekStart && n.timestamp < todayStart);
  const earlier = notifications.filter((n) => n.timestamp < weekStart);

  function renderGroup(title: string, items: AppNotification[]) {
    if (items.length === 0) return null;
    return (
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{title}</Text>
        {items.map((n) => <NotifCard key={n.id} notif={n} />)}
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={[styles.markAllBtn, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No notifications yet.</Text>
          </View>
        ) : (
          <>
            {renderGroup("Today", today)}
            {renderGroup("This Week", thisWeek)}
            {renderGroup("Earlier", earlier)}
          </>
        )}
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
  markAllBtn: { fontSize: 13, fontWeight: "600" },
  group: { paddingHorizontal: 16, paddingTop: 18, gap: 8 },
  groupLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardBody: { flex: 1, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  cardTime: { fontSize: 11 },
  cardBody2: { fontSize: 13, lineHeight: 18 },
  cardRight: { alignItems: "center", gap: 6, flexShrink: 0 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  dismissBtn: { padding: 2 },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 14 },
});
