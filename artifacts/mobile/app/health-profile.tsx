import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useHealth, type HealthLog, type LogType } from "@/context/HealthContext";
import { useMyEnrollments } from "@/lib/programs";
import QuickLogSheet from "@/components/QuickLogSheet";

const CONDITION_OPTIONS = ["PCOS", "Diabetes", "Thyroid", "Hypertension", "PCOD", "IBS", "Anemia", "Asthma"];
const ALLERGY_OPTIONS = ["Lactose intolerant", "Gluten free", "Nut allergy", "Soy allergy", "Egg allergy", "Shellfish allergy"];

type FilterType = "all" | LogType;
const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "weight", label: "Weight" },
  { key: "symptoms", label: "Symptoms" },
  { key: "mood", label: "Mood" },
  { key: "sleep", label: "Sleep" },
  { key: "energy", label: "Energy" },
  { key: "period", label: "Period" },
  { key: "note", label: "Notes" },
];

const TYPE_ICONS: Record<LogType, { icon: string; color: string }> = {
  weight:   { icon: "activity",       color: "#3B82F6" },
  water:    { icon: "droplet",        color: "#06B6D4" },
  sleep:    { icon: "moon",           color: "#8B5CF6" },
  energy:   { icon: "battery-charging", color: "#F59E0B" },
  mood:     { icon: "smile",          color: "#EC4899" },
  symptoms: { icon: "alert-circle",   color: "#EF4444" },
  period:   { icon: "calendar",       color: "#F97316" },
  note:     { icon: "edit-3",         color: "#10B981" },
};

const MOOD_EMOJIS = ["😢", "😕", "😐", "🙂", "😄"];
const MOOD_LABELS = ["Very Low", "Low", "Neutral", "Good", "Great"];
const ENERGY_LABELS = ["Very Low", "Low", "Moderate", "Good", "High"];

function formatLogValue(log: HealthLog): string {
  if (log.type === "weight") return `${log.weight} kg`;
  if (log.type === "water") return `${log.waterGlasses} glass${log.waterGlasses !== 1 ? "es" : ""}`;
  if (log.type === "sleep") return `${log.sleepHours} hours`;
  if (log.type === "energy") return `Level ${log.energyLevel}/5 — ${ENERGY_LABELS[(log.energyLevel ?? 1) - 1]}`;
  if (log.type === "mood") return `${MOOD_EMOJIS[(log.moodLevel ?? 1) - 1]} ${MOOD_LABELS[(log.moodLevel ?? 1) - 1]}`;
  if (log.type === "symptoms") {
    const names = (log.symptoms ?? []).map((s) => `${s.name} (${s.severity})`).join(", ");
    return names || "No symptoms recorded";
  }
  if (log.type === "period") {
    const base = log.periodType === "start" ? `Period Start — ${log.periodFlow ?? "medium"} flow` : "Period End";
    const tags = (log.periodSymptoms ?? []).join(", ");
    return tags ? `${base}\n${tags}` : base;
  }
  if (log.type === "note") return log.noteText ?? "";
  return "";
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.floor((today.getTime() - ts) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function bmi(weight: number, height: number): number {
  const h = height / 100;
  return parseFloat((weight / (h * h)).toFixed(1));
}

function bmiCategory(b: number): { label: string; color: string } {
  if (b < 18.5) return { label: "Underweight", color: "#3B82F6" };
  if (b < 25) return { label: "Normal", color: "#22C55E" };
  if (b < 30) return { label: "Overweight", color: "#F59E0B" };
  return { label: "Obese", color: "#EF4444" };
}

function WeightChart({ data }: { data: { ts: number; weight: number }[] }) {
  const colors = useColors();
  if (data.length < 2) return null;

  const W = 340;
  const H = 140;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;

  const weights = data.map((d) => d.weight);
  const timestamps = data.map((d) => d.ts);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);

  function xPos(ts: number): number {
    return PAD_L + ((ts - minT) / (maxT - minT)) * (W - PAD_L - PAD_R);
  }
  function yPos(w: number): number {
    return PAD_T + (1 - (w - minW) / (maxW - minW)) * (H - PAD_T - PAD_B);
  }

  const points = data.map((d) => `${xPos(d.ts)},${yPos(d.weight)}`).join(" ");

  const yTicks = [minW + 1, (minW + maxW) / 2, maxW - 1].map(Math.round);
  const lastFewDates = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];

  return (
    <Svg width={W} height={H}>
      {yTicks.map((t) => (
        <Line
          key={t}
          x1={PAD_L}
          x2={W - PAD_R}
          y1={yPos(t)}
          y2={yPos(t)}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      ))}
      {yTicks.map((t) => (
        <SvgText key={`l${t}`} x={PAD_L - 4} y={yPos(t) + 4} fontSize={9} fill={colors.mutedForeground} textAnchor="end">
          {t}
        </SvgText>
      ))}
      {lastFewDates.map((d) => (
        <SvgText
          key={`d${d.ts}`}
          x={xPos(d.ts)}
          y={H - 4}
          fontSize={9}
          fill={colors.mutedForeground}
          textAnchor="middle"
        >
          {new Date(d.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </SvgText>
      ))}
      <Polyline
        points={points}
        fill="none"
        stroke="#22C55E"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d) => (
        <Circle
          key={d.ts}
          cx={xPos(d.ts)}
          cy={yPos(d.weight)}
          r={3.5}
          fill="#22C55E"
          stroke={colors.card}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

export default function HealthProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logs, profile, healthXp, updateProfile, weightLogs } = useHealth();
  const { data: enrollments = [] } = useMyEnrollments();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [isEditing, setIsEditing] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const [editHeight, setEditHeight] = useState(String(profile.height));
  const [editWeight, setEditWeight] = useState(String(profile.weight));
  const [editAge, setEditAge] = useState(String(profile.age));
  const [editGender, setEditGender] = useState(profile.gender);
  const [editConditions, setEditConditions] = useState<string[]>(profile.conditions);
  const [editAllergies, setEditAllergies] = useState<string[]>(profile.allergies);

  function saveProfile() {
    updateProfile({
      height: parseFloat(editHeight) || profile.height,
      weight: parseFloat(editWeight) || profile.weight,
      age: parseInt(editAge) || profile.age,
      gender: editGender,
      conditions: editConditions,
      allergies: editAllergies,
    });
    setIsEditing(false);
  }

  function toggleCondition(c: string) {
    setEditConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }
  function toggleAllergy(a: string) {
    setEditAllergies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  const myBmi = bmi(profile.weight, profile.height);
  const bmiInfo = bmiCategory(myBmi);

  const filteredLogs = filterType === "all"
    ? [...logs].sort((a, b) => b.timestamp - a.timestamp)
    : [...logs].filter((l) => l.type === filterType).sort((a, b) => b.timestamp - a.timestamp);

  const activeEnrollments = enrollments.filter((e) => e.status === "active");

  const weightData = weightLogs.map((l) => ({ ts: l.timestamp, weight: l.weight! }));
  const latestWeight = weightData[weightData.length - 1];
  const earliestWeight = weightData[0];
  const weightChange = latestWeight && earliestWeight
    ? parseFloat((latestWeight.weight - earliestWeight.weight).toFixed(1))
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.navBar, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Health Profile</Text>
        <TouchableOpacity
          style={[styles.logBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowLog(true)}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Metrics</Text>
            {!isEditing ? (
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.muted }]} onPress={() => setIsEditing(true)}>
                <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Update</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={saveProfile}>
                <Feather name="check" size={14} color="#fff" />
                <Text style={[styles.editBtnText, { color: "#fff" }]}>Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isEditing ? (
            <>
              <View style={styles.metricsGrid}>
                {[
                  { label: "Height", value: `${profile.height} cm` },
                  { label: "Weight", value: `${profile.weight} kg` },
                  { label: "Age", value: `${profile.age} yrs` },
                  { label: "Gender", value: profile.gender },
                ].map((m) => (
                  <View key={m.label} style={[styles.metricTile, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>{m.value}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.bmiCard, { backgroundColor: bmiInfo.color + "18", borderColor: bmiInfo.color + "44" }]}>
                <View>
                  <Text style={[styles.bmiLabel, { color: colors.mutedForeground }]}>BMI</Text>
                  <Text style={[styles.bmiValue, { color: bmiInfo.color }]}>{myBmi}</Text>
                  <Text style={[styles.bmiCategory, { color: bmiInfo.color }]}>{bmiInfo.label}</Text>
                </View>
                <View style={styles.bmiBarWrap}>
                  {[
                    { label: "Under", color: "#3B82F6", range: [0, 18.5] },
                    { label: "Normal", color: "#22C55E", range: [18.5, 25] },
                    { label: "Over", color: "#F59E0B", range: [25, 30] },
                    { label: "Obese", color: "#EF4444", range: [30, 40] },
                  ].map((seg) => (
                    <View
                      key={seg.label}
                      style={[styles.bmiSeg, {
                        backgroundColor: seg.color + "55",
                        flex: seg.range[1] - seg.range[0],
                        borderWidth: myBmi >= seg.range[0] && myBmi < seg.range[1] ? 2 : 0,
                        borderColor: seg.color,
                      }]}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={[styles.tagSectionLabel, { color: colors.mutedForeground }]}>Health Conditions</Text>
                <View style={styles.tagRow}>
                  {profile.conditions.map((c) => (
                    <View key={c} style={[styles.tag, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
                      <Text style={[styles.tagText, { color: "#EF4444" }]}>{c}</Text>
                    </View>
                  ))}
                  {profile.conditions.length === 0 && (
                    <Text style={[styles.noneText, { color: colors.mutedForeground }]}>None added</Text>
                  )}
                </View>
                <Text style={[styles.tagSectionLabel, { color: colors.mutedForeground }]}>Dietary Restrictions</Text>
                <View style={styles.tagRow}>
                  {profile.allergies.map((a) => (
                    <View key={a} style={[styles.tag, { backgroundColor: "#F9731622", borderColor: "#F9731644" }]}>
                      <Text style={[styles.tagText, { color: "#F97316" }]}>{a}</Text>
                    </View>
                  ))}
                  {profile.allergies.length === 0 && (
                    <Text style={[styles.noneText, { color: colors.mutedForeground }]}>None added</Text>
                  )}
                </View>
              </View>
              <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
                Last updated: {new Date(profile.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.editRow}>
                {[
                  { label: "Height (cm)", val: editHeight, set: setEditHeight },
                  { label: "Weight (kg)", val: editWeight, set: setEditWeight },
                ].map((f) => (
                  <View key={f.label} style={{ flex: 1 }}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
              <View style={styles.editRow}>
                {[
                  { label: "Age", val: editAge, set: setEditAge },
                  { label: "Gender", val: editGender, set: setEditGender },
                ].map((f) => (
                  <View key={f.label} style={{ flex: 1 }}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                      value={f.val}
                      onChangeText={f.set}
                    />
                  </View>
                ))}
              </View>
              <Text style={[styles.tagSectionLabel, { color: colors.mutedForeground }]}>Health Conditions</Text>
              <View style={styles.tagRow}>
                {CONDITION_OPTIONS.map((c) => {
                  const sel = editConditions.includes(c);
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.tag, { backgroundColor: sel ? "#EF444422" : colors.muted, borderColor: sel ? "#EF4444" : colors.border }]}
                      onPress={() => toggleCondition(c)}
                    >
                      <Text style={[styles.tagText, { color: sel ? "#EF4444" : colors.mutedForeground }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.tagSectionLabel, { color: colors.mutedForeground }]}>Dietary Restrictions</Text>
              <View style={styles.tagRow}>
                {ALLERGY_OPTIONS.map((a) => {
                  const sel = editAllergies.includes(a);
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[styles.tag, { backgroundColor: sel ? "#F9731622" : colors.muted, borderColor: sel ? "#F97316" : colors.border }]}
                      onPress={() => toggleAllergy(a)}
                    >
                      <Text style={[styles.tagText, { color: sel ? "#F97316" : colors.mutedForeground }]}>{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Weight Trend</Text>
            {weightChange !== null && (
              <View style={[styles.changePill, { backgroundColor: weightChange < 0 ? "#22C55E22" : "#EF444422" }]}>
                <Feather name={weightChange < 0 ? "trending-down" : "trending-up"} size={13} color={weightChange < 0 ? "#22C55E" : "#EF4444"} />
                <Text style={[styles.changePillText, { color: weightChange < 0 ? "#22C55E" : "#EF4444" }]}>
                  {Math.abs(weightChange)} kg since start
                </Text>
              </View>
            )}
          </View>
          {weightData.length >= 2 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <WeightChart data={weightData} />
            </ScrollView>
          ) : (
            <Text style={[styles.noneText, { color: colors.mutedForeground }]}>Log your weight to see the trend chart</Text>
          )}
          <TouchableOpacity
            style={[styles.logWeightBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
            onPress={() => setShowLog(true)}
          >
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.logWeightBtnText, { color: colors.primary }]}>Log Weight</Text>
          </TouchableOpacity>
        </View>

        {activeEnrollments.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Programs</Text>
            <Text style={[styles.accessSubtitle, { color: colors.mutedForeground }]}>You're currently enrolled in:</Text>
            {activeEnrollments.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.accessCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => router.push(`/program/${e.programId}` as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.coachAvatar, { backgroundColor: colors.primary + "33" }]}>
                  <Feather name="book-open" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.coachName, { color: colors.foreground }]}>{e.programTitle ?? "Your Program"}</Text>
                  <Text style={[styles.programName, { color: colors.mutedForeground }]}>{Math.round(e.progressPct)}% complete</Text>
                  <Text style={[styles.accessUntil, { color: colors.mutedForeground }]}>
                    Enrolled {new Date(e.enrolledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Health Timeline</Text>
            <View style={[styles.xpBadge, { backgroundColor: "#22C55E22" }]}>
              <Feather name="star" size={11} color="#22C55E" />
              <Text style={[styles.xpBadgeText, { color: "#22C55E" }]}>{healthXp} Health XP</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTER_LABELS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filterType === f.key && { backgroundColor: colors.primary }]}
                onPress={() => setFilterType(f.key)}
              >
                <Text style={[styles.filterChipText, { color: filterType === f.key ? "#fff" : colors.foreground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.timeline}>
            {filteredLogs.slice(0, 20).map((log, i) => {
              const typeInfo = TYPE_ICONS[log.type];
              return (
                <View key={log.id} style={styles.timelineEntry}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: typeInfo.color }]} />
                    {i < filteredLogs.slice(0, 20).length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                  <View style={[styles.timelineCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <View style={styles.timelineCardTop}>
                      <View style={[styles.timelineIcon, { backgroundColor: typeInfo.color + "22" }]}>
                        <Feather name={typeInfo.icon as any} size={14} color={typeInfo.color} />
                      </View>
                      <Text style={[styles.timelineType, { color: colors.foreground }]}>
                        {log.type[0].toUpperCase() + log.type.slice(1)}
                      </Text>
                      <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{formatDate(log.timestamp)}</Text>
                    </View>
                    <Text style={[styles.timelineValue, { color: colors.foreground }]}>{formatLogValue(log)}</Text>
                    {log.symptomNote ? (
                      <Text style={[styles.timelineNote, { color: colors.mutedForeground }]}>{log.symptomNote}</Text>
                    ) : null}
                    <Text style={[styles.timelineSource, { color: colors.mutedForeground }]}>Self-reported</Text>
                  </View>
                </View>
              );
            })}
            {filteredLogs.length === 0 && (
              <Text style={[styles.noneText, { color: colors.mutedForeground }]}>No entries yet for this category</Text>
            )}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Data</Text>
          <TouchableOpacity
            style={[styles.dataBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => Alert.alert("Export", "Generating your health data export... This feature will be available soon.")}
          >
            <Feather name="download" size={16} color={colors.foreground} />
            <Text style={[styles.dataBtnText, { color: colors.foreground }]}>Download My Health Data</Text>
            <Feather name="chevron-right" size={16} color={colors.border} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dataBtn, { borderColor: "#EF444433" }]}
            onPress={() =>
              Alert.alert(
                "Delete Health Data",
                "This will permanently delete all your health records from the platform. Your account will remain active. This action cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete All Data", style: "destructive", onPress: () => Alert.alert("Deleted", "Your health data has been deleted.") },
                ]
              )
            }
          >
            <Feather name="trash-2" size={16} color="#EF4444" />
            <Text style={[styles.dataBtnText, { color: "#EF4444" }]}>Delete My Health Data</Text>
          </TouchableOpacity>
          <Text style={[styles.dpdpNote, { color: colors.mutedForeground }]}>
            In compliance with India's Digital Personal Data Protection Act (DPDP), you have the right to access and delete your personal health data at any time.
          </Text>
        </View>
      </ScrollView>

      <QuickLogSheet visible={showLog} onClose={() => setShowLog(false)} />
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
  navTitle: { fontSize: 17, fontWeight: "700" },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  logBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  section: { margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { fontSize: 12, fontWeight: "600" },
  metricsGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metricTile: { flex: 1, minWidth: "45%", padding: 12, borderRadius: 12, gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  metricValue: { fontSize: 18, fontWeight: "800" },
  bmiCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  bmiLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  bmiValue: { fontSize: 28, fontWeight: "900" },
  bmiCategory: { fontSize: 13, fontWeight: "600" },
  bmiBarWrap: { flex: 1, flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
  bmiSeg: { borderRadius: 0 },
  tagSectionLabel: { fontSize: 12, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: "600" },
  noneText: { fontSize: 13 },
  lastUpdated: { fontSize: 11 },
  editRow: { flexDirection: "row", gap: 10 },
  editInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 4 },
  changePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  changePillText: { fontSize: 12, fontWeight: "600" },
  logWeightBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  logWeightBtnText: { fontSize: 13, fontWeight: "600" },
  accessSubtitle: { fontSize: 13, marginTop: -4 },
  accessCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  coachAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  coachAvatarText: { fontSize: 14, fontWeight: "800" },
  coachName: { fontSize: 14, fontWeight: "700" },
  programName: { fontSize: 12, marginTop: 1 },
  accessUntil: { fontSize: 11, marginTop: 2 },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  xpBadgeText: { fontSize: 12, fontWeight: "700" },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9" },
  filterChipText: { fontSize: 12, fontWeight: "600" },
  timeline: { gap: 0 },
  timelineEntry: { flexDirection: "row", gap: 12 },
  timelineLeft: { alignItems: "center", width: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 14 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  timelineCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10, gap: 5 },
  timelineCardTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  timelineIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  timelineType: { fontSize: 13, fontWeight: "700", flex: 1 },
  timelineDate: { fontSize: 11 },
  timelineValue: { fontSize: 14, lineHeight: 20 },
  timelineNote: { fontSize: 12, fontStyle: "italic" },
  timelineSource: { fontSize: 10, marginTop: 2 },
  dataBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dataBtnText: { flex: 1, fontSize: 14, fontWeight: "500" },
  dpdpNote: { fontSize: 11, lineHeight: 17 },
});
