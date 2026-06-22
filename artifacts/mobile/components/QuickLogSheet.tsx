import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useHealth, type LogType, type SymptomEntry } from "@/context/HealthContext";
import { useMeal } from "@/context/MealContext";

const MOOD_EMOJIS = ["😢", "😕", "😐", "🙂", "😄"];
const MOOD_LABELS = ["Very Low", "Low", "Neutral", "Good", "Great"];

const ENERGY_COLORS = ["#EF4444", "#F97316", "#F59E0B", "#22C55E", "#10B981"];
const ENERGY_LABELS = ["Very Low", "Low", "Moderate", "Good", "High"];

const SLEEP_OPTIONS = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];

const SYMPTOM_OPTIONS = [
  "Bloating", "Headache", "Fatigue", "Cramps",
  "Acne", "Hair fall", "Constipation", "Acidity",
  "Nausea", "Joint pain", "Insomnia", "Irritability",
  "Brain fog", "Hot flashes", "Palpitations", "Low libido",
];

const PERIOD_SYMPTOMS = [
  "Cramps", "Bloating", "Headache", "Fatigue",
  "Nausea", "Mood swings", "Back pain", "Breast tenderness",
];

type LogTypeConfig = {
  key: LogType;
  label: string;
  icon: string;
  color: string;
  iconLib: "feather" | "ionicons";
};

const LOG_TYPES: LogTypeConfig[] = [
  { key: "weight",   label: "Weight",   icon: "activity",       color: "#3B82F6", iconLib: "feather" },
  { key: "water",    label: "Water",    icon: "droplet",        color: "#06B6D4", iconLib: "feather" },
  { key: "sleep",    label: "Sleep",    icon: "moon",           color: "#8B5CF6", iconLib: "feather" },
  { key: "energy",   label: "Energy",   icon: "battery-charging", color: "#F59E0B", iconLib: "feather" },
  { key: "mood",     label: "Mood",     icon: "smile",          color: "#EC4899", iconLib: "feather" },
  { key: "symptoms", label: "Symptoms", icon: "alert-circle",   color: "#EF4444", iconLib: "feather" },
  { key: "period",   label: "Period",   icon: "calendar",       color: "#F97316", iconLib: "feather" },
  { key: "note",     label: "Note",     icon: "edit-3",         color: "#10B981", iconLib: "feather" },
];

type SelectedSymptom = { name: string; severity: "mild" | "moderate" | "severe" };

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function QuickLogSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog } = useHealth();
  const { addWater } = useMeal();

  const [activeType, setActiveType] = useState<LogType | null>(null);
  const [success, setSuccess] = useState(false);

  // weight
  const [weightVal, setWeightVal] = useState("");

  // water
  const [waterGlasses, setWaterGlasses] = useState(1);

  // sleep
  const [sleepHours, setSleepHours] = useState(7.5);

  // energy
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);

  // mood
  const [moodLevel, setMoodLevel] = useState<number | null>(null);

  // symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([]);
  const [symptomNote, setSymptomNote] = useState("");

  // period
  const [periodType, setPeriodType] = useState<"start" | "end">("start");
  const [periodFlow, setPeriodFlow] = useState<"light" | "medium" | "heavy">("medium");
  const [periodSymptoms, setPeriodSymptoms] = useState<string[]>([]);

  // note
  const [noteText, setNoteText] = useState("");

  function resetState() {
    setActiveType(null);
    setSuccess(false);
    setWeightVal("");
    setWaterGlasses(1);
    setSleepHours(7.5);
    setEnergyLevel(null);
    setMoodLevel(null);
    setSelectedSymptoms([]);
    setSymptomNote("");
    setPeriodType("start");
    setPeriodFlow("medium");
    setPeriodSymptoms([]);
    setNoteText("");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function canSubmit(): boolean {
    if (!activeType) return false;
    if (activeType === "weight") return weightVal.trim().length > 0 && !isNaN(parseFloat(weightVal));
    if (activeType === "energy") return energyLevel !== null;
    if (activeType === "mood") return moodLevel !== null;
    if (activeType === "symptoms") return selectedSymptoms.length > 0;
    if (activeType === "note") return noteText.trim().length > 0;
    return true;
  }

  function handleSubmit() {
    if (!activeType) return;

    const base = { type: activeType } as any;
    if (activeType === "weight") base.weight = parseFloat(weightVal);
    if (activeType === "water") { base.waterGlasses = waterGlasses; addWater(); }
    if (activeType === "sleep") base.sleepHours = sleepHours;
    if (activeType === "energy") base.energyLevel = energyLevel;
    if (activeType === "mood") base.moodLevel = moodLevel;
    if (activeType === "symptoms") { base.symptoms = selectedSymptoms; base.symptomNote = symptomNote; }
    if (activeType === "period") {
      base.periodType = periodType;
      base.periodFlow = periodType === "start" ? periodFlow : undefined;
      base.periodSymptoms = periodSymptoms;
    }
    if (activeType === "note") base.noteText = noteText;

    addLog(base);
    setSuccess(true);
    setTimeout(() => { handleClose(); }, 1800);
  }

  function toggleSymptom(name: string) {
    setSelectedSymptoms((prev) => {
      const exists = prev.find((s) => s.name === name);
      if (exists) return prev.filter((s) => s.name !== name);
      return [...prev, { name, severity: "mild" }];
    });
  }

  function setSeverity(name: string, severity: "mild" | "moderate" | "severe") {
    setSelectedSymptoms((prev) =>
      prev.map((s) => (s.name === name ? { ...s, severity } : s))
    );
  }

  function togglePeriodSymptom(name: string) {
    setPeriodSymptoms((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }

  const config = LOG_TYPES.find((t) => t.key === activeType);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.sheetContainer}>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            {activeType ? (
              <TouchableOpacity onPress={() => setActiveType(null)} style={styles.backBtn}>
                <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {success ? "Logged!" : activeType ? config?.label : "Log Health"}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successState}>
              <View style={[styles.successIcon, { backgroundColor: "#22C55E" }]}>
                <Feather name="check" size={28} color="#fff" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Logged!</Text>
              <View style={[styles.xpPill, { backgroundColor: "#22C55E22" }]}>
                <Feather name="star" size={13} color="#22C55E" />
                <Text style={[styles.xpPillText, { color: "#22C55E" }]}>+3 Health XP</Text>
              </View>
              <Text style={[styles.successNote, { color: colors.mutedForeground }]}>
                Your coach can see this during your active program.
              </Text>
            </View>
          ) : !activeType ? (
            <View style={styles.typeGrid}>
              {LOG_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, { backgroundColor: t.color + "18", borderColor: t.color + "33" }]}
                  onPress={() => setActiveType(t.key)}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: t.color + "28" }]}>
                    <Feather name={t.icon as any} size={22} color={t.color} />
                  </View>
                  <Text style={[styles.typeLabel, { color: colors.foreground }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inputArea}>
              {activeType === "weight" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                  <View style={[styles.bigInputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                    <TextInput
                      style={[styles.bigInput, { color: colors.foreground }]}
                      value={weightVal}
                      onChangeText={setWeightVal}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 62.5"
                      placeholderTextColor={colors.mutedForeground}
                      autoFocus
                    />
                    <Text style={[styles.bigInputUnit, { color: colors.mutedForeground }]}>kg</Text>
                  </View>
                </View>
              )}

              {activeType === "water" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Tap to add glasses (goal: 8)</Text>
                  <View style={styles.glassesRow}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setWaterGlasses(i + 1)}
                        style={[
                          styles.glassTile,
                          {
                            backgroundColor: i < waterGlasses ? "#06B6D422" : colors.muted,
                            borderColor: i < waterGlasses ? "#06B6D4" : colors.border,
                          },
                        ]}
                      >
                        <Feather name="droplet" size={18} color={i < waterGlasses ? "#06B6D4" : colors.border} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.glassCount, { color: colors.primary }]}>{waterGlasses} glass{waterGlasses !== 1 ? "es" : ""}</Text>
                </View>
              )}

              {activeType === "sleep" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Hours slept last night</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sleepRow}>
                    {SLEEP_OPTIONS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.sleepPill,
                          {
                            backgroundColor: sleepHours === h ? "#8B5CF6" : colors.muted,
                            borderColor: sleepHours === h ? "#8B5CF6" : colors.border,
                          },
                        ]}
                        onPress={() => setSleepHours(h)}
                      >
                        <Text style={[styles.sleepPillText, { color: sleepHours === h ? "#fff" : colors.foreground }]}>
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={[styles.selectedValue, { color: "#8B5CF6" }]}>{sleepHours} hours selected</Text>
                </View>
              )}

              {activeType === "energy" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>How's your energy today?</Text>
                  <View style={styles.energyRow}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.energyBtn,
                          {
                            backgroundColor: energyLevel === level ? ENERGY_COLORS[level - 1] : colors.muted,
                            borderColor: energyLevel === level ? ENERGY_COLORS[level - 1] : colors.border,
                          },
                        ]}
                        onPress={() => setEnergyLevel(level)}
                      >
                        <Text style={[styles.energyNum, { color: energyLevel === level ? "#fff" : colors.foreground }]}>{level}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {energyLevel && (
                    <Text style={[styles.selectedValue, { color: ENERGY_COLORS[energyLevel - 1] }]}>
                      {ENERGY_LABELS[energyLevel - 1]}
                    </Text>
                  )}
                </View>
              )}

              {activeType === "mood" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>How are you feeling?</Text>
                  <View style={styles.moodRow}>
                    {MOOD_EMOJIS.map((emoji, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.moodBtn,
                          moodLevel === i + 1 && { backgroundColor: "#EC489922", borderColor: "#EC4899" },
                          { borderColor: colors.border },
                        ]}
                        onPress={() => setMoodLevel(i + 1)}
                      >
                        <Text style={styles.moodEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {moodLevel && (
                    <Text style={[styles.selectedValue, { color: "#EC4899" }]}>
                      {MOOD_EMOJIS[moodLevel - 1]} {MOOD_LABELS[moodLevel - 1]}
                    </Text>
                  )}
                </View>
              )}

              {activeType === "symptoms" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Select all that apply</Text>
                  <View style={styles.symptomGrid}>
                    {SYMPTOM_OPTIONS.map((s) => {
                      const selected = selectedSymptoms.find((x) => x.name === s);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.symptomChip,
                            {
                              backgroundColor: selected ? "#EF444422" : colors.muted,
                              borderColor: selected ? "#EF4444" : colors.border,
                            },
                          ]}
                          onPress={() => toggleSymptom(s)}
                        >
                          <Text style={[styles.symptomChipText, { color: selected ? "#EF4444" : colors.foreground }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {selectedSymptoms.length > 0 && (
                    <View style={{ gap: 8, marginTop: 12 }}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Severity</Text>
                      {selectedSymptoms.map((sym) => (
                        <View key={sym.name} style={styles.severityRow}>
                          <Text style={[styles.severityName, { color: colors.foreground }]}>{sym.name}</Text>
                          <View style={styles.severityBtns}>
                            {(["mild", "moderate", "severe"] as const).map((sev) => (
                              <TouchableOpacity
                                key={sev}
                                style={[
                                  styles.severityBtn,
                                  {
                                    backgroundColor: sym.severity === sev ? "#EF4444" : colors.muted,
                                    borderColor: sym.severity === sev ? "#EF4444" : colors.border,
                                  },
                                ]}
                                onPress={() => setSeverity(sym.name, sev)}
                              >
                                <Text style={[styles.severityBtnText, { color: sym.severity === sev ? "#fff" : colors.mutedForeground }]}>
                                  {sev[0].toUpperCase() + sev.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      <TextInput
                        style={[styles.noteInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                        placeholder="Optional note..."
                        placeholderTextColor={colors.mutedForeground}
                        value={symptomNote}
                        onChangeText={setSymptomNote}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}
                </View>
              )}

              {activeType === "period" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Period tracking</Text>
                  <View style={styles.periodToggleRow}>
                    {(["start", "end"] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.periodToggleBtn,
                          {
                            backgroundColor: periodType === t ? "#F97316" : colors.muted,
                            borderColor: periodType === t ? "#F97316" : colors.border,
                          },
                        ]}
                        onPress={() => setPeriodType(t)}
                      >
                        <Text style={[styles.periodToggleText, { color: periodType === t ? "#fff" : colors.foreground }]}>
                          Period {t === "start" ? "Start" : "End"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {periodType === "start" && (
                    <>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Flow level</Text>
                      <View style={styles.flowRow}>
                        {(["light", "medium", "heavy"] as const).map((f) => (
                          <TouchableOpacity
                            key={f}
                            style={[
                              styles.flowBtn,
                              {
                                backgroundColor: periodFlow === f ? "#F97316" : colors.muted,
                                borderColor: periodFlow === f ? "#F97316" : colors.border,
                              },
                            ]}
                            onPress={() => setPeriodFlow(f)}
                          >
                            <Text style={[styles.flowBtnText, { color: periodFlow === f ? "#fff" : colors.foreground }]}>
                              {f[0].toUpperCase() + f.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Symptoms (optional)</Text>
                  <View style={styles.symptomGrid}>
                    {PERIOD_SYMPTOMS.map((s) => {
                      const sel = periodSymptoms.includes(s);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.symptomChip,
                            {
                              backgroundColor: sel ? "#F9731622" : colors.muted,
                              borderColor: sel ? "#F97316" : colors.border,
                            },
                          ]}
                          onPress={() => togglePeriodSymptom(s)}
                        >
                          <Text style={[styles.symptomChipText, { color: sel ? "#F97316" : colors.foreground }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {activeType === "note" && (
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>What's on your mind?</Text>
                  <TextInput
                    style={[styles.noteInputLarge, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Write a note about how you're feeling, something you noticed, or a question for your coach..."
                    placeholderTextColor={colors.mutedForeground}
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    numberOfLines={5}
                    autoFocus
                  />
                </View>
              )}
            </ScrollView>
          )}

          {!success && activeType && (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: canSubmit() ? colors.primary : colors.border }]}
              onPress={handleSubmit}
              disabled={!canSubmit()}
            >
              <Feather name="check" size={18} color={canSubmit() ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.submitBtnText, { color: canSubmit() ? "#fff" : colors.mutedForeground }]}>
                Save Log
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetContainer: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "90%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  closeBtn: { width: 36, height: 36, alignItems: "flex-end", justifyContent: "center" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 8 },
  typeBtn: { width: "22%", aspectRatio: 1, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, flexBasis: "22%" },
  typeIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  inputArea: { paddingBottom: 8 },
  inputBlock: { gap: 10 },
  inputLabel: { fontSize: 13, fontWeight: "600" },
  bigInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  bigInput: { flex: 1, fontSize: 32, fontWeight: "700" },
  bigInputUnit: { fontSize: 18, fontWeight: "500" },
  glassesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  glassTile: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  glassCount: { fontSize: 16, fontWeight: "700" },
  sleepRow: { gap: 8, paddingVertical: 4 },
  sleepPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  sleepPillText: { fontSize: 14, fontWeight: "600" },
  selectedValue: { fontSize: 15, fontWeight: "700" },
  energyRow: { flexDirection: "row", gap: 10 },
  energyBtn: { flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  energyNum: { fontSize: 20, fontWeight: "800" },
  moodRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  moodBtn: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  moodEmoji: { fontSize: 28 },
  symptomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  symptomChipText: { fontSize: 13, fontWeight: "500" },
  severityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  severityName: { fontSize: 13, fontWeight: "600", width: 90 },
  severityBtns: { flexDirection: "row", gap: 6 },
  severityBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  severityBtnText: { fontSize: 11, fontWeight: "600" },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20 },
  noteInputLarge: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 22, minHeight: 120, textAlignVertical: "top" },
  periodToggleRow: { flexDirection: "row", gap: 10 },
  periodToggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center" },
  periodToggleText: { fontSize: 14, fontWeight: "700" },
  flowRow: { flexDirection: "row", gap: 10 },
  flowBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  flowBtnText: { fontSize: 13, fontWeight: "600" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14, marginTop: 14 },
  submitBtnText: { fontSize: 16, fontWeight: "700" },
  successState: { alignItems: "center", gap: 12, paddingVertical: 24 },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 28, fontWeight: "900" },
  xpPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  xpPillText: { fontSize: 15, fontWeight: "700" },
  successNote: { fontSize: 13, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
});
