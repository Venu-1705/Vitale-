import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { useMeal } from "@/context/MealContext";
import { useMyEnrollments } from "@/lib/programs";
import { useHealth } from "@/context/HealthContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type AIChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
};

const CHIPS = [
  "What should I eat?",
  "Am I on track?",
  "Meal alternatives",
  "My progress",
];

function buildContext(opts: {
  greeting: string;
  programName: string;
  streak: number;
  loggedMeals: number;
  totalMeals: number;
  conditions: string[];
  caloriesGoal: number;
  caloriesToday: number;
}) {
  return opts;
}

function getAIResponse(msg: string, ctx: ReturnType<typeof buildContext>): string {
  const lower = msg.toLowerCase();

  if (lower.includes("eat") || lower.includes("food") || lower.includes("meal") && lower.includes("what")) {
    const h = new Date().getHours();
    if (h < 10) return `Good ${ctx.greeting.toLowerCase().replace("good ", "")}! Since it's morning, your assigned plan suggests a protein-rich breakfast to kickstart your metabolism. Given your ${ctx.conditions.includes("PCOS") ? "PCOS condition, go easy on refined carbs and pair it with healthy fats" : "goals, a balanced breakfast with protein and fibre sets you up well"}. Would you like me to suggest an alternative?`;
    if (h < 15) return `For lunch, stick close to your meal plan — it's been designed around your ${ctx.conditions.length > 0 ? ctx.conditions.join(" & ") + " management" : "wellness goals"}. If you're eating out, opt for dal + sabzi + roti over fried options. Need help finding a healthy swap?`;
    if (h < 20) return `Dinner tonight from your plan is light and gut-friendly. ${ctx.conditions.includes("PCOS") ? "For PCOS, an early dinner before 8 PM and avoiding heavy carbs at night can really help with hormonal balance." : "Aim to finish eating by 8 PM for better digestion."}`;
    return `You're in the wind-down phase! Avoid heavy meals now. A small snack like nuts or warm milk is fine if you're hungry. Your ${ctx.programName || "wellness program"} recommends keeping late-night eating minimal.`;
  }

  if (lower.includes("track") || lower.includes("progress") || lower.includes("doing")) {
    const adh = Math.round((ctx.loggedMeals / ctx.totalMeals) * 100);
    if (ctx.loggedMeals === ctx.totalMeals) return `You're absolutely on track today! All ${ctx.totalMeals} meals logged, ${ctx.streak}-day streak going strong. You're in the top performers in your league this week. Keep it up!`;
    if (ctx.loggedMeals >= 2) return `You're doing well! ${ctx.loggedMeals}/${ctx.totalMeals} meals logged today (${adh}% adherence). Your ${ctx.streak}-day streak is intact as long as you log one more main meal today. You're on the right path.`;
    if (ctx.loggedMeals === 1) return `You've logged ${ctx.loggedMeals} meal so far today. Log your lunch or dinner to protect your ${ctx.streak > 0 ? ctx.streak + "-day" : ""} streak. Your calorie target for today is ${ctx.caloriesGoal} kcal — you've had about ${ctx.caloriesToday} kcal so far.`;
    return `No meals logged yet today. That's okay — log your next meal right after eating to stay on track. Your streak will be at risk if you miss today. Tap the + button to quickly log!`;
  }

  if (lower.includes("alternative") || lower.includes("swap") || lower.includes("substitute")) {
    return `Smart planning! When swapping meals, aim to keep the protein roughly the same as your plan. For example, if your plan has paneer, you can swap with tofu, eggs, or grilled chicken (if non-veg). ${ctx.conditions.includes("PCOS") ? "For PCOS, prioritise protein and fibre-rich swaps and avoid high-sugar options." : "Try to keep calories within 20% of the planned meal."} Tap any meal card to log an alternative.`;
  }

  if (lower.includes("my progress") || lower.includes("summary") || lower.includes("week") || lower.includes("stats")) {
    return `Here's your snapshot: ${ctx.streak}-day streak, ${ctx.loggedMeals}/${ctx.totalMeals} meals today, ${ctx.caloriesToday}/${ctx.caloriesGoal} kcal consumed. ${ctx.programName ? `You're enrolled in "${ctx.programName}" — ` : ""}${ctx.conditions.length > 0 ? `your plan is tailored for ${ctx.conditions.join(" & ")} management.` : "keep going!"}  Check your Health Profile for the full trend chart.`;
  }

  if (lower.includes("pcos") || lower.includes("pcod")) {
    return `For PCOS management, the key pillars are: 1) Low-GI carbohydrates (millets, oats, quinoa), 2) High-protein meals to balance insulin, 3) Anti-inflammatory foods (turmeric, omega-3s, leafy greens), 4) Avoiding sugary drinks and processed foods. Your current meal plan is already optimised for this — stick to it as closely as possible!`;
  }

  if (lower.includes("water") || lower.includes("hydrat")) {
    return `Hydration matters hugely for ${ctx.conditions.includes("PCOS") ? "PCOS management and reducing bloating." : "overall health and metabolism."} Aim for 8 glasses (2L) a day. Tip: drink a glass before each meal — it helps with satiety and digestion. You can log your water intake using the + button on the home screen.`;
  }

  if (lower.includes("streak") || lower.includes("habit")) {
    if (ctx.streak >= 7) return `Amazing! A ${ctx.streak}-day streak shows real commitment. Science says habits take 21 days to form — you're well on your way! The key to maintaining it: log meals immediately after eating, set a reminder for your next meal time.`;
    if (ctx.streak > 0) return `You're on a ${ctx.streak}-day streak — great start! Each day you log is building a powerful health habit. The first 7 days are the hardest; after that, it becomes automatic.`;
    return `Starting a streak is the hardest part! Log your next meal and you've begun. Even a 3-day streak significantly improves nutritional awareness. I'm rooting for you!`;
  }

  const general = [
    `Great question! As your AI health companion, I'm here to help you navigate your ${ctx.programName || "wellness journey"}. I can answer questions about nutrition, your meal plan, progress, and more. What specific aspect would you like to explore?`,
    `Based on your profile${ctx.conditions.length > 0 ? ` (${ctx.conditions.join(", ")})` : ""}, I'd recommend focusing on consistency — logging meals every day, drinking 8 glasses of water, and following your assigned meal plan as closely as possible. Small daily wins add up to remarkable transformation.`,
    `Your body is unique! The meal plan assigned to you by your coach takes into account your specific goals and health conditions. Trust the process, stay hydrated, and feel free to ask me anything about your nutrition or health.`,
  ];
  return general[Math.floor(Math.random() * general.length)];
}

const TYPING_DELAY = 900;

const SEED_MSGS: AIChatMsg[] = [
  {
    id: "ai0",
    role: "assistant",
    text: "Hi! I'm your Vitalé AI health companion. Ask me anything about your nutrition, meal plan, or health goals. I have context about your current program and today's logs!",
    ts: Date.now() - 60000,
  },
];

export default function AskAIBubble() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMsg[]>(SEED_MSGS);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(true);
  const flatRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  const { todayMealPlan, todayLog, streak, getCaloriesToday, targets } = useMeal();
  const { data: enrollments = [] } = useMyEnrollments();
  const { profile } = useHealth();

  const loggedMeals = todayLog.length;
  const totalMeals = todayMealPlan.length;
  const activeEnrollment = enrollments.find((e) => e.status === "active") ?? null;
  const conditions = profile?.conditions ?? [];

  const ctx = buildContext({
    greeting: (() => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening"; return "Good night"; })(),
    programName: activeEnrollment?.programTitle ?? "",
    streak,
    loggedMeals,
    totalMeals,
    conditions,
    caloriesGoal: targets.calories,
    caloriesToday: getCaloriesToday(),
  });

  useEffect(() => {
    Animated.timing(tooltipAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(tooltipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setTooltipVisible(false));
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  function openSheet() {
    setTooltipVisible(false);
    setOpen(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }

  function closeSheet() {
    Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }).start(() => setOpen(false));
  }

  function sendMessage(text: string) {
    const userMsg: AIChatMsg = {
      id: Date.now().toString(),
      role: "user",
      text,
      ts: Date.now(),
    };
    setMessages(p => [...p, userMsg]);
    setDraft("");
    setTyping(true);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

    setTimeout(() => {
      const aiResponse = getAIResponse(text, ctx);
      const aiMsg: AIChatMsg = {
        id: Date.now().toString() + "ai",
        role: "assistant",
        text: aiResponse,
        ts: Date.now(),
      };
      setMessages(p => [...p, aiMsg]);
      setTyping(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }, TYPING_DELAY + Math.random() * 400);
  }

  const tabBarBottom = (Platform.OS === "web" ? 84 : 56 + insets.bottom);

  return (
    <>
      {tooltipVisible && (
        <Animated.View
          style={[styles.tooltip, {
            bottom: tabBarBottom + 58,
            right: 72,
            opacity: tooltipAnim,
            transform: [{ scale: tooltipAnim }],
          }]}
          pointerEvents="none"
        >
          <Text style={styles.tooltipText}>Ask me anything about your health!</Text>
          <View style={styles.tooltipArrow} />
        </Animated.View>
      )}

      <TouchableOpacity
        style={[styles.bubble, {
          bottom: tabBarBottom + 12,
          shadowColor: "#000",
        }]}
        onPress={openSheet}
        activeOpacity={0.85}
      >
        <Feather name="activity" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <Pressable style={styles.overlay} onPress={closeSheet} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.aiAvatar, { backgroundColor: "#22C55E" }]}>
                <Feather name="activity" size={16} color="#fff" />
              </View>
              <View>
                <Text style={[styles.aiName, { color: colors.foreground }]}>Vitalé AI</Text>
                <Text style={[styles.aiSub, { color: "#22C55E" }]}>Context-aware health assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {activeEnrollment && (
            <View style={[styles.contextBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Feather name="info" size={12} color={colors.primary} />
              <Text style={[styles.contextText, { color: colors.primary }]}>
                Using your {activeEnrollment.programTitle ?? "program"} context · {loggedMeals}/{totalMeals} meals today · {streak}-day streak
              </Text>
            </View>
          )}

          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: msg }) => (
              <View style={[styles.msgRow, msg.role === "user" ? styles.msgRight : styles.msgLeft]}>
                <View style={[
                  styles.msgBubble,
                  msg.role === "user"
                    ? { backgroundColor: "#22C55E" }
                    : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                ]}>
                  <Text style={[styles.msgText, { color: msg.role === "user" ? "#fff" : colors.foreground }]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            )}
            ListFooterComponent={typing ? (
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.typingText, { color: colors.mutedForeground }]}>Vitalé AI is thinking...</Text>
              </View>
            ) : null}
            onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          />

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => sendMessage(chip)}
                >
                  <Text style={[styles.chipText, { color: colors.primary }]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Ask about your health..."
                placeholderTextColor={colors.mutedForeground}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={() => { if (draft.trim()) sendMessage(draft.trim()); }}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: draft.trim() ? "#22C55E" : colors.border }]}
                onPress={() => { if (draft.trim()) sendMessage(draft.trim()); }}
                disabled={!draft.trim()}
              >
                <Feather name="send" size={18} color={draft.trim() ? "#fff" : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 99,
  },
  tooltip: {
    position: "absolute",
    right: 70,
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 200,
    zIndex: 100,
  },
  tooltipText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  tooltipArrow: {
    position: "absolute",
    right: -6,
    top: "50%",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: "#1F2937",
    borderTopWidth: 5,
    borderTopColor: "transparent",
    borderBottomWidth: 5,
    borderBottomColor: "transparent",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.72,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  dragHandle: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sheetHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  aiName: { fontSize: 15, fontWeight: "700" },
  aiSub: { fontSize: 11 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  contextText: { fontSize: 11, flex: 1 },
  msgRow: { maxWidth: "85%" },
  msgLeft: { alignSelf: "flex-start" },
  msgRight: { alignSelf: "flex-end" },
  msgBubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  msgText: { fontSize: 14, lineHeight: 20 },
  typingBubble: { alignSelf: "flex-start", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, marginTop: 4 },
  typingText: { fontSize: 13, fontStyle: "italic" },
  chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
