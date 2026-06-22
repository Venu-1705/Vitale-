import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import { useHealth } from "@/context/HealthContext";

const HEALTH_GOALS = [
  { id: "weight-loss",   label: "Weight Loss",              icon: "trending-down", color: "#EF4444" },
  { id: "muscle",        label: "Muscle Building",          icon: "zap",           color: "#F97316" },
  { id: "pcos",         label: "PCOS/PCOD Management",     icon: "activity",      color: "#8B5CF6" },
  { id: "diabetes",     label: "Diabetes Management",      icon: "heart",         color: "#3B82F6" },
  { id: "gut",          label: "Gut Health",               icon: "circle",        color: "#10B981" },
  { id: "wellness",     label: "General Wellness",         icon: "sun",           color: "#F59E0B" },
  { id: "prenatal",     label: "Prenatal Nutrition",       icon: "star",          color: "#EC4899" },
  { id: "mental",       label: "Mental Health",            icon: "cloud",         color: "#6366F1" },
];

const CONDITION_OPTIONS = ["PCOS", "Diabetes", "Thyroid", "Hypertension", "IBS", "Anemia"];
const DIET_OPTIONS = ["Vegetarian", "Vegan", "Eggetarian", "Non-vegetarian", "Jain", "Gluten-free"];

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useHealth();

  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");

  const [goals, setGoals] = useState<string[]>([]);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);

  const [coachCode, setCoachCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [consented, setConsented] = useState(false);

  const TOTAL_STEPS = 5;

  function toggleGoal(id: string) {
    setGoals((p) => p.includes(id) ? p.filter((g) => g !== id) : [...p, id]);
  }
  function toggleCondition(c: string) {
    setConditions((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  }
  function toggleDietary(d: string) {
    setDietary((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  function next() {
    if (step === 1 && !name.trim()) {
      Alert.alert("Name required", "Please enter your name to continue.");
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function finish(path: "browse" | "code") {
    if (path === "code" && coachCode.trim()) {
      Alert.alert("Coach Code", `Code "${coachCode.toUpperCase()}" accepted! Your coach's program will be set up shortly.`);
    }
    if (height || weight) {
      updateProfile({
        height: parseFloat(height) || undefined as any,
        weight: parseFloat(weight) || undefined as any,
        conditions,
        allergies: dietary,
      });
    }
    await AsyncStorage.setItem("vitale_onboarded_v1", "true");
    router.replace("/");
  }

  function renderDots() {
    return (
      <View style={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === step ? colors.primary : colors.border, width: i === step ? 20 : 8 },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === "web" ? 56 : insets.top + 8 }]}>
        {step > 0 ? (
          <TouchableOpacity onPress={back} style={styles.navBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
        {renderDots()}
        <TouchableOpacity onPress={() => router.replace("/")} style={styles.navBtn}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <View style={styles.stepContent}>
              <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.logoCircle}>
                <Feather name="activity" size={36} color="#fff" />
              </LinearGradient>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Welcome to Vitalé</Text>
              <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
                Your health journey, all in one place.
              </Text>
              <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>
                Track nutrition, manage symptoms, connect with expert coaches — personalized for you.
              </Text>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Let's set up your profile</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Tell us a bit about yourself so we can personalize your experience.
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Your name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="e.g. Alex"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Gender</Text>
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, {
                        backgroundColor: gender === g ? colors.primary : colors.card,
                        borderColor: gender === g ? colors.primary : colors.border,
                      }]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.chipText, { color: gender === g ? "#fff" : colors.foreground }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Date of birth</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.mutedForeground}
                  value={dob}
                  onChangeText={setDob}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>What are you working on?</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Select all that apply — we'll recommend the right programs and coaches for you.
              </Text>
              <View style={styles.goalGrid}>
                {HEALTH_GOALS.map((g) => {
                  const sel = goals.includes(g.id);
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.goalCard, {
                        backgroundColor: sel ? g.color + "18" : colors.card,
                        borderColor: sel ? g.color : colors.border,
                      }]}
                      onPress={() => toggleGoal(g.id)}
                    >
                      <View style={[styles.goalIcon, { backgroundColor: g.color + "22" }]}>
                        <Feather name={g.icon as any} size={20} color={g.color} />
                      </View>
                      <Text style={[styles.goalLabel, { color: sel ? g.color : colors.foreground }]} numberOfLines={2}>
                        {g.label}
                      </Text>
                      {sel && (
                        <View style={[styles.goalCheck, { backgroundColor: g.color }]}>
                          <Feather name="check" size={10} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Help your coach understand your baseline</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Optional — you can skip and update this later in your Health Profile.
              </Text>

              <View style={styles.metricsRow}>
                {[
                  { label: "Height", placeholder: "cm", val: height, set: setHeight },
                  { label: "Weight", placeholder: "kg", val: weight, set: setWeight },
                ].map((f) => (
                  <View key={f.label} style={{ flex: 1, gap: 6 }}>
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.mutedForeground}
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Health Conditions</Text>
                <View style={styles.chipRow}>
                  {CONDITION_OPTIONS.map((c) => {
                    const sel = conditions.includes(c);
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, { backgroundColor: sel ? "#EF444422" : colors.card, borderColor: sel ? "#EF4444" : colors.border }]}
                        onPress={() => toggleCondition(c)}
                      >
                        <Text style={[styles.chipText, { color: sel ? "#EF4444" : colors.foreground }]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Dietary Preference</Text>
                <View style={styles.chipRow}>
                  {DIET_OPTIONS.map((d) => {
                    const sel = dietary.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.chip, { backgroundColor: sel ? "#10B98122" : colors.card, borderColor: sel ? "#10B981" : colors.border }]}
                        onPress={() => toggleDietary(d)}
                      >
                        <Text style={[styles.chipText, { color: sel ? "#10B981" : colors.foreground }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContent}>
              <LinearGradient colors={["#22C55E22", "#22C55E05"]} style={styles.successGradient}>
                <View style={[styles.successCircle, { backgroundColor: "#22C55E" }]}>
                  <Feather name="check" size={32} color="#fff" />
                </View>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>You're all set, {name || "there"}!</Text>
                <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                  Your personalized wellness journey starts now.
                </Text>
              </LinearGradient>

              <View style={[styles.dpdpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="shield" size={16} color="#22C55E" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.dpdpTitle, { color: colors.foreground }]}>Data Privacy Notice</Text>
                  <Text style={[styles.dpdpText, { color: colors.mutedForeground }]}>
                    We collect your name, contact details, and health information you choose to share. This is used only to enable coaching programs. Your data is never sold to third parties. You can download or delete it anytime from Settings.
                  </Text>
                  <TouchableOpacity
                    style={[styles.consentRow]}
                    onPress={() => setConsented((v) => !v)}
                  >
                    <View style={[styles.checkbox, { borderColor: consented ? "#22C55E" : colors.border, backgroundColor: consented ? "#22C55E" : "transparent" }]}>
                      {consented && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.consentText, { color: colors.foreground }]}>I agree to the Privacy Policy and DPDP Act consent</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.mainBtn, { backgroundColor: consented ? colors.primary : colors.border }]}
                onPress={() => { if (consented) finish("browse"); else Alert.alert("Consent required", "Please agree to the privacy policy to continue."); }}
              >
                <Ionicons name="compass-outline" size={20} color={consented ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.mainBtnText, { color: consented ? "#fff" : colors.mutedForeground }]}>Browse Programs</Text>
              </TouchableOpacity>

              <Text style={[styles.orText, { color: colors.mutedForeground }]}>— or —</Text>

              {!showCodeInput ? (
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => setShowCodeInput(true)}
                >
                  <Feather name="key" size={16} color={colors.foreground} />
                  <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>I have a coach code</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.codeInputRow}>
                  <TextInput
                    style={[styles.codeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Enter coach code"
                    placeholderTextColor={colors.mutedForeground}
                    value={coachCode}
                    onChangeText={setCoachCode}
                    autoCapitalize="characters"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.codeSubmitBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { if (consented) finish("code"); else Alert.alert("Consent required", "Please agree to the privacy policy first."); }}
                  >
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {step < TOTAL_STEPS - 1 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={next}
          >
            <Text style={styles.nextBtnText}>{step === 0 ? "Get Started" : "Continue"}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
          {step === 1 && (
            <TouchableOpacity onPress={() => setStep((s) => s + 1)}>
              <Text style={[styles.skipLink, { color: colors.mutedForeground }]}>Skip for now</Text>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity onPress={() => setStep((s) => s + 1)}>
              <Text style={[styles.skipLink, { color: colors.mutedForeground }]}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navBtn: { width: 38, height: 38, justifyContent: "center" },
  skipText: { fontSize: 14, fontWeight: "500" },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 8, borderRadius: 4 },
  content: { paddingHorizontal: 24, paddingTop: 8 },
  stepContent: { gap: 20 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  welcomeTitle: { fontSize: 30, fontWeight: "900", textAlign: "center", lineHeight: 36 },
  tagline: { fontSize: 17, textAlign: "center", fontStyle: "italic" },
  welcomeSub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  stepTitle: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  stepSub: { fontSize: 15, lineHeight: 21 },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: "600" },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  goalCard: {
    width: "47%",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
    position: "relative",
  },
  goalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  goalLabel: { fontSize: 13, fontWeight: "600", lineHeight: 17 },
  goalCheck: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metricsRow: { flexDirection: "row", gap: 12 },
  successGradient: { padding: 24, borderRadius: 20, alignItems: "center", gap: 12 },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  dpdpCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  dpdpTitle: { fontSize: 14, fontWeight: "700" },
  dpdpText: { fontSize: 13, lineHeight: 18 },
  consentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 18 },
  mainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  mainBtnText: { fontSize: 17, fontWeight: "700" },
  orText: { textAlign: "center", fontSize: 13 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  outlineBtnText: { fontSize: 15, fontWeight: "600" },
  codeInputRow: { flexDirection: "row", gap: 10 },
  codeInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, letterSpacing: 2 },
  codeSubmitBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bottomBar: { paddingHorizontal: 24, paddingTop: 12, gap: 12, alignItems: "center" },
  nextBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  nextBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  skipLink: { fontSize: 14 },
});
