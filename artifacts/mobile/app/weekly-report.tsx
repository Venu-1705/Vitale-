import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMeal, type DayData, type WeekSummary } from "@/context/MealContext";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayColor(mealsLogged: number): string {
  if (mealsLogged >= 2) return "#22C55E";
  if (mealsLogged === 1) return "#F59E0B";
  return "#D1D5DB";
}

function AdherenceChart({ days }: { days: DayData[] }) {
  const colors = useColors();
  return (
    <View style={styles.chartContainer}>
      {days.map((day, i) => {
        const pct = Math.round((day.mealsLogged / 3) * 100);
        const color = dayColor(day.mealsLogged);
        const label = DAY_LABELS[i];
        return (
          <View key={i} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.barPct, { color: day.mealsLogged > 0 ? colors.foreground : colors.mutedForeground }]}>
              {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function NutritionBar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const colors = useColors();
  const ratio = value / target;
  const pct = Math.min(ratio, 1.3);
  const diff = Math.abs(ratio - 1);
  const barColor = diff <= 0.1 ? "#22C55E" : diff <= 0.25 ? "#F59E0B" : "#EF4444";

  return (
    <View style={styles.nutritionBar}>
      <View style={styles.nutritionBarHeader}>
        <Text style={[styles.nutritionBarLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.nutritionBarValue, { color: colors.mutedForeground }]}>
          {value}{unit} / {target}{unit}
        </Text>
      </View>
      <View style={[styles.nutritionBarTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[styles.nutritionBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]}
        />
        <View style={[styles.nutritionBarTarget, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

function Sparkline({ data, width = 200, height = 40 }: { data: number[]; width?: number; height?: number }) {
  const colors = useColors();
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pad = 4;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - v / max) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = pad + (1 - v / max) * (height - pad * 2);
        return <Circle key={i} cx={x} cy={y} r={3} fill={colors.primary} />;
      })}
    </Svg>
  );
}

function DeltaBadge({ value, unit = "" }: { value: number; unit?: string }) {
  if (value === 0) return <Text style={{ color: "#94A3B8", fontSize: 13 }}>—</Text>;
  const positive = value > 0;
  const color = positive ? "#22C55E" : "#EF4444";
  return (
    <View style={[styles.deltaBadge, { backgroundColor: color + "18" }]}>
      <Feather name={positive ? "arrow-up" : "arrow-down"} size={11} color={color} />
      <Text style={[styles.deltaText, { color }]}>
        {Math.abs(value)}{unit}
      </Text>
    </View>
  );
}

function generateInsights(week: WeekSummary, prevWeek: WeekSummary | null): string[] {
  const insights: string[] = [];
  const completedDays = week.days.filter((d) => d.completed).length;

  const breakfastDays = week.days.filter((d) => d.mealsLogged >= 1).length;
  if (breakfastDays >= 5) {
    insights.push(`You stayed consistent ${breakfastDays}/7 days this week — great discipline!`);
  }

  const missedDays = week.days.filter((d) => d.mealsLogged === 0).length;
  if (missedDays >= 2) {
    insights.push(`You missed ${missedDays} full days. Try prepping meals the night before.`);
  }

  if (prevWeek) {
    const protDiff = week.avgProtein - prevWeek.avgProtein;
    if (protDiff > 3) {
      insights.push(`Protein intake up ${protDiff}g vs. last week — your muscles will thank you!`);
    } else if (protDiff < -3) {
      insights.push(`Protein is down ${Math.abs(protDiff)}g vs. last week. Add a protein-rich snack.`);
    }

    const calDiff = week.avgCalories - prevWeek.avgCalories;
    if (Math.abs(calDiff) > 50) {
      insights.push(`Average calories ${calDiff > 0 ? "increased" : "decreased"} by ${Math.abs(calDiff)} kcal vs. last week.`);
    }
  }

  const perfectDays = week.days.filter((d) => d.mealsLogged === 3).length;
  if (perfectDays >= 4) {
    insights.push(`${perfectDays} perfect days this week — you are building a strong habit!`);
  }

  if (insights.length === 0) {
    insights.push("Keep logging consistently to unlock detailed meal pattern insights.");
  }

  return insights.slice(0, 3);
}

export default function WeeklyReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { weeklyHistory, streak, longestStreak } = useMeal();
  const [weekOffset, setWeekOffset] = useState(0);

  const week = weeklyHistory[weekOffset];
  const prevWeek = weekOffset < weeklyHistory.length - 1 ? weeklyHistory[weekOffset + 1] : null;

  if (!week) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>No data available</Text>
      </View>
    );
  }

  const weekStartDate = new Date(week.weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  const weekLabel = `${weekStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const insights = generateInsights(week, prevWeek);
  const streakSparkline = weeklyHistory.slice().reverse().map((w) => w.streakAtEnd);

  const prevAdherence = prevWeek?.adherencePct ?? 0;
  const prevCalories = prevWeek?.avgCalories ?? 0;
  const prevProtein = prevWeek?.avgProtein ?? 0;
  const prevMealsLogged = prevWeek?.days.reduce((s, d) => s + d.mealsLogged, 0) ?? 0;
  const thisMealsLogged = week.days.reduce((s, d) => s + d.mealsLogged, 0);

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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Weekly Report</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={[styles.weekSelector, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.arrowBtn, { opacity: weekOffset < weeklyHistory.length - 1 ? 1 : 0.3 }]}
            onPress={() => setWeekOffset((w) => Math.min(w + 1, weeklyHistory.length - 1))}
            disabled={weekOffset >= weeklyHistory.length - 1}
          >
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.weekLabelCol}>
            <Text style={[styles.weekLabelText, { color: colors.foreground }]}>{weekLabel}</Text>
            {weekOffset === 0 && (
              <Text style={[styles.currentWeekBadge, { color: colors.primary }]}>Current Week</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.arrowBtn, { opacity: weekOffset > 0 ? 1 : 0.3 }]}
            onPress={() => setWeekOffset((w) => Math.max(w - 1, 0))}
            disabled={weekOffset === 0}
          >
            <Feather name="chevron-right" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Adherence</Text>
            <View style={[styles.adherencePctBadge, {
              backgroundColor: week.adherencePct >= 70 ? "#22C55E22" : week.adherencePct >= 40 ? "#F59E0B22" : "#EF444422"
            }]}>
              <Text style={[styles.adherencePctText, {
                color: week.adherencePct >= 70 ? "#22C55E" : week.adherencePct >= 40 ? "#F59E0B" : "#EF4444"
              }]}>
                {week.adherencePct}% this week
              </Text>
            </View>
          </View>
          <AdherenceChart days={week.days} />
          <View style={styles.legendRow}>
            {[
              { color: "#22C55E", label: "Full day (2+ meals)" },
              { color: "#F59E0B", label: "Partial" },
              { color: "#D1D5DB", label: "Missed" },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nutrition Averages</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Daily averages vs. coach targets</Text>
          <NutritionBar label="Calories" value={week.avgCalories} target={1800} unit=" kcal" color={colors.primary} />
          <NutritionBar label="Protein" value={week.avgProtein} target={45} unit="g" color="#3B82F6" />
          <NutritionBar label="Carbs" value={week.avgCarbs} target={225} unit="g" color="#F59E0B" />
          <NutritionBar label="Fat" value={week.avgFat} target={60} unit="g" color="#EF4444" />
          <NutritionBar label="Fiber" value={week.avgFiber} target={25} unit="g" color="#8B5CF6" />
          <View style={styles.colorKey}>
            {[
              { color: "#22C55E", label: "Within target" },
              { color: "#F59E0B", label: "Slightly off" },
              { color: "#EF4444", label: "Far from target" },
            ].map((k) => (
              <View key={k.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: k.color }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{k.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={16} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meal Pattern Insights</Text>
          </View>
          {insights.map((insight, i) => (
            <View key={i} style={[styles.insightRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.insightDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.insightText, { color: colors.foreground }]}>{insight}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Streak Summary</Text>
          <View style={styles.streakStats}>
            <View style={styles.streakStat}>
              <Ionicons name="flame" size={24} color="#F59E0B" />
              <Text style={[styles.streakStatValue, { color: colors.foreground }]}>{streak}</Text>
              <Text style={[styles.streakStatLabel, { color: colors.mutedForeground }]}>Current</Text>
            </View>
            <View style={[styles.streakStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.streakStat}>
              <Ionicons name="trophy" size={24} color="#F59E0B" />
              <Text style={[styles.streakStatValue, { color: colors.foreground }]}>{longestStreak}</Text>
              <Text style={[styles.streakStatLabel, { color: colors.mutedForeground }]}>Best ever</Text>
            </View>
          </View>
          <View style={styles.sparklineRow}>
            <Text style={[styles.sparklineLabel, { color: colors.mutedForeground }]}>8-week streak history</Text>
            <Sparkline data={streakSparkline} width={240} height={44} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>vs. Last Week</Text>
          {prevWeek ? (
            <View style={styles.vsGrid}>
              {[
                { label: "Meals Logged", current: thisMealsLogged, prev: prevMealsLogged, unit: "" },
                { label: "Adherence", current: week.adherencePct, prev: prevAdherence, unit: "%" },
                { label: "Avg. Calories", current: week.avgCalories, prev: prevCalories, unit: " kcal" },
                { label: "Avg. Protein", current: week.avgProtein, prev: prevProtein, unit: "g" },
              ].map((row) => (
                <View key={row.label} style={[styles.vsRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.vsLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.vsValue, { color: colors.foreground }]}>
                    {row.current}{row.unit}
                  </Text>
                  <DeltaBadge value={row.current - row.prev} unit={row.unit} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>
              No previous week data available
            </Text>
          )}
        </View>
      </ScrollView>
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
  backBtn: { width: 38, alignItems: "flex-start" },
  navTitle: { fontSize: 17, fontWeight: "700" },
  weekSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  arrowBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  weekLabelCol: { flex: 1, alignItems: "center" },
  weekLabelText: { fontSize: 15, fontWeight: "600" },
  currentWeekBadge: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  sectionSub: { fontSize: 12, marginTop: -8, marginBottom: 12 },
  adherencePctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adherencePctText: { fontSize: 13, fontWeight: "700" },
  chartContainer: { gap: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { fontSize: 12, fontWeight: "600", width: 32 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },
  barPct: { fontSize: 12, fontWeight: "600", width: 35, textAlign: "right" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  colorKey: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  nutritionBar: { marginBottom: 12 },
  nutritionBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  nutritionBarLabel: { fontSize: 13, fontWeight: "600" },
  nutritionBarValue: { fontSize: 12 },
  nutritionBarTrack: { height: 8, borderRadius: 4, overflow: "hidden", position: "relative" },
  nutritionBarFill: { height: "100%", borderRadius: 4 },
  nutritionBarTarget: { position: "absolute", right: 0, top: 0, bottom: 0, width: 2 },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  insightDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5, flexShrink: 0 },
  insightText: { flex: 1, fontSize: 13, lineHeight: 20 },
  streakStats: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  streakStat: { flex: 1, alignItems: "center", gap: 4 },
  streakStatValue: { fontSize: 28, fontWeight: "800" },
  streakStatLabel: { fontSize: 12 },
  streakStatDivider: { width: 1, height: 60, marginHorizontal: 16 },
  sparklineRow: { gap: 8 },
  sparklineLabel: { fontSize: 12, fontWeight: "500" },
  vsGrid: {},
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  vsLabel: { flex: 1, fontSize: 13 },
  vsValue: { fontSize: 14, fontWeight: "700" },
  deltaBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  deltaText: { fontSize: 12, fontWeight: "700" },
  noDataText: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
});
