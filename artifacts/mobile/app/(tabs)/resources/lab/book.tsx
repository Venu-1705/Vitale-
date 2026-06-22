import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { getAuthHeaders } from "@/lib/session";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const TIME_SLOTS = ["06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];

function getNext14Days() {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}
function formatDateNum(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric" });
}
function formatMonth(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "short" });
}

const STEPS = ["Collection", "Slot", "Details", "Review"];

export default function BookingWizardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { packageId, packageSlug } = useLocalSearchParams<{ packageId: string; packageSlug: string }>();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Collection type
  const [collectionType, setCollectionType] = useState<"home" | "centre">("home");

  // Step 2: Slot
  const days = getNext14Days();
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]);

  // Step 3: Patient details
  const [patientName, setPatientName] = useState("Alex");
  const [patientAge, setPatientAge] = useState("28");
  const [patientGender, setPatientGender] = useState("Female");
  const [patientPhone, setPatientPhone] = useState("9876543210");

  function goNext() {
    if (step < STEPS.length - 1) {
      Haptics.selectionAsync();
      setStep((s) => s + 1);
    }
  }
  function goBack() {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  }

  async function submit() {
    if (!patientName || !patientPhone) {
      Alert.alert("Missing details", "Please fill in patient name and phone");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/labs/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          collectionType,
          slotDate: formatISODate(selectedDay),
          slotTime: selectedTime,
          patientName,
          patientAge: parseInt(patientAge, 10) || 28,
          patientGender,
          patientPhone,
          razorpayPaymentId: `rzp_mock_${Date.now()}`,
        }),
      });
      if (!res.ok) throw new Error("Booking failed");
      const booking = await res.json();
      router.replace({
        pathname: "/(tabs)/resources/lab/confirmation" as any,
        params: { bookingId: booking.id, slotDate: booking.slotDate, slotTime: booking.slotTime },
      });
    } catch (err) {
      Alert.alert("Error", "Failed to place booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 10 },
          ]}
        >
          <Pressable onPress={goBack}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Book Lab Test</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressWrap, { backgroundColor: colors.card }]}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i <= step ? "#22C55E" : colors.border,
                    borderColor: i <= step ? "#22C55E" : colors.border,
                  },
                ]}
              >
                {i < step ? (
                  <Feather name="check" size={10} color="#fff" />
                ) : (
                  <Text style={[styles.progressNum, { color: i === step ? "#fff" : colors.mutedForeground }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  { color: i === step ? "#22C55E" : colors.mutedForeground, fontWeight: i === step ? "700" : "400" },
                ]}
              >
                {s}
              </Text>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, { backgroundColor: i < step ? "#22C55E" : colors.border }]} />
              )}
            </View>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Step 1: Collection */}
          {step === 0 && (
            <>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose Collection Type</Text>
              {(["home", "centre"] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: collectionType === type ? "#22C55E" : colors.border,
                      borderWidth: collectionType === type ? 2 : 1,
                    },
                  ]}
                  onPress={() => setCollectionType(type)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: type === "home" ? "#DCFCE7" : "#EFF6FF" }]}>
                    <Feather name={type === "home" ? "home" : "map-pin"} size={22} color={type === "home" ? "#22C55E" : "#3B82F6"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                      {type === "home" ? "Home Collection" : "Visit Centre"}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                      {type === "home"
                        ? "Sample collected at your doorstep"
                        : "Visit nearest Thyrocare collection centre"}
                    </Text>
                  </View>
                  {collectionType === type && <Feather name="check-circle" size={20} color="#22C55E" />}
                </Pressable>
              ))}
            </>
          )}

          {/* Step 2: Slot */}
          {step === 1 && (
            <>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose Your Slot</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Select a date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {days.map((d) => {
                  const sel = formatISODate(d) === formatISODate(selectedDay);
                  return (
                    <Pressable
                      key={formatISODate(d)}
                      style={[
                        styles.dayChip,
                        { backgroundColor: sel ? "#22C55E" : colors.card, borderColor: sel ? "#22C55E" : colors.border },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedDay(d);
                      }}
                    >
                      <Text style={[styles.dayLabel, { color: sel ? "#fff" : colors.mutedForeground }]}>
                        {formatDayLabel(d)}
                      </Text>
                      <Text style={[styles.dayNum, { color: sel ? "#fff" : colors.foreground }]}>
                        {formatDateNum(d)}
                      </Text>
                      <Text style={[styles.dayMonth, { color: sel ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                        {formatMonth(d)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.stepSub, { color: colors.mutedForeground, marginTop: 8 }]}>
                Choose a time slot
              </Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((t) => {
                  const sel = t === selectedTime;
                  return (
                    <Pressable
                      key={t}
                      style={[
                        styles.timeChip,
                        { backgroundColor: sel ? "#22C55E" : colors.card, borderColor: sel ? "#22C55E" : colors.border },
                      ]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text style={[styles.timeText, { color: sel ? "#fff" : colors.foreground }]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Step 3: Patient Details */}
          {step === 2 && (
            <>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Patient Details</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Auto-filled from Health Profile · editable per booking
              </Text>
              {[
                { label: "Full Name", value: patientName, set: setPatientName, keyboard: "default" as const },
                { label: "Age", value: patientAge, set: setPatientAge, keyboard: "numeric" as const },
                { label: "Gender", value: patientGender, set: setPatientGender, keyboard: "default" as const },
                { label: "Mobile Number", value: patientPhone, set: setPatientPhone, keyboard: "phone-pad" as const },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                    ]}
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={f.keyboard}
                    autoCapitalize="words"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              ))}
            </>
          )}

          {/* Step 4: Review + Pay */}
          {step === 3 && (
            <>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Review & Pay</Text>
              <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  ["Collection", collectionType === "home" ? "Home Collection" : "Visit Centre"],
                  ["Date", `${formatISODate(selectedDay)}`],
                  ["Time", selectedTime],
                  ["Patient", patientName],
                  ["Age / Gender", `${patientAge} yrs · ${patientGender}`],
                  ["Phone", patientPhone],
                ].map(([k, v], i, arr) => (
                  <View
                    key={k}
                    style={[
                      styles.reviewRow,
                      i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.reviewKey, { color: colors.mutedForeground }]}>{k}</Text>
                    <Text style={[styles.reviewVal, { color: colors.foreground }]}>{v}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.reviewRow}>
                  <Text style={[styles.reviewKey, { color: colors.mutedForeground }]}>Payment via</Text>
                  <View style={styles.razorpayRow}>
                    <Feather name="credit-card" size={14} color="#3B82F6" />
                    <Text style={[styles.reviewVal, { color: colors.foreground }]}>Razorpay</Text>
                    <Feather name="check-circle" size={14} color="#22C55E" />
                  </View>
                </View>
                <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>
                  Secure 256-bit SSL · UPI · Cards · Net Banking
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Pressable
            style={[styles.nextBtn, { backgroundColor: "#22C55E" }]}
            onPress={step === STEPS.length - 1 ? submit : goNext}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === STEPS.length - 1 ? "Confirm & Pay" : "Continue"}
                </Text>
                <Feather name={step === STEPS.length - 1 ? "check" : "arrow-right"} size={18} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 17, fontWeight: "700" },
  progressWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  progressStep: { flex: 1, alignItems: "center", flexDirection: "column", gap: 4 },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  progressNum: { fontSize: 11, fontWeight: "700" },
  progressLabel: { fontSize: 10 },
  progressLine: { position: "absolute", top: 12, right: -16, width: "100%", height: 2 },
  stepTitle: { fontSize: 20, fontWeight: "800" },
  stepSub: { fontSize: 13, marginTop: -8 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontSize: 15, fontWeight: "700" },
  optionDesc: { fontSize: 12, marginTop: 2 },
  dateScroll: { marginHorizontal: -20 },
  dayChip: {
    width: 58,
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginHorizontal: 4,
  },
  dayLabel: { fontSize: 11, fontWeight: "600" },
  dayNum: { fontSize: 20, fontWeight: "800" },
  dayMonth: { fontSize: 10 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  timeText: { fontSize: 14, fontWeight: "600" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  reviewCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  payCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginTop: 0 },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  reviewKey: { fontSize: 13 },
  reviewVal: { fontSize: 13, fontWeight: "600" },
  razorpayRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  secureNote: { fontSize: 11, paddingHorizontal: 12, paddingBottom: 10 },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
