import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { useApiSessions, type ApiCoachingSession, type Session, type SessionType } from "@/lib/sessions";

/** Map a real backend session onto the card's `Session` shape (honest defaults). */
function mapApiSession(s: ApiCoachingSession): Session {
  const dateTs = new Date(s.scheduledAt).getTime();
  return {
    id: s.id,
    title: s.title,
    type: "1-on-1",
    dateTs,
    durationMins: s.durationMinutes,
    timezone: "IST",
    coachName: "Your Coach",
    description: s.description ?? "",
    materials: [],
    isPast: s.status === "completed" || s.status === "cancelled" || dateTs < Date.now(),
    attended: s.status === "completed" ? true : undefined,
    zoomLink: s.zoomJoinUrl ?? undefined,
  };
}

const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  "1-on-1": "#3B82F6",
  Group: "#8B5CF6",
  Workshop: "#14B8A6",
  Webinar: "#F97316",
  "In-Person": "#EF4444",
};

function formatSessionDate(ts: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day}  ·  ${time} IST`;
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "Started";
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `in ${d} day${d > 1 ? "s" : ""}`;
  if (h > 0) return `in ${h}h`;
  const m = Math.floor(diff / 60000);
  return `in ${m}m`;
}

function SessionCard({ session }: { session: Session }) {
  const colors = useColors();
  const typeColor = SESSION_TYPE_COLORS[session.type];
  const isJoinable = !session.isPast && Date.now() >= session.dateTs - 5 * 60 * 1000;
  const untilLabel = !session.isPast ? timeUntil(session.dateTs) : null;

  return (
    <TouchableOpacity
      style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/session/${session.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={styles.sessionTop}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{session.type}</Text>
        </View>
        {session.isPast ? (
          <View style={[styles.statusBadge, { backgroundColor: session.attended ? "#22C55E20" : "#EF444420" }]}>
            <Feather name={session.attended ? "check-circle" : "x-circle"} size={12} color={session.attended ? "#22C55E" : "#EF4444"} />
            <Text style={[styles.statusText, { color: session.attended ? "#22C55E" : "#EF4444" }]}>
              {session.attended ? "Attended" : "Missed"}
            </Text>
          </View>
        ) : untilLabel ? (
          <View style={[styles.statusBadge, { backgroundColor: isJoinable ? "#22C55E20" : colors.muted }]}>
            <Text style={[styles.statusText, { color: isJoinable ? "#22C55E" : colors.mutedForeground }]}>
              {isJoinable ? "Join now" : untilLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.sessionTitle, { color: colors.foreground }]}>{session.title}</Text>
      <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>{formatSessionDate(session.dateTs)}</Text>

      <View style={styles.sessionMeta}>
        <Feather name="user" size={12} color={colors.mutedForeground} />
        <Text style={[styles.sessionMetaText, { color: colors.mutedForeground }]}>{session.coachName}</Text>
        <Text style={[styles.sessionMetaDot, { color: colors.border }]}>·</Text>
        <Feather name="clock" size={12} color={colors.mutedForeground} />
        <Text style={[styles.sessionMetaText, { color: colors.mutedForeground }]}>{session.durationMins} min</Text>
      </View>

      {session.isPast ? (
        <View style={styles.sessionActions}>
          {session.recordingLink ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.primary }]}
              onPress={() => Alert.alert("Recording", "Opening session recording...")}
            >
              <Feather name="play-circle" size={14} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Watch Recording</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.noRecording, { color: colors.mutedForeground }]}>No recording available</Text>
          )}
          {session.sessionNotes && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => Alert.alert("Session Notes", session.sessionNotes ?? "")}
            >
              <Feather name="file-text" size={14} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>View Notes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.sessionActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={() => Alert.alert("Calendar", "Adding to your calendar...")}
          >
            <Feather name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Add to Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: isJoinable ? "#22C55E" : colors.muted }]}
            onPress={() =>
              isJoinable
                ? Alert.alert("Joining", "Opening session link...")
                : Alert.alert("Too early", "The join button activates 5 minutes before the session.")
            }
          >
            <Text style={[styles.joinBtnText, { color: isJoinable ? "#fff" : colors.mutedForeground }]}>
              {isJoinable ? "Join Now" : "Scheduled"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ tab }: { tab: "upcoming" | "past" }) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <Feather name="calendar" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {tab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
      </Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {tab === "upcoming"
          ? "No upcoming sessions. Your coach will schedule one soon."
          : "Your attended and missed sessions will appear here."}
      </Text>
      {tab === "upcoming" && (
        <TouchableOpacity
          style={[styles.goBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/programs" as any)}
        >
          <Text style={styles.goBtnText}>Go to Programs</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function MySessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const upcomingQ = useApiSessions("upcoming");
  const pastQ = useApiSessions("past");
  const upcomingSessions = (upcomingQ.data ?? []).map(mapApiSession);
  const pastSessions = (pastQ.data ?? []).map(mapApiSession);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const list = tab === "upcoming" ? upcomingSessions : pastSessions;
  const isLoading = tab === "upcoming" ? upcomingQ.isLoading : pastQ.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Sessions</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["upcoming", "past"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "upcoming"
                ? `Upcoming (${upcomingSessions.length})`
                : `Past (${pastSessions.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
      >
        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border, height: 120, opacity: 0.5 }]} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          list.map((s) => <SessionCard key={s.id} session={s} />)
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
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  sessionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  sessionTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },
  sessionTitle: { fontSize: 16, fontWeight: "700" },
  sessionDate: { fontSize: 13, fontWeight: "500" },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionMetaText: { fontSize: 12 },
  sessionMetaDot: { fontSize: 12, marginHorizontal: 2 },
  sessionActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  noRecording: { fontSize: 12 },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  joinBtnText: { fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  goBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  goBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
