import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApiSessions, type ApiCoachingSession, type Session, type SessionType } from "@/lib/sessions";
import { getUserId } from "@/lib/session";

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
import { useMyEnrollments, usePrograms, type Enrollment } from "@/lib/programs";
import { gradientForId, toDisplayProgram, type DisplayProgram } from "@/lib/programDisplay";
import { EmptyState } from "@/components/EmptyState";

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

// ─── Animated Progress Ring ───────────────────────────────────────────────────
function ProgressRing({ progress, size = 56, color }: { progress: number; size?: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 900, useNativeDriver: false, delay: 200 }).start();
  }, [progress]);

  const stroke = size * 0.1;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* background ring */}
      <View style={{
        position: "absolute", width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: color + "22",
      }} />
      {/* filled arc - approximate with a simple filled circle for web compat */}
      <View style={{
        position: "absolute", width: size * 0.78, height: size * 0.78, borderRadius: size,
        borderWidth: stroke, borderColor: color,
        borderTopColor: progress > 75 ? color : "transparent",
        borderRightColor: progress > 50 ? color : "transparent",
        borderBottomColor: progress > 25 ? color : "transparent",
        borderLeftColor: color,
        transform: [{ rotate: "-135deg" }],
      }} />
      <Text style={{ fontSize: size * 0.24, fontWeight: "800", color }}>{progress}%</Text>
    </View>
  );
}

// ─── Enrolled Program Card (Dashboard Style) ──────────────────────────────────
// Driven entirely by the learner's real enrollment row. Per-session unlock/drip
// state lives in the program detail screen (curriculum snapshot + watches); the
// dashboard summarises the enrollment with its server-computed progressPct.
function MyProgramCard({ enrollment }: { enrollment: Enrollment }) {
  const colors = useColors();
  const [gradientStart, gradientEnd] = gradientForId(enrollment.programId);
  const title = enrollment.programTitle ?? "Your Program";
  const progress = enrollment.progressPct;
  const isCompleted = enrollment.status === "completed";

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => router.push(`/program/${enrollment.programId}?tab=content` as any)}
        style={[styles.myCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* gradient header */}
        <LinearGradient
          colors={[gradientStart, gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.myCardHeader}
        >
          <View style={styles.myCardHeaderLeft}>
            {isCompleted && (
              <View style={[styles.myCardCatPill, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Text style={styles.myCardCatText}>Completed</Text>
              </View>
            )}
            <Text style={styles.myCardTitle} numberOfLines={2}>{title}</Text>
          </View>
          <ProgressRing progress={progress} color="#fff" size={64} />
        </LinearGradient>

        {/* progress bar */}
        <View style={styles.myCardProgressRow}>
          <View style={[styles.myCardProgressTrack, { backgroundColor: colors.muted }]}>
            <Animated.View style={[styles.myCardProgressFill, { width: `${progress}%`, backgroundColor: gradientStart }]} />
          </View>
          <TouchableOpacity
            style={[styles.myCardCTA, { backgroundColor: gradientStart }]}
            onPress={() => router.push(`/program/${enrollment.programId}?tab=content` as any)}
          >
            <Feather name={isCompleted ? "rotate-ccw" : "play"} size={12} color="#fff" />
            <Text style={styles.myCardCTAText}>{isCompleted ? "Review" : "Continue"}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Explore Program Card ─────────────────────────────────────────────────────
// Renders a real published program decorated via the presentation adapter. No
// fabricated coach/rating/review/enrolled-count data — only fields the backend
// actually carries (title, description, price, duration) plus a stable gradient.
function ProgramCard({
  program,
  enrolled,
  progress,
}: {
  program: DisplayProgram;
  enrolled: boolean;
  progress?: number;
}) {
  const colors = useColors();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => router.push(`/program/${program.id}`)}
        style={[styles.programCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <LinearGradient
          colors={[program.gradientStart, program.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }} />
            {enrolled && (
              <View style={[styles.enrolledPill, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Feather name="check" size={11} color="#22C55E" />
                <Text style={styles.enrolledPillText}>Enrolled</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{program.title}</Text>
          {program.durationWeeks != null && (
            <View style={styles.cardMeta}>
              <View style={styles.cardMetaItem}>
                <Feather name="clock" size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.cardMetaText}>
                  {program.durationWeeks} week{program.durationWeeks > 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <View style={styles.cardBody}>
          {program.description ? (
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
              {program.description}
            </Text>
          ) : null}
          <View style={styles.cardPriceRow}>
            {program.isFree ? (
              <Text style={[styles.priceText, { color: "#22C55E" }]}>Free</Text>
            ) : (
              <Text style={[styles.priceText, { color: colors.foreground }]}>
                ₹{program.priceRupees.toLocaleString("en-IN")}
              </Text>
            )}
            {enrolled && progress != null && (
              <Text style={[styles.progressPct, { color: colors.primary }]}>{progress}% done</Text>
            )}
          </View>
          {enrolled && progress != null && (
            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: "#22C55E" }]} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session }: { session: Session }) {
  const colors = useColors();
  const typeColor = SESSION_TYPE_COLORS[session.type];
  const isJoinable = !session.isPast && Date.now() >= session.dateTs - 5 * 60 * 1000;

  return (
    <TouchableOpacity
      style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/session/${session.id}`)}
      activeOpacity={0.88}
    >
      <View style={[styles.sessionTypeBar, { backgroundColor: typeColor }]} />
      <View style={styles.sessionCardBody}>
        <View style={styles.sessionCardTop}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{session.type}</Text>
          </View>
          {session.isPast && (
            <View style={[styles.attendBadge, { backgroundColor: session.attended ? "#22C55E20" : "#EF444420" }]}>
              <Feather name={session.attended ? "check-circle" : "x-circle"} size={11} color={session.attended ? "#22C55E" : "#EF4444"} />
              <Text style={[styles.attendBadgeText, { color: session.attended ? "#22C55E" : "#EF4444" }]}>
                {session.attended ? "Attended" : "Missed"}
              </Text>
            </View>
          )}
          {!session.isPast && session.registeredCount !== undefined && session.maxParticipants && (
            <Text style={[styles.regCount, { color: colors.mutedForeground }]}>
              {session.registeredCount}/{session.maxParticipants} registered
            </Text>
          )}
        </View>
        <Text style={[styles.sessionTitle, { color: colors.foreground }]}>{session.title}</Text>
        <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>{formatSessionDate(session.dateTs)}</Text>
        <Text style={[styles.sessionDuration, { color: colors.mutedForeground }]}>
          {session.durationMins} min  ·  {session.coachName}
        </Text>
        <View style={styles.sessionActions}>
          {session.isPast ? (
            session.recordingLink ? (
              <View style={[styles.recordingBtn, { borderColor: colors.border }]}>
                <Feather name="play-circle" size={14} color={colors.primary} />
                <Text style={[styles.recordingBtnText, { color: colors.primary }]}>Watch Recording</Text>
              </View>
            ) : (
              <Text style={[styles.noRecording, { color: colors.mutedForeground }]}>No recording available</Text>
            )
          ) : (
            <>
              <TouchableOpacity
                style={[styles.calendarBtn, { borderColor: colors.border }]}
                onPress={() => Alert.alert("Calendar", "Adding to your calendar...")}
              >
                <Feather name="calendar" size={14} color={colors.mutedForeground} />
                <Text style={[styles.calendarBtnText, { color: colors.mutedForeground }]}>Add to Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.joinBtn, { backgroundColor: isJoinable ? "#22C55E" : colors.muted }]}
                onPress={() => isJoinable
                  ? Alert.alert("Joining", "Opening session link...")
                  : Alert.alert("Not yet", "Join button activates 5 minutes before the session.")}
              >
                <Text style={[styles.joinBtnText, { color: isJoinable ? "#fff" : colors.mutedForeground }]}>
                  {isJoinable ? "Join Now" : "Scheduled"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

type SectionTab = "my-programs" | "explore" | "sessions";

export default function ProgramsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Real D3 program domain (published storefront + the caller's enrollments).
  const programsQuery = usePrograms();
  const enrollmentsQuery = useMyEnrollments();
  // Real coaching sessions (RLS already scopes to the caller; filter to this user as the
  // client per the spec). Coach-run sessions where the caller is the coach are excluded.
  const myId = getUserId();
  const upcomingSessionsQ = useApiSessions("upcoming");
  const pastSessionsQ = useApiSessions("past");
  const upcomingSessions = (upcomingSessionsQ.data ?? [])
    .filter((s) => s.clientUserId === myId)
    .map(mapApiSession);
  const pastSessions = (pastSessionsQ.data ?? [])
    .filter((s) => s.clientUserId === myId)
    .map(mapApiSession);

  const [sectionTab, setSectionTab] = useState<SectionTab>("my-programs");
  const [search, setSearch] = useState("");
  const [sessionTab, setSessionTab] = useState<"upcoming" | "past">("upcoming");

  const tabOrder: SectionTab[] = ["my-programs", "explore", "sessions"];

  const enrollments = useMemo(() => enrollmentsQuery.data ?? [], [enrollmentsQuery.data]);
  const myEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === "active" || e.status === "completed"),
    [enrollments],
  );
  const enrolledProgramIds = useMemo(
    () => new Set(enrollments.map((e) => e.programId)),
    [enrollments],
  );
  const progressByProgramId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enrollments) m.set(e.programId, e.progressPct);
    return m;
  }, [enrollments]);

  const programs: DisplayProgram[] = useMemo(
    () => (programsQuery.data ?? []).map(toDisplayProgram),
    [programsQuery.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [programs, search]);

  const sessionList = sessionTab === "upcoming" ? upcomingSessions : pastSessions;

  const TAB_LABELS: Record<SectionTab, string> = {
    "my-programs": "My Programs",
    explore: "Explore",
    sessions: "Sessions",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Programs</Text>
          {myEnrollments.length > 0 && (
            <View style={[styles.enrolledBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[styles.enrolledBadgeText, { color: colors.primary }]}>
                {myEnrollments.length} enrolled
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabOrder.map((tab) => {
          const isActive = sectionTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
              onPress={() => setSectionTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                {TAB_LABELS[tab]}
                {tab === "my-programs" && myEnrollments.length > 0 && (
                  <Text style={{ color: colors.primary }}> {myEnrollments.length}</Text>
                )}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ══ MY PROGRAMS TAB ══════════════════════════════════════════════════ */}
      {sectionTab === "my-programs" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 16 }}
        >
          {enrollmentsQuery.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : enrollmentsQuery.isError ? (
            <EmptyState
              mode="error"
              icon="alert-triangle"
              title="Couldn't load your programs"
              subtitle="Something went wrong fetching your enrollments. Please try again."
              actionLabel="Retry"
              onAction={() => enrollmentsQuery.refetch()}
            />
          ) : myEnrollments.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="No programs enrolled yet"
              subtitle="Discover a nutrition program tailored to your health goals and start your journey today."
              actionLabel="Explore Programs"
              onAction={() => setSectionTab("explore")}
            />
          ) : (
            <>
              <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
                Your Learning Dashboard
              </Text>
              {myEnrollments.map((e) => <MyProgramCard key={e.id} enrollment={e} />)}

              {/* Book a session CTA */}
              <TouchableOpacity
                style={[styles.bookSessionBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.85}
                onPress={() => setSectionTab("sessions")}
              >
                <LinearGradient
                  colors={["#22C55E22", "#3B82F622"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.bookBannerIcon, { backgroundColor: "#22C55E20" }]}>
                  <Feather name="calendar" size={20} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookBannerTitle, { color: colors.foreground }]}>Book a 1-on-1 Session</Text>
                  <Text style={[styles.bookBannerSub, { color: colors.mutedForeground }]}>
                    Schedule time with your coach for personalised guidance
                  </Text>
                </View>
                <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* ══ EXPLORE TAB ══════════════════════════════════════════════════════ */}
      {sectionTab === "explore" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search programs..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {programsQuery.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : programsQuery.isError ? (
            <EmptyState
              mode="error"
              icon="alert-triangle"
              title="Couldn't load programs"
              subtitle="Something went wrong fetching the program catalogue. Please try again."
              actionLabel="Retry"
              onAction={() => programsQuery.refetch()}
            />
          ) : (
            <>
              <View style={styles.resultCount}>
                <Text style={[styles.resultCountText, { color: colors.mutedForeground }]}>
                  {filtered.length} program{filtered.length !== 1 ? "s" : ""} found
                </Text>
              </View>

              <View style={styles.programList}>
                {filtered.map((p) => (
                  <ProgramCard
                    key={p.id}
                    program={p}
                    enrolled={enrolledProgramIds.has(p.id)}
                    progress={progressByProgramId.get(p.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <EmptyState
                    icon="search"
                    title="No programs found"
                    subtitle={
                      search.trim()
                        ? "Try a different search term to find the right program for you."
                        : "No published programs are available right now. Check back soon."
                    }
                    actionLabel={search.trim() ? "Clear Search" : undefined}
                    onAction={search.trim() ? () => setSearch("") : undefined}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ══ SESSIONS TAB ═════════════════════════════════════════════════════ */}
      {sectionTab === "sessions" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.innerToggle, { borderBottomColor: colors.border }]}>
            {(["upcoming", "past"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.innerToggleBtn, sessionTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
                onPress={() => setSessionTab(t)}
              >
                <Text style={[styles.innerToggleText, { color: sessionTab === t ? colors.primary : colors.mutedForeground }]}>
                  {t === "upcoming" ? `Upcoming (${upcomingSessions.length})` : `Past (${pastSessions.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }}>
            {sessionTab === "upcoming" && myEnrollments.length > 0 && (
              <TouchableOpacity
                style={[styles.bookCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.88}
                onPress={() =>
                  router.push(
                    `/book-session?programTitle=${encodeURIComponent(myEnrollments[0].programTitle ?? "Your Program")}` as any
                  )
                }
              >
                <View style={styles.bookCardLeft}>
                  <View style={[styles.bookCoachAvatar, { backgroundColor: "#22C55E20" }]}>
                    <Feather name="calendar" size={20} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookCardTitle, { color: colors.foreground }]}>Book a 1-on-1 Session</Text>
                    <Text style={[styles.bookCardSub, { color: colors.mutedForeground }]}>
                      with your coach
                    </Text>
                  </View>
                </View>
                <View style={[styles.bookNowBtn, { backgroundColor: colors.primary }]}>
                  <Feather name="calendar" size={13} color="#fff" />
                  <Text style={styles.bookNowText}>Book</Text>
                </View>
              </TouchableOpacity>
            )}
            {sessionList.length === 0 ? (
              <EmptyState
                icon="calendar"
                title={sessionTab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
                subtitle={
                  sessionTab === "upcoming"
                    ? myEnrollments.length === 0
                      ? "Enroll in a program to book sessions with your coach."
                      : "Book a session with your coach using the button above."
                    : "Your completed sessions will appear here."
                }
                actionLabel={sessionTab === "upcoming" && myEnrollments.length === 0 ? "Explore Programs" : undefined}
                onAction={sessionTab === "upcoming" && myEnrollments.length === 0 ? () => setSectionTab("explore") : undefined}
              />
            ) : (
              sessionList.map((s) => <SessionCard key={s.id} session={s} />)
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  enrolledBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  enrolledBadgeText: { fontSize: 12, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontWeight: "600" },
  sectionHeading: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  loadingBox: { paddingTop: 64, alignItems: "center", justifyContent: "center" },

  // My Program Card
  myCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  myCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 14 },
  myCardHeaderLeft: { flex: 1, gap: 6, paddingRight: 12 },
  myCardCatPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  myCardCatText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  myCardTitle: { fontSize: 18, fontWeight: "800", color: "#fff", lineHeight: 23 },
  myCardProgressRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingTop: 12 },
  myCardProgressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  myCardProgressFill: { height: "100%", borderRadius: 3 },
  myCardCTA: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  myCardCTAText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  bookSessionBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, overflow: "hidden",
  },
  bookBannerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bookBannerTitle: { fontSize: 14, fontWeight: "700" },
  bookBannerSub: { fontSize: 12, marginTop: 2 },

  // Explore cards
  programCard: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardGradient: { height: 118, padding: 14, justifyContent: "space-between" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  enrolledPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  enrolledPillText: { fontSize: 11, fontWeight: "700", color: "#22C55E" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#fff", lineHeight: 23 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  cardBody: { padding: 14, gap: 8 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardPriceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceText: { fontSize: 18, fontWeight: "800" },
  progressPct: { fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },

  // Search & filters
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  resultCount: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  resultCountText: { fontSize: 12 },
  programList: { paddingHorizontal: 16, paddingTop: 8, gap: 14, paddingBottom: 8 },

  // Session cards
  sessionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  sessionTypeBar: { width: 4 },
  sessionCardBody: { flex: 1, padding: 14, gap: 6 },
  sessionCardTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  attendBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  attendBadgeText: { fontSize: 11, fontWeight: "700" },
  regCount: { fontSize: 11, marginLeft: "auto" },
  sessionTitle: { fontSize: 16, fontWeight: "700" },
  sessionDate: { fontSize: 13, fontWeight: "500" },
  sessionDuration: { fontSize: 12 },
  sessionActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  calendarBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  calendarBtnText: { fontSize: 12, fontWeight: "600" },
  joinBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  joinBtnText: { fontSize: 13, fontWeight: "700" },
  recordingBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
  },
  recordingBtnText: { fontSize: 12, fontWeight: "600" },
  noRecording: { fontSize: 12 },
  innerToggle: { flexDirection: "row", borderBottomWidth: 1 },
  innerToggleBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  innerToggleText: { fontSize: 14, fontWeight: "600" },
  bookCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 12,
  },
  bookCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bookCoachAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bookCardTitle: { fontSize: 15, fontWeight: "700" },
  bookCardSub: { fontSize: 12, marginTop: 2 },
  bookNowBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  bookNowText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
