import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { HomeSkeleton } from "@/components/Skeleton";
import { useMeal, type MealType } from "@/context/MealContext";
import { useCommunity } from "@/context/CommunityContext";
import { useApiSessions, type SessionType } from "@/lib/sessions";
import { useMyEnrollments } from "@/lib/programs";
import { useNotifications } from "@/context/NotificationContext";
import QuickLogSheet from "@/components/QuickLogSheet";
import AskAIBubble from "@/components/AskAIBubble";

const DAILY_TIPS = [
  "Every meal logged is a step forward.",
  "Consistency beats perfection — always.",
  "Your coach is rooting for you.",
  "Small habits lead to big changes.",
  "Your streak is building momentum.",
  "Today's choices shape tomorrow.",
  "You're in the top performers this week.",
  "Nutrition is the foundation of health.",
  "One meal at a time. You've got this.",
  "Log it, don't guess it.",
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Wind down time";
}

function getTodayTip(): string {
  return DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
}

function StreakRing({ progress, size = 96 }: { progress: number; size?: number }) {
  const colors = useColors();
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));
  return (
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={sw} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#22C55E" strokeWidth={sw} fill="none"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

type NutriRingProps = {
  value: number; max: number; color: string;
  label: string; unit: string; size?: number;
  onPress?: () => void;
};
function NutriRing({ value, max, color, label, unit, size = 72, onPress }: NutriRingProps) {
  const colors = useColors();
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value / Math.max(max, 1), 1));
  const pct = Math.round((value / Math.max(max, 1)) * 100);

  return (
    <TouchableOpacity style={styles.ringCell} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={sw} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={sw} fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={[styles.ringValue, { color }]}>{value}</Text>
        <Text style={[styles.ringUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
      <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.ringPct, { color: pct >= 100 ? color : colors.mutedForeground }]}>
        {pct >= 100 ? "Done!" : `${pct}%`}
      </Text>
    </TouchableOpacity>
  );
}

function MealSlotRow({ mealType }: { mealType: MealType }) {
  const colors = useColors();
  const { todayMealPlan, getMealStatus } = useMeal();
  const plan = todayMealPlan.find((p) => p.id === mealType)!;
  const status = getMealStatus(mealType);

  const ICONS: Record<MealType, string> = {
    breakfast: "sunny-outline",
    lunch: "restaurant-outline",
    dinner: "moon-outline",
    snack: "nutrition-outline",
  };

  return (
    <TouchableOpacity
      style={[styles.mealSlot, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/meal/${mealType}`)}
      activeOpacity={0.75}
    >
      <View style={styles.mealSlotLeft}>
        <Text style={[styles.mealTime, { color: colors.mutedForeground }]}>{plan.time}</Text>
        <View style={[styles.mealIconWrap, { backgroundColor: colors.muted }]}>
          <Ionicons name={ICONS[mealType] as any} size={16} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mealTypeLabel, { color: colors.mutedForeground }]}>
            {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </Text>
          <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
            {plan.name}
          </Text>
        </View>
      </View>
      {status === "followed_plan" ? (
        <View style={[styles.statusBadge, { backgroundColor: "#22C55E20" }]}>
          <Feather name="check-circle" size={18} color="#22C55E" />
        </View>
      ) : status === "logged_alternative" ? (
        <View style={[styles.statusBadge, { backgroundColor: "#F59E0B20" }]}>
          <Feather name="edit-3" size={16} color="#F59E0B" />
        </View>
      ) : (
        <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
          <View style={[styles.statusCircle, { borderColor: colors.border }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 420);
    return () => clearTimeout(t);
  }, []);
  const { todayMealPlan, todayLog, streak, water, addWater, getCaloriesToday, getProteinToday, targets, isDietChartAssigned } = useMeal();
  const { posts } = useCommunity();
  const { data: upcomingApiSessions = [] } = useApiSessions("upcoming");
  const { data: enrollments = [] } = useMyEnrollments();
  const { unreadCount } = useNotifications();
  // First real upcoming session (or null → the widget below hides entirely; no mock).
  const nextApiSession = upcomingApiSessions[0] ?? null;
  const nextSession = nextApiSession
    ? {
        id: nextApiSession.id,
        title: nextApiSession.title,
        type: "1-on-1" as SessionType,
        dateTs: new Date(nextApiSession.scheduledAt).getTime(),
        timezone: "IST",
      }
    : null;
  const [showLogSheet, setShowLogSheet] = useState(false);

  const SESSION_TYPE_COLORS: Record<SessionType, string> = {
    "1-on-1": "#3B82F6",
    Group: "#8B5CF6",
    Workshop: "#14B8A6",
    Webinar: "#F97316",
    "In-Person": "#EF4444",
  };

  const mainMeals: MealType[] = ["breakfast", "lunch", "dinner"];
  const loggedMain = todayLog.filter((l) => mainMeals.includes(l.mealId as MealType)).length;
  const streakProgress = loggedMain / 3;
  const calToday = getCaloriesToday();
  const proteinToday = getProteinToday();

  const fibreToday = todayLog.reduce((sum, log) => {
    if (log.type === "followed_plan") {
      const p = todayMealPlan.find(m => m.id === log.mealId);
      return sum + (p?.nutrition.fiber ?? 0);
    }
    return sum;
  }, 0);
  const fibreTarget = 28;

  // Real D3 enrollment (camelized /my/enrollments row). The enrollment carries
  // programTitle + progressPct, but NOT coach identity or curriculum length —
  // those are separate, not-yet-built domains, so we render only what's backed.
  const activeEnrollment =
    enrollments.find((e) => e.status === "active") ??
    enrollments.find((e) => e.status === "completed") ??
    null;
  const enrollmentPct = activeEnrollment ? Math.round(activeEnrollment.progressPct) : 0;

  const tabBarH = Platform.OS === "web" ? 84 : 56 + insets.bottom;
  const fabBottom = tabBarH + 16;

  if (booting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>Alex</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
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
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>Alex</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={18} color={colors.foreground} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: "#EF4444" }]}>
                <Text style={styles.notifText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.avatarText}>A</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarH + 80 }}
      >
        <View style={[styles.motivationBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Feather name="zap" size={13} color={colors.primary} />
          <Text style={[styles.motivationText, { color: colors.mutedForeground }]}>{getTodayTip()}</Text>
        </View>

        <LinearGradient colors={["#dcfce7", "#f0fdf4", "#ffffff"]} style={styles.streakBanner}>
          <View style={styles.streakRingWrap}>
            <StreakRing progress={streakProgress} size={96} />
            <View style={styles.streakCenter}>
              <Ionicons name="flame" size={28} color="#F59E0B" />
            </View>
          </View>
          <View style={styles.streakInfo}>
            <View style={styles.streakCountRow}>
              <Text style={[styles.streakCount, { color: colors.foreground }]}>{streak}</Text>
              <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>{" "}day streak</Text>
            </View>
            <Text style={[styles.streakSub, { color: colors.mutedForeground }]}>
              {loggedMain}/3 meals logged today
            </Text>
            {streak === 0 && (
              <Text style={[styles.streakMotivation, { color: colors.primary }]}>
                Start your streak today!
              </Text>
            )}
          </View>
          <View style={[styles.leaguePill, { backgroundColor: "#94A3B822" }]}>
            <MaterialCommunityIcons name="shield-star" size={14} color="#94A3B8" />
            <Text style={[styles.leagueText, { color: "#94A3B8" }]}>Silver</Text>
          </View>
        </LinearGradient>

        {activeEnrollment && (
          <TouchableOpacity
            style={[styles.programCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/program/${activeEnrollment.programId}` as any)}
            activeOpacity={0.85}
          >
            <View style={styles.programCardLeft}>
              <View style={styles.programMiniRingWrap}>
                <Svg width={40} height={40}>
                  <Circle cx={20} cy={20} r={16} stroke={colors.border} strokeWidth={4} fill="none" />
                  <Circle
                    cx={20} cy={20} r={16}
                    stroke="#22C55E" strokeWidth={4} fill="none"
                    strokeDasharray={`${2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - Math.min(enrollmentPct / 100, 1))}
                    strokeLinecap="round"
                    transform="rotate(-90 20 20)"
                  />
                </Svg>
                <View style={StyleSheet.absoluteFill as any}>
                  <Text style={[styles.programMiniPct, { color: colors.primary }]}>{enrollmentPct}%</Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.programName, { color: colors.foreground }]} numberOfLines={1}>
                  {activeEnrollment.programTitle ?? "Your Program"}
                </Text>
                <Text style={[styles.programDay, { color: colors.mutedForeground }]}>
                  {activeEnrollment.status === "completed" ? "Completed" : `${enrollmentPct}% complete`}
                </Text>
              </View>
            </View>
            <View style={[styles.continueBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.continueBtnText}>
                {activeEnrollment.status === "completed" ? "Review" : "Continue"}
              </Text>
              <Feather name="arrow-right" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        <View style={[styles.ringsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.ringsTitle, { color: colors.foreground }]}>Today's Stats</Text>
          <View style={styles.ringsRow}>
            <NutriRing value={calToday} max={targets.calories} color="#22C55E" label="Calories" unit="kcal" />
            <NutriRing value={proteinToday} max={targets.protein} color="#3B82F6" label="Protein" unit="g" />
            <NutriRing value={water} max={8} color="#06B6D4" label="Water" unit="gl" onPress={addWater} />
            <NutriRing value={fibreToday} max={fibreTarget} color="#F97316" label="Fibre" unit="g" />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Plan</Text>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </Text>
            </View>
            <View style={[styles.coachAvatar, { backgroundColor: colors.primary + "33" }]}>
              <Text style={[styles.coachInitial, { color: colors.primary }]}>Dr</Text>
            </View>
          </View>

          {!isDietChartAssigned && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 10, padding: 10, marginBottom: 4 }}>
              <Feather name="info" size={15} color={colors.mutedForeground} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground }}>
                No diet chart assigned yet — ask your coach. Showing a sample plan.
              </Text>
            </View>
          )}

          {todayMealPlan.map((p) => (
            <MealSlotRow key={p.id} mealType={p.id} />
          ))}

          <View style={styles.adherenceRow}>
            <Text style={[styles.adherenceText, { color: colors.mutedForeground }]}>
              Adherence today:{" "}
              <Text style={{ fontWeight: "700", color: loggedMain > 0 ? colors.primary : colors.foreground }}>
                {loggedMain}/{todayMealPlan.length} meals
              </Text>
            </Text>
            <View style={[styles.adherenceBar, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.adherenceBarFill,
                  {
                    width: `${(loggedMain / todayMealPlan.length) * 100}%`,
                    backgroundColor: loggedMain === todayMealPlan.length ? colors.primary : "#F59E0B",
                  },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.weeklyLink} onPress={() => router.push("/weekly-report")}>
            <Feather name="bar-chart-2" size={14} color={colors.primary} />
            <Text style={[styles.weeklyLinkText, { color: colors.primary }]}>View Weekly Report</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {nextSession && (
          <TouchableOpacity
            style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/session/${nextSession.id}`)}
            activeOpacity={0.88}
          >
            <View style={styles.sessionCardLeft}>
              <View style={[styles.sessionTypePill, { backgroundColor: SESSION_TYPE_COLORS[nextSession.type] + "22" }]}>
                <Text style={[styles.sessionTypeText, { color: SESSION_TYPE_COLORS[nextSession.type] }]}>{nextSession.type}</Text>
              </View>
              <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>{nextSession.title}</Text>
              <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                {new Date(nextSession.dateTs).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                {"  ·  "}
                {new Date(nextSession.dateTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} {nextSession.timezone}
              </Text>
            </View>
            <View style={[styles.sessionJoinBtn, { backgroundColor: colors.primary }]}>
              <Feather name="video" size={14} color="#fff" />
              <Text style={styles.sessionJoinText}>View</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Community</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/community")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {posts.slice(0, 2).map((post) => (
            <TouchableOpacity
              key={post.id}
              style={[styles.communityRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/post/${post.id}`)}
            >
              <View style={[styles.communityDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.communityUser, { color: colors.foreground }]}>
                  {post.userName}
                  {post.isCoach && <Text style={{ color: colors.primary, fontSize: 11 }}> · Coach</Text>}
                </Text>
                <Text style={[styles.communityText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {post.content}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: fabBottom }]}
        onPress={() => setShowLogSheet(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <AskAIBubble />

      <QuickLogSheet visible={showLogSheet} onClose={() => setShowLogSheet(false)} />
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
  greeting: { fontSize: 13 },
  userName: { fontSize: 22, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  notifBadge: {
    position: "absolute", top: 1, right: 1, minWidth: 14, height: 14,
    borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
  },
  notifText: { fontSize: 8, fontWeight: "800", color: "#fff" },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  motivationBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  motivationText: { fontSize: 12, fontStyle: "italic", flex: 1 },
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    gap: 14,
  },
  streakRingWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  streakCenter: { position: "absolute" },
  streakInfo: { flex: 1 },
  streakCountRow: { flexDirection: "row", alignItems: "baseline" },
  streakCount: { fontSize: 38, fontWeight: "900" },
  streakLabel: { fontSize: 16, fontWeight: "500" },
  streakSub: { fontSize: 13, marginTop: 2 },
  streakMotivation: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  leaguePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  leagueText: { fontSize: 11, fontWeight: "700" },
  programCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  programCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  programMiniRingWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  programMiniPct: { fontSize: 9, fontWeight: "800", textAlign: "center", width: "100%", marginTop: 14 },
  programName: { fontSize: 14, fontWeight: "700" },
  programDay: { fontSize: 12 },
  coachRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  coachDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  coachDotText: { fontSize: 8, fontWeight: "700" },
  coachName: { fontSize: 11 },
  continueBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  continueBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  ringsCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  ringsTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  ringsRow: { flexDirection: "row", justifyContent: "space-around" },
  ringCell: { alignItems: "center", gap: 6 },
  ringValue: { fontSize: 14, fontWeight: "800" },
  ringUnit: { fontSize: 9, textAlign: "center" },
  ringLabel: { fontSize: 11, fontWeight: "600" },
  ringPct: { fontSize: 10, fontWeight: "700" },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDate: { fontSize: 12, marginTop: 1 },
  coachAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  coachInitial: { fontSize: 11, fontWeight: "700" },
  mealSlot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mealSlotLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  mealTime: { fontSize: 11, width: 50 },
  mealIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  mealTypeLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  mealName: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  statusBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  adherenceRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 6 },
  adherenceText: { fontSize: 12 },
  adherenceBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  adherenceBarFill: { height: "100%", borderRadius: 2 },
  weeklyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  weeklyLinkText: { fontSize: 13, fontWeight: "600", flex: 1 },
  seeAll: { fontSize: 13, fontWeight: "600" },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  communityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  communityUser: { fontSize: 13, fontWeight: "600" },
  communityText: { fontSize: 12, marginTop: 1 },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sessionCardLeft: { flex: 1, gap: 4 },
  sessionTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  sessionTypeText: { fontSize: 11, fontWeight: "700" },
  sessionTitle: { fontSize: 15, fontWeight: "700" },
  sessionMeta: { fontSize: 12 },
  sessionJoinBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  sessionJoinText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
});
