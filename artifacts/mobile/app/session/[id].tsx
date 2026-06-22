import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApiSession, type ApiCoachingSession, type Session, type SessionType } from "@/lib/sessions";

/** Map a real backend session onto the shape this screen renders. */
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

const SESSION_TYPE_ICONS: Record<SessionType, string> = {
  "1-on-1": "person",
  Group: "people",
  Workshop: "hammer",
  Webinar: "desktop",
  "In-Person": "location",
};

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatEndTime(ts: number, durationMins: number): string {
  return formatTime(ts + durationMins * 60000);
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)}>
          <Ionicons name={i <= value ? "star" : "star-outline"} size={28} color="#F59E0B" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SessionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Real backend session (carries the persisted Zoom join URL).
  const { data: apiSession, isLoading } = useApiSession(id);
  const session = apiSession ? mapApiSession(apiSession) : undefined;
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>
          {isLoading ? "Loading…" : "Session not found"}
        </Text>
      </View>
    );
  }

  const typeColor = SESSION_TYPE_COLORS[session.type];
  const typeIcon = SESSION_TYPE_ICONS[session.type];
  // The persisted Zoom join URL (real sessions) gates the Join button. Tapping it
  // deep-links into the Zoom app if installed, else opens zoom.us in the browser.
  const zoomJoinUrl = session.zoomLink ?? null;
  const showJoinBar = !session.isPast;

  const joinZoom = () => {
    if (!zoomJoinUrl) return;
    Linking.openURL(zoomJoinUrl).catch(() =>
      Alert.alert("Couldn't open Zoom", "Please install the Zoom app or try again."),
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Session Details</Text>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() =>
            Alert.alert("Options", undefined, [
              { text: "Cancel Registration", style: "destructive", onPress: () => Alert.alert("Cancelled", "Registration cancelled.") },
              { text: "Cancel", style: "cancel" },
            ])
          }
        >
          <Feather name="more-horizontal" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (showJoinBar ? 100 : 40) }}
      >
        <View style={[styles.heroSection, { backgroundColor: typeColor + "18", borderBottomColor: typeColor + "33" }]}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "25" }]}>
            <Ionicons name={typeIcon as any} size={14} color={typeColor} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{session.type}</Text>
          </View>
          <Text style={[styles.sessionTitle, { color: colors.foreground }]}>{session.title}</Text>

          {session.isPast && (
            <View style={[styles.attendanceBadge, {
              backgroundColor: session.attended ? "#22C55E22" : "#EF444422"
            }]}>
              <Feather
                name={session.attended ? "check-circle" : "x-circle"}
                size={14}
                color={session.attended ? "#22C55E" : "#EF4444"}
              />
              <Text style={[styles.attendanceText, { color: session.attended ? "#22C55E" : "#EF4444" }]}>
                {session.attended ? "You attended this session" : "You missed this session"}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "calendar", label: "Date", value: formatFullDate(session.dateTs) },
            { icon: "clock", label: "Time", value: `${formatTime(session.dateTs)} – ${formatEndTime(session.dateTs, session.durationMins)} ${session.timezone}` },
            { icon: "activity", label: "Duration", value: `${session.durationMins} minutes` },
            { icon: "user", label: "Coach", value: session.coachName },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[styles.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.infoIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name={row.icon as any} size={15} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            </View>
          ))}
          {session.maxParticipants && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name="users" size={15} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Participants</Text>
                <View style={styles.participantRow}>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {session.registeredCount} / {session.maxParticipants} registered
                  </Text>
                  <View style={[styles.regBar, { backgroundColor: colors.muted }]}>
                    <View
                      style={[styles.regBarFill, {
                        width: `${Math.round((session.registeredCount! / session.maxParticipants) * 100)}%`,
                        backgroundColor: typeColor,
                      }]}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Description</Text>
          <Text style={[styles.descriptionText, { color: colors.foreground }]}>{session.description}</Text>
        </View>

        {session.materials.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Materials</Text>
            {session.materials.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.materialRow, i < session.materials.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => Alert.alert("Download", `Downloading ${m.name}...`)}
              >
                <View style={[styles.materialIcon, { backgroundColor: "#EF444422" }]}>
                  <MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.materialName, { color: colors.foreground }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.materialSize, { color: colors.mutedForeground }]}>{m.size}</Text>
                </View>
                <Feather name="download" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {session.isPast && session.recordingLink && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recording</Text>
            <TouchableOpacity
              style={[styles.recordingBtn, { backgroundColor: "#EF444422", borderColor: "#EF444433" }]}
              onPress={() => Alert.alert("Recording", "Opening recording...")}
            >
              <View style={[styles.recordingPlay, { backgroundColor: "#EF4444" }]}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
              <Text style={[styles.recordingText, { color: colors.foreground }]}>Watch Session Recording</Text>
              <Feather name="external-link" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {session.isPast && session.sessionNotes && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Session Notes</Text>
            <Text style={[styles.sessionNotesText, { color: colors.foreground }]}>{session.sessionNotes}</Text>
          </View>
        )}

        {session.isPast && session.attended && !ratingSubmitted && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Rate this Session</Text>
            <Text style={[styles.rateSubtitle, { color: colors.mutedForeground }]}>How would you rate your experience?</Text>
            <StarRatingInput value={ratingValue} onChange={setRatingValue} />
            {ratingValue > 0 && (
              <TouchableOpacity
                style={[styles.submitRatingBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setRatingSubmitted(true);
                  Alert.alert("Thank you!", "Your rating has been submitted.");
                }}
              >
                <Text style={styles.submitRatingText}>Submit Rating</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {session.isPast && ratingSubmitted && (
          <View style={[styles.section, { backgroundColor: "#22C55E15", borderColor: "#22C55E33" }]}>
            <View style={styles.ratingThanks}>
              <Feather name="check-circle" size={18} color="#22C55E" />
              <Text style={[styles.ratingThanksText, { color: "#22C55E" }]}>Thank you for your feedback!</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {showJoinBar && (
        <View style={[styles.stickyBottom, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.calBtn, { borderColor: colors.border }]}
            onPress={() => Alert.alert("Calendar", "Adding to your calendar...")}
          >
            <Feather name="calendar" size={16} color={colors.foreground} />
            <Text style={[styles.calBtnText, { color: colors.foreground }]}>Add to Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: zoomJoinUrl ? "#22C55E" : colors.muted }]}
            disabled={!zoomJoinUrl}
            onPress={joinZoom}
          >
            <Ionicons name="videocam" size={16} color={zoomJoinUrl ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.joinBtnText, { color: zoomJoinUrl ? "#fff" : colors.mutedForeground }]}>
              {zoomJoinUrl ? "Join Session" : "Zoom link not ready yet"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  backBtn: { width: 38 },
  navTitle: { fontSize: 16, fontWeight: "700" },
  menuBtn: { width: 38, alignItems: "flex-end" },
  heroSection: { padding: 20, gap: 10, borderBottomWidth: 1 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start" },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },
  sessionTitle: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  attendanceBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start" },
  attendanceText: { fontSize: 13, fontWeight: "600" },
  infoCard: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  infoIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  participantRow: { gap: 6 },
  regBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  regBarFill: { height: "100%", borderRadius: 2 },
  section: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  materialRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  materialIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  materialName: { fontSize: 13, fontWeight: "600" },
  materialSize: { fontSize: 11, marginTop: 1 },
  recordingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  recordingPlay: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  recordingText: { flex: 1, fontSize: 14, fontWeight: "600" },
  sessionNotesText: { fontSize: 14, lineHeight: 22 },
  rateSubtitle: { fontSize: 13 },
  submitRatingBtn: { paddingVertical: 12, borderRadius: 12, alignItems: "center", marginTop: 4 },
  submitRatingText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  ratingThanks: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingThanksText: { fontSize: 14, fontWeight: "600" },
  stickyBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  calBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  calBtnText: { fontSize: 14, fontWeight: "600" },
  joinBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  joinBtnText: { fontSize: 15, fontWeight: "700" },
});
