import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
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
import { useNotifications } from "@/context/NotificationContext";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const SESSION_TYPES = [
  { id: "checkin", label: "Quick Check-in", duration: "15 min", desc: "Progress review & quick questions" },
  { id: "consultation", label: "Consultation", duration: "30 min", desc: "Detailed diet analysis & plan adjustments" },
  { id: "review", label: "Detailed Review", duration: "45 min", desc: "Comprehensive health & nutrition deep-dive" },
] as const;

const BASE_SLOTS = ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM", "6:00 PM"];
const REDUCED_SLOTS = ["11:30 AM", "4:30 PM"];

function getNext7Days(): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getSlotsForDay(d: Date): string[] {
  const dow = d.getDay();
  if (dow === 0) return REDUCED_SLOTS;
  if (dow === 6) return BASE_SLOTS.slice(0, 3);
  return BASE_SLOTS;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
}

function formatDateNum(d: Date): string {
  return String(d.getDate());
}

function formatFullDate(d: Date, time: string): string {
  const label = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return `${label}, ${time}`;
}

function formatISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildCalendarLink(date: Date, time: string, coachName: string, sessionType: string): string {
  const [t, ampm] = time.split(" ");
  const [h, m] = t.split(":");
  let hour = parseInt(h);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const start = new Date(date);
  start.setHours(hour, parseInt(m), 0, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const title = encodeURIComponent(`Session with ${coachName} (${sessionType})`);
  const details = encodeURIComponent(`Your ${sessionType} session with ${coachName} via Vitalé.`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}

type Step = "date" | "time" | "confirm";

export default function BookSessionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { coachName = "Your Coach", programTitle = "Your Program" } = useLocalSearchParams<{
    coachName: string;
    programTitle: string;
  }>();
  const { addNotification } = useNotifications();

  const days = getNext7Days();
  const [step, setStep] = useState<Step>("date");
  const [selectedDay, setSelectedDay] = useState<Date>(days[1]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<(typeof SESSION_TYPES)[number]["id"]>("consultation");
  const [booked, setBooked] = useState(false);

  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  const slots = getSlotsForDay(selectedDay);
  const sessionType = SESSION_TYPES.find((s) => s.id === selectedType)!;

  function handleConfirmBooking() {
    if (!selectedTime) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const fullDateTime = formatFullDate(selectedDay, selectedTime);
    addNotification({
      type: "session",
      title: "Session booked!",
      body: `${sessionType.label} with ${coachName} on ${fullDateTime}. Reminder set for 15 min before.`,
      route: "/my-sessions",
    });

    setBooked(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  if (booked && selectedTime) {
    const fullDateTime = formatFullDate(selectedDay, selectedTime);
    const calLink = buildCalendarLink(selectedDay, selectedTime, coachName, sessionType.label);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Booking Confirmed</Text>
          <View style={{ width: 38 }} />
        </View>

        <Animated.View style={[styles.successContainer, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
          <View style={[styles.successCheck, { backgroundColor: "#22C55E" }]}>
            <Feather name="check" size={40} color="#fff" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Session Booked!</Text>
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.successRow}>
              <Feather name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.successLabel, { color: colors.foreground }]}>{fullDateTime}</Text>
            </View>
            <View style={[styles.successDivider, { backgroundColor: colors.border }]} />
            <View style={styles.successRow}>
              <Feather name="user" size={16} color={colors.primary} />
              <Text style={[styles.successLabel, { color: colors.foreground }]}>{coachName}</Text>
            </View>
            <View style={[styles.successDivider, { backgroundColor: colors.border }]} />
            <View style={styles.successRow}>
              <Feather name="clock" size={16} color={colors.primary} />
              <Text style={[styles.successLabel, { color: colors.foreground }]}>{sessionType.label} · {sessionType.duration}</Text>
            </View>
          </View>
          <View style={[styles.reminderNote, { backgroundColor: "#3B82F620", borderColor: "#3B82F633" }]}>
            <Feather name="bell" size={14} color="#3B82F6" />
            <Text style={[styles.reminderText, { color: "#3B82F6" }]}>
              A reminder will be sent 15 minutes before your session.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.calBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => Linking.openURL(calLink)}
          >
            <Feather name="calendar" size={16} color={colors.foreground} />
            <Text style={[styles.calBtnText, { color: colors.foreground }]}>Add to Google Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <TouchableOpacity onPress={() => (step === "date" ? router.back() : setStep(step === "time" ? "date" : "time"))} style={styles.backBtn}>
          <Feather name={step === "date" ? "x" : "arrow-left"} size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Book a Session</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{coachName}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.stepDots}>
        {(["date", "time", "confirm"] as Step[]).map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  step === s ? colors.primary :
                  (step === "time" && i === 0) || (step === "confirm" && i <= 1)
                    ? colors.primary + "66"
                    : colors.border,
                width: step === s ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {step === "date" && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a Date</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Select from available dates in the next 7 days</Text>
            <View style={styles.calendarStrip}>
              {days.map((d) => {
                const isSelected = formatISODate(d) === formatISODate(selectedDay);
                const isToday = formatISODate(d) === formatISODate(new Date());
                return (
                  <TouchableOpacity
                    key={formatISODate(d)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDay(d);
                      setSelectedTime(null);
                    }}
                  >
                    <Text style={[styles.dayLabel, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                      {formatDayLabel(d)}
                    </Text>
                    <Text style={[styles.dayNum, { color: isSelected ? "#fff" : colors.foreground }]}>
                      {formatDateNum(d)}
                    </Text>
                    {isToday && (
                      <View style={[styles.todayDot, { backgroundColor: isSelected ? "#fff" : colors.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.availableLabel, { color: colors.mutedForeground }]}>
              {getSlotsForDay(selectedDay).length} slots available
            </Text>
          </View>
        )}

        {step === "time" && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose Time & Type</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {selectedDay.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>AVAILABLE SLOTS</Text>
            <View style={styles.slotsGrid}>
              {slots.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: selectedTime === slot ? colors.primary : colors.card,
                      borderColor: selectedTime === slot ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTime(slot);
                  }}
                >
                  <Feather name="clock" size={13} color={selectedTime === slot ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.slotText, { color: selectedTime === slot ? "#fff" : colors.foreground }]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>SESSION TYPE</Text>
            {SESSION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: selectedType === type.id ? colors.primary + "10" : colors.card,
                    borderColor: selectedType === type.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(type.id);
                }}
              >
                <View style={styles.typeCardLeft}>
                  <View style={[styles.typeRadio, { borderColor: selectedType === type.id ? colors.primary : colors.border }]}>
                    {selectedType === type.id && (
                      <View style={[styles.typeRadioInner, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeLabel, { color: colors.foreground }]}>{type.label}</Text>
                    <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>{type.desc}</Text>
                  </View>
                </View>
                <View style={[styles.typeDuration, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.typeDurationText, { color: colors.mutedForeground }]}>{type.duration}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === "confirm" && selectedTime && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirm Booking</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Review your session details below</Text>

            <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.confirmRow}>
                <View style={[styles.confirmIconWrap, { backgroundColor: "#8B5CF620" }]}>
                  <Feather name="calendar" size={18} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Date & Time</Text>
                  <Text style={[styles.confirmValue, { color: colors.foreground }]}>
                    {formatFullDate(selectedDay, selectedTime)}
                  </Text>
                </View>
              </View>
              <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />
              <View style={styles.confirmRow}>
                <View style={[styles.confirmIconWrap, { backgroundColor: "#22C55E20" }]}>
                  <Feather name="user" size={18} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Coach</Text>
                  <Text style={[styles.confirmValue, { color: colors.foreground }]}>{coachName}</Text>
                </View>
              </View>
              <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />
              <View style={styles.confirmRow}>
                <View style={[styles.confirmIconWrap, { backgroundColor: "#3B82F620" }]}>
                  <Feather name="clock" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Session Type</Text>
                  <Text style={[styles.confirmValue, { color: colors.foreground }]}>
                    {sessionType.label} · {sessionType.duration}
                  </Text>
                  <Text style={[styles.confirmDesc, { color: colors.mutedForeground }]}>{sessionType.desc}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.reminderNote, { backgroundColor: "#3B82F620", borderColor: "#3B82F633" }]}>
              <Feather name="bell" size={14} color="#3B82F6" />
              <Text style={[styles.reminderText, { color: "#3B82F6" }]}>
                You'll receive a reminder 15 minutes before the session starts.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        {step === "date" && (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep("time");
            }}
          >
            <Text style={styles.nextBtnText}>Select Time</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {step === "time" && (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: selectedTime ? colors.primary : colors.border }]}
            disabled={!selectedTime}
            onPress={() => {
              if (!selectedTime) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep("confirm");
            }}
          >
            <Text style={[styles.nextBtnText, { color: selectedTime ? "#fff" : colors.mutedForeground }]}>Review Booking</Text>
            <Feather name="arrow-right" size={18} color={selectedTime ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        )}
        {step === "confirm" && (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={handleConfirmBooking}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.nextBtnText}>Confirm Booking</Text>
          </TouchableOpacity>
        )}
      </View>
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
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  stepDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  stepDot: { height: 8, borderRadius: 4 },
  stepContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  stepTitle: { fontSize: 22, fontWeight: "800" },
  stepSub: { fontSize: 14, lineHeight: 20, marginTop: -8 },
  calendarStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  dayChip: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 2,
  },
  dayLabel: { fontSize: 10, fontWeight: "700" },
  dayNum: { fontSize: 17, fontWeight: "800" },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
  availableLabel: { fontSize: 13, textAlign: "center", marginTop: -4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  slotText: { fontSize: 14, fontWeight: "600" },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  typeCardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  typeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 },
  typeRadioInner: { width: 10, height: 10, borderRadius: 5 },
  typeLabel: { fontSize: 15, fontWeight: "700" },
  typeDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  typeDuration: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeDurationText: { fontSize: 11, fontWeight: "600" },
  confirmCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  confirmRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
  confirmIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  confirmLabel: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  confirmValue: { fontSize: 15, fontWeight: "700" },
  confirmDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  confirmDivider: { height: 1, marginHorizontal: 16 },
  reminderNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reminderText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  successContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 20,
  },
  successCheck: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 26, fontWeight: "900" },
  successCard: { width: "100%", borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  successRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  successLabel: { fontSize: 15, fontWeight: "600" },
  successDivider: { height: 1 },
  calBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  calBtnText: { fontSize: 15, fontWeight: "600" },
  doneBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
