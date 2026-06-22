import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  useEnroll,
  useEnrollmentWatches,
  useMarkWatched,
  useMyEnrollments,
  useProgram,
  useProgramVersion,
  type Enrollment,
  type ProgramSnapshot,
  type SnapshotSession,
} from "@/lib/programs";
import {
  contentTypeStyle,
  formatDuration,
  toDisplayProgram,
} from "@/lib/programDisplay";
import { ConfettiBurst } from "@/components/ConfettiBurst";

type DetailSection = "about" | "curriculum" | "content";

const PAID_UNAVAILABLE_MESSAGE =
  "Paid program enrollment isn't available yet — online payments are still being implemented. Please check back soon.";

// ─── A single curriculum session row (used read-only and interactive) ─────────
function SnapshotSessionRow({
  session,
  accent,
  watched,
  onPress,
  busy,
}: {
  session: SnapshotSession;
  accent: string;
  /** undefined => read-only preview (no status chip). */
  watched?: boolean;
  onPress?: () => void;
  busy?: boolean;
}) {
  const colors = useColors();
  const style = contentTypeStyle(session.contentType);
  const dur = formatDuration(session.durationSeconds);

  return (
    <TouchableOpacity
      disabled={!onPress || busy}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sessRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.sessIcon, { backgroundColor: style.color + "18" }]}>
        <Feather name={style.icon as any} size={15} color={style.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sessTitle, { color: colors.foreground }]} numberOfLines={2}>
          {session.title}
        </Text>
        <View style={styles.sessMeta}>
          <Text style={[styles.sessMetaText, { color: style.color }]}>{style.label}</Text>
          {dur && (
            <>
              <Text style={[styles.sessDot, { color: colors.mutedForeground }]}>·</Text>
              <Text style={[styles.sessMetaText, { color: colors.mutedForeground }]}>{dur}</Text>
            </>
          )}
        </View>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={accent} />
      ) : watched === undefined ? null : watched ? (
        <View style={[styles.sessStatus, { backgroundColor: "#22C55E18" }]}>
          <Feather name="check" size={14} color="#22C55E" />
        </View>
      ) : onPress ? (
        <Feather name="play-circle" size={20} color={accent} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Curriculum (published version snapshot) ──────────────────────────────────
function SnapshotModules({
  snapshot,
  accent,
  loading,
  error,
  completedIds,
  onOpen,
  pendingId,
}: {
  snapshot: ProgramSnapshot | null;
  accent: string;
  loading: boolean;
  error: boolean;
  /** present => interactive (content) mode; absent => read-only preview. */
  completedIds?: Set<string>;
  onOpen?: (s: SnapshotSession) => void;
  pendingId?: string | null;
}) {
  const colors = useColors();

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }
  if (error || !snapshot || snapshot.modules.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="book" size={26} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {error
            ? "Couldn't load the curriculum. Please try again."
            : "The curriculum will appear here once the coach publishes content."}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {snapshot.modules.map((m, mi) => (
        <View key={m.id} style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.moduleHeader}>
            <View style={[styles.moduleIndex, { backgroundColor: accent + "20" }]}>
              <Text style={[styles.moduleIndexText, { color: accent }]}>{mi + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.moduleTitle, { color: colors.foreground }]}>{m.title}</Text>
              {m.description ? (
                <Text style={[styles.moduleDesc, { color: colors.mutedForeground }]}>{m.description}</Text>
              ) : null}
            </View>
            <Text style={[styles.moduleCount, { color: colors.mutedForeground }]}>
              {m.sessions.length} item{m.sessions.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {m.sessions.map((s) => (
              <SnapshotSessionRow
                key={s.id}
                session={s}
                accent={accent}
                watched={completedIds ? completedIds.has(s.id) : undefined}
                onPress={onOpen ? () => onOpen(s) : undefined}
                busy={pendingId === s.id}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Content tab (enrolled): snapshot + real watch/progress tracking ──────────
function ContentTab({
  snapshot,
  enrollment,
  accent,
  loading,
  error,
}: {
  snapshot: ProgramSnapshot | null;
  enrollment: Enrollment;
  accent: string;
  loading: boolean;
  error: boolean;
}) {
  const colors = useColors();
  const watchesQuery = useEnrollmentWatches(enrollment.id);
  const markWatched = useMarkWatched();

  const completedIds = useMemo(() => {
    const set = new Set<string>();
    for (const w of watchesQuery.data ?? []) if (w.completed) set.add(w.sessionId);
    return set;
  }, [watchesQuery.data]);

  const allSessions = useMemo(
    () => (snapshot?.modules ?? []).flatMap((m) => m.sessions),
    [snapshot],
  );
  const total = allSessions.length;
  const watchedCount = allSessions.filter((s) => completedIds.has(s.id)).length;
  // Server-authoritative progress (tg_rollup_progress recomputes on each watch).
  const progressPct = enrollment.progressPct;

  function handleOpen(s: SnapshotSession) {
    if (completedIds.has(s.id)) {
      Alert.alert("Opening content", `"${s.title}"`);
      return;
    }
    // No media player yet — opening a session records completion against the
    // real enrollment (drives progressPct via the backend rollup trigger).
    markWatched.mutate(
      {
        enrollmentId: enrollment.id,
        sessionId: s.id,
        watchedSeconds: s.durationSeconds ?? 0,
        completed: true,
      },
      {
        onError: (err: any) =>
          Alert.alert("Couldn't update progress", err?.message ?? "Please try again."),
      },
    );
    Alert.alert("Opening content", `"${s.title}"`);
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Progress overview */}
      <View style={[styles.lmsOverview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient
          colors={[accent + "18", accent + "04"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.lmsOverviewHeader}>
          <View>
            <Text style={[styles.lmsOverviewTitle, { color: colors.foreground }]}>Course Content</Text>
            <Text style={[styles.lmsOverviewSub, { color: colors.mutedForeground }]}>
              {watchedCount} of {total} completed
            </Text>
          </View>
          <View style={[styles.lmsCompletionCircle, { borderColor: accent + "40" }]}>
            <Text style={[styles.lmsCompletionPct, { color: accent }]}>{progressPct}%</Text>
            <Text style={[styles.lmsCompletionLabel, { color: colors.mutedForeground }]}>done</Text>
          </View>
        </View>
        <View style={[styles.lmsProgressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.lmsProgressFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
        </View>
        {enrollment.status === "completed" && (
          <View style={styles.lmsQuickStats}>
            <View style={styles.lmsQuickStat}>
              <Feather name="award" size={13} color="#22C55E" />
              <Text style={[styles.lmsQuickStatText, { color: "#22C55E", fontWeight: "700" }]}>
                Program completed
              </Text>
            </View>
          </View>
        )}
      </View>

      <SnapshotModules
        snapshot={snapshot}
        accent={accent}
        loading={loading || watchesQuery.isLoading}
        error={error}
        completedIds={completedIds}
        onOpen={handleOpen}
        pendingId={markWatched.isPending ? (markWatched.variables?.sessionId ?? null) : null}
      />
    </View>
  );
}

export default function ProgramDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();

  const programQuery = useProgram(id);
  const enrollmentsQuery = useMyEnrollments();
  const enroll = useEnroll();

  const program = programQuery.data;
  const display = program ? toDisplayProgram(program) : null;

  const enrollment = useMemo(
    () => (enrollmentsQuery.data ?? []).find((e) => e.programId === id) ?? null,
    [enrollmentsQuery.data, id],
  );
  const enrolled =
    !!enrollment && (enrollment.status === "active" || enrollment.status === "completed");

  // Published curriculum snapshot at the program's current version.
  const versionQuery = useProgramVersion(id, program?.currentVersion);
  const snapshot = versionQuery.data?.snapshot ?? null;

  const allSnapshotSessions = useMemo(
    () => (snapshot?.modules ?? []).flatMap((m) => m.sessions),
    [snapshot],
  );

  const [section, setSection] = useState<DetailSection>("about");
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Honor deep-link ?tab=content once enrollment is known.
  useEffect(() => {
    if (tab === "content" && enrolled) setSection("content");
  }, [tab, enrolled]);

  if (programQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (programQuery.isError || !program || !display) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 10 }}>
          {programQuery.isError ? "Couldn't load this program." : "Program not found"}
        </Text>
        <TouchableOpacity
          style={[styles.backLink, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = display.gradientStart;

  function handleEnroll() {
    if (!program || !display) return;
    if (!display.isFree) {
      Alert.alert("Enrollment unavailable", PAID_UNAVAILABLE_MESSAGE);
      return;
    }
    enroll.mutate(program.id, {
      onSuccess: () => {
        setConfettiTrigger((t) => t + 1);
        setShowSuccess(true);
        Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(successOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
            setShowSuccess(false);
            setSection("content");
          });
        }, 2600);
      },
      onError: (err: any) => {
        Alert.alert("Couldn't enroll", err?.message ?? "Something went wrong. Please try again.");
      },
    });
  }

  const SECTIONS: { key: DetailSection; label: string; enrolledOnly?: boolean }[] = [
    { key: "about", label: "About" },
    { key: "curriculum", label: "Curriculum" },
    { key: "content", label: "Content", enrolledOnly: true },
  ];
  const visibleSections = SECTIONS.filter((s) => !s.enrolledOnly || enrolled);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero gradient */}
        <LinearGradient
          colors={[display.gradientStart, display.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.heroNav, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
            <TouchableOpacity style={styles.heroBack} onPress={() => router.back()}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            {enrolled && (
              <View style={styles.enrolledChip}>
                <Feather name="check-circle" size={13} color="#22C55E" />
                <Text style={styles.enrolledChipText}>Enrolled</Text>
              </View>
            )}
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{program.title}</Text>
            <View style={styles.heroStats}>
              {display.durationWeeks != null && (
                <>
                  <View style={styles.heroStat}>
                    <Feather name="clock" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatText}>
                      {display.durationWeeks} week{display.durationWeeks > 1 ? "s" : ""}
                    </Text>
                  </View>
                  {allSnapshotSessions.length > 0 && <View style={styles.heroStatDot} />}
                </>
              )}
              {allSnapshotSessions.length > 0 && (
                <View style={styles.heroStat}>
                  <Feather name="play-circle" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroStatText}>
                    {allSnapshotSessions.length} session{allSnapshotSessions.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Progress banner for enrolled users */}
        {enrolled && enrollment && (
          <View style={[styles.progressBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}>
            <Feather name="activity" size={14} color={colors.primary} />
            <Text style={[styles.progressBannerText, { color: colors.primary }]}>
              Your progress: {enrollment.progressPct}% complete
            </Text>
            <View style={[styles.progressBannerBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBannerFill, { width: `${enrollment.progressPct}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        )}

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
          {visibleSections.map((s) => {
            const isActive = section === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.sectionTab, isActive && { borderBottomColor: accent, borderBottomWidth: 2.5 }]}
                onPress={() => setSection(s.key)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {s.key === "content" && (
                    <View style={[styles.contentTabDot, { backgroundColor: isActive ? accent : colors.primary }]} />
                  )}
                  <Text style={[styles.sectionTabText, { color: isActive ? accent : colors.mutedForeground }]}>
                    {s.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionContent}>
          {/* ── About ── */}
          {section === "about" && (
            <View style={{ gap: 18 }}>
              {program.description ? (
                <Text style={[styles.longDesc, { color: colors.foreground }]}>{program.description}</Text>
              ) : (
                <Text style={[styles.longDesc, { color: colors.mutedForeground }]}>
                  No description has been added for this program yet.
                </Text>
              )}

              {/* Honest at-a-glance facts (backend-backed only) */}
              <View style={[styles.factsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.factsRow}>
                  <Text style={[styles.factsLabel, { color: colors.mutedForeground }]}>Price</Text>
                  <Text style={[styles.factsValue, { color: display.isFree ? "#22C55E" : colors.foreground }]}>
                    {display.isFree ? "Free" : `₹${display.priceRupees.toLocaleString("en-IN")}`}
                  </Text>
                </View>
                {display.durationWeeks != null && (
                  <>
                    <View style={[styles.factsDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.factsRow}>
                      <Text style={[styles.factsLabel, { color: colors.mutedForeground }]}>Duration</Text>
                      <Text style={[styles.factsValue, { color: colors.foreground }]}>
                        {display.durationWeeks} week{display.durationWeeks > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </>
                )}
                {allSnapshotSessions.length > 0 && (
                  <>
                    <View style={[styles.factsDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.factsRow}>
                      <Text style={[styles.factsLabel, { color: colors.mutedForeground }]}>Content</Text>
                      <Text style={[styles.factsValue, { color: colors.foreground }]}>
                        {snapshot?.modules.length ?? 0} module{(snapshot?.modules.length ?? 0) !== 1 ? "s" : ""} ·{" "}
                        {allSnapshotSessions.length} session{allSnapshotSessions.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Truthful paid-enrollment notice (D8 payments deferred) */}
              {!enrolled && !display.isFree && (
                <View style={[styles.notice, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" }]}>
                  <Feather name="info" size={14} color="#B45309" />
                  <Text style={[styles.noticeText, { color: "#B45309" }]}>
                    Enrollment unavailable until payments are implemented. You can browse the full
                    curriculum below in the meantime.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Curriculum (read-only snapshot preview) ── */}
          {section === "curriculum" && (
            <View style={{ gap: 12 }}>
              <Text style={[styles.subsectionTitle, { color: colors.foreground }]}>Program Curriculum</Text>
              <SnapshotModules
                snapshot={snapshot}
                accent={accent}
                loading={versionQuery.isLoading}
                error={versionQuery.isError}
              />
            </View>
          )}

          {/* ── Content (enrolled, interactive) ── */}
          {section === "content" && enrolled && enrollment && (
            <ContentTab
              snapshot={snapshot}
              enrollment={enrollment}
              accent={accent}
              loading={versionQuery.isLoading}
              error={versionQuery.isError}
            />
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.stickyBottom, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.stickyBottomInner}>
          <View>
            <Text style={[styles.stickyPrice, { color: display.isFree ? "#22C55E" : colors.foreground }]}>
              {display.isFree ? "Free" : `₹${display.priceRupees.toLocaleString("en-IN")}`}
            </Text>
            {display.durationWeeks != null && (
              <Text style={[styles.stickyDuration, { color: colors.mutedForeground }]}>
                {display.durationWeeks} week{display.durationWeeks > 1 ? "s" : ""}
              </Text>
            )}
          </View>
          {enrolled ? (
            <TouchableOpacity
              style={[styles.enrollBtn, { backgroundColor: accent }]}
              onPress={() => setSection("content")}
            >
              <Feather name="play-circle" size={18} color="#fff" />
              <Text style={styles.enrollBtnText}>View Content</Text>
            </TouchableOpacity>
          ) : display.isFree ? (
            <TouchableOpacity
              style={[styles.enrollBtn, { backgroundColor: colors.primary, opacity: enroll.isPending ? 0.7 : 1 }]}
              onPress={handleEnroll}
              disabled={enroll.isPending}
            >
              {enroll.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.enrollBtnText}>Enroll Now</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.enrollBtn, styles.enrollBtnDisabled, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => Alert.alert("Enrollment unavailable", PAID_UNAVAILABLE_MESSAGE)}
            >
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <Text style={[styles.enrollBtnText, { color: colors.mutedForeground }]}>Unavailable</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ConfettiBurst trigger={confettiTrigger} />

      {showSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} pointerEvents="none">
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <LinearGradient colors={[display.gradientStart, display.gradientEnd]} style={styles.successIcon}>
              <Feather name="check" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>You're enrolled!</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              Welcome to {program.title}. Your learning content is ready!
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  backLink: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  loadingBox: { paddingVertical: 48, alignItems: "center", justifyContent: "center" },

  hero: { paddingBottom: 24 },
  heroNav: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  enrolledChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  enrolledChipText: { fontSize: 12, fontWeight: "700", color: "#22C55E" },
  heroContent: { paddingHorizontal: 20, gap: 12 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff", lineHeight: 32 },
  heroStats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroStatText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  heroStatDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.5)" },

  progressBanner: { margin: 16, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1, gap: 6 },
  progressBannerText: { fontSize: 13, fontWeight: "600" },
  progressBannerBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBannerFill: { height: "100%", borderRadius: 3 },

  sectionTabs: { paddingHorizontal: 16, paddingTop: 14, gap: 0 },
  sectionTab: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  sectionTabText: { fontSize: 14, fontWeight: "600" },
  contentTabDot: { width: 6, height: 6, borderRadius: 3 },
  sectionContent: { padding: 16, paddingTop: 14 },

  longDesc: { fontSize: 15, lineHeight: 24 },

  factsCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  factsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  factsLabel: { fontSize: 13, fontWeight: "500" },
  factsValue: { fontSize: 14, fontWeight: "700" },
  factsDivider: { height: 1 },

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  noticeText: { fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "500" },

  subsectionTitle: { fontSize: 16, fontWeight: "700" },

  // Modules / sessions (snapshot)
  moduleCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  moduleHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  moduleIndex: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  moduleIndexText: { fontSize: 12, fontWeight: "800" },
  moduleTitle: { fontSize: 15, fontWeight: "700" },
  moduleDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  moduleCount: { fontSize: 11, fontWeight: "600" },
  sessRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  sessIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sessTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  sessMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  sessMetaText: { fontSize: 11, fontWeight: "600" },
  sessDot: { fontSize: 11 },
  sessStatus: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  // Content overview
  lmsOverview: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, overflow: "hidden" },
  lmsOverviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  lmsOverviewTitle: { fontSize: 17, fontWeight: "800" },
  lmsOverviewSub: { fontSize: 12, marginTop: 3 },
  lmsCompletionCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  lmsCompletionPct: { fontSize: 16, fontWeight: "900" },
  lmsCompletionLabel: { fontSize: 9, fontWeight: "600", marginTop: -2 },
  lmsProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  lmsProgressFill: { height: "100%", borderRadius: 3 },
  lmsQuickStats: { flexDirection: "row", gap: 16 },
  lmsQuickStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  lmsQuickStatText: { fontSize: 12 },

  emptyBox: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  // Sticky bottom
  stickyBottom: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  stickyBottomInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stickyPrice: { fontSize: 22, fontWeight: "800" },
  stickyDuration: { fontSize: 12, marginTop: 1 },
  enrollBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, minWidth: 150, justifyContent: "center" },
  enrollBtnDisabled: { borderWidth: 1 },
  enrollBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  successOverlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  successCard: { borderRadius: 24, padding: 32, alignItems: "center", gap: 14, marginHorizontal: 32 },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontWeight: "800" },
  successSub: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
