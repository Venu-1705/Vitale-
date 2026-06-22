import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
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
import { useMeal, type MealType } from "@/context/MealContext";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { XpToast } from "@/components/XpToast";

const SWITCH_REASONS = [
  "Not available",
  "Personal preference",
  "Social occasion",
  "Budget-friendly option",
  "Other",
];

const FOOD_DB = [
  { id: "f1", name: "Grilled Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { id: "f2", name: "Brown Rice (1 cup cooked)", calories: 215, protein: 5, carbs: 45, fat: 2 },
  { id: "f3", name: "Avocado Toast", calories: 290, protein: 8, carbs: 32, fat: 16 },
  { id: "f4", name: "Scrambled Eggs (2)", calories: 180, protein: 12, carbs: 2, fat: 14 },
  { id: "f5", name: "Whey Protein Shake", calories: 130, protein: 25, carbs: 5, fat: 2 },
  { id: "f6", name: "Greek Yogurt (150g)", calories: 90, protein: 15, carbs: 6, fat: 1 },
  { id: "f7", name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { id: "f8", name: "Peanut Butter Toast", calories: 280, protein: 10, carbs: 30, fat: 14 },
  { id: "f9", name: "Vegetable Stir Fry", calories: 220, protein: 8, carbs: 28, fat: 10 },
  { id: "f10", name: "Tuna Salad Wrap", calories: 340, protein: 28, carbs: 32, fat: 10 },
];

const RECENT_MEALS = [
  { name: "Protein Oats", calories: 350, protein: 22 },
  { name: "Chicken Wrap", calories: 420, protein: 35 },
  { name: "Dal Rice Bowl", calories: 480, protein: 18 },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function NutriBadge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[styles.nutriBadge, { backgroundColor: color + "18" }]}>
      <Text style={[styles.nutriValue, { color }]}>{value}{unit}</Text>
      <Text style={[styles.nutriLabel, { color: color + "cc" }]}>{label}</Text>
    </View>
  );
}

function NutritionCompare({
  planned,
  alt,
}: {
  planned: { calories: number; protein: number };
  alt: { calories: number; protein: number };
}) {
  const colors = useColors();
  const calDiff = alt.calories - planned.calories;
  const protDiff = alt.protein - planned.protein;

  return (
    <View style={[styles.compareContainer, { borderColor: colors.border }]}>
      <Text style={[styles.compareTitle, { color: colors.mutedForeground }]}>NUTRITION COMPARISON</Text>
      <View style={styles.compareRow}>
        <View style={styles.compareCol}>
          <Text style={[styles.compareColTitle, { color: colors.mutedForeground }]}>Planned</Text>
          <Text style={[styles.compareCalValue, { color: colors.foreground }]}>{planned.calories} cal</Text>
          <Text style={[styles.compareProtValue, { color: "#3B82F6" }]}>{planned.protein}g protein</Text>
        </View>
        <View style={[styles.compareDivider, { backgroundColor: colors.border }]} />
        <View style={styles.compareCol}>
          <Text style={[styles.compareColTitle, { color: colors.mutedForeground }]}>Your Choice</Text>
          <View style={styles.compareValueRow}>
            <Text style={[styles.compareCalValue, { color: colors.foreground }]}>{alt.calories} cal</Text>
            {calDiff !== 0 && (
              <Text style={{ fontSize: 11, fontWeight: "700", color: calDiff > 0 ? "#EF4444" : "#22C55E", marginLeft: 4 }}>
                {calDiff > 0 ? "+" : ""}{calDiff}
              </Text>
            )}
          </View>
          <View style={styles.compareValueRow}>
            <Text style={[styles.compareProtValue, { color: "#3B82F6" }]}>{alt.protein}g protein</Text>
            {protDiff !== 0 && (
              <Text style={{ fontSize: 11, fontWeight: "700", color: protDiff > 0 ? "#22C55E" : "#EF4444", marginLeft: 4 }}>
                {protDiff > 0 ? "+" : ""}{protDiff}g
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MealDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { todayMealPlan, getMealStatus, logMeal, logAlternativeMeal } = useMeal();

  const mealType = id as MealType;
  const plan = todayMealPlan.find((p) => p.id === mealType);
  const status = getMealStatus(mealType);

  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [showAlternative, setShowAlternative] = useState(false);
  const [altSearch, setAltSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<(typeof FOOD_DB)[0] | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [switchReason, setSwitchReason] = useState(SWITCH_REASONS[0]);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [xpTrigger, setXpTrigger] = useState(0);
  const [xpPoints, setXpPoints] = useState(10);
  const [showPerfectDay, setShowPerfectDay] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const perfectDayOpacity = useRef(new Animated.Value(0)).current;

  if (!plan) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Meal not found</Text>
      </View>
    );
  }

  const filteredFoods = altSearch.trim()
    ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(altSearch.toLowerCase()))
    : FOOD_DB.slice(0, 5);

  const altName = selectedFood?.name ?? manualName;
  const altCalories = selectedFood?.calories ?? (parseInt(manualCalories) || 0);
  const altProtein = selectedFood?.protein ?? (parseInt(manualProtein) || 0);

  function triggerCelebration(points: number, isPerfect: boolean) {
    setXpPoints(points);
    setConfettiTrigger((t) => t + 1);
    setXpTrigger((t) => t + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isPerfect) {
      setTimeout(() => {
        setShowPerfectDay(true);
        Animated.timing(perfectDayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 700);
      setTimeout(() => {
        Animated.timing(perfectDayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowPerfectDay(false);
          router.back();
        });
      }, 2800);
    } else {
      setTimeout(() => router.back(), 1400);
    }
  }

  function handleFollowPlan() {
    if (isLogging) return;
    setIsLogging(true);
    const { isPerfectDay } = logMeal(mealType);
    triggerCelebration(isPerfectDay ? 25 : 10, isPerfectDay);
  }

  function handleLogAlternative() {
    if (isLogging) return;
    if (!altName) {
      Alert.alert("Select or enter a meal first");
      return;
    }
    setIsLogging(true);
    const { isPerfectDay } = logAlternativeMeal(mealType, {
      name: altName,
      calories: altCalories,
      protein: altProtein,
      switchReason,
    });
    triggerCelebration(isPerfectDay ? 20 : 5, isPerfectDay);
  }

  const isLogged = !!status;

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
        <View style={styles.navCenter}>
          <Text style={[styles.navTitle, { color: colors.foreground }]}>
            {MEAL_TYPE_LABELS[mealType]}
          </Text>
          <Text style={[styles.navTime, { color: colors.mutedForeground }]}>{plan.time}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.mealNameSection}>
          <Text style={[styles.mealName, { color: colors.foreground }]}>{plan.name}</Text>
          {isLogged && (
            <View style={[styles.loggedBadge, {
              backgroundColor: status === "followed_plan" ? "#22C55E22" : "#F59E0B22",
            }]}>
              <Feather
                name={status === "followed_plan" ? "check-circle" : "edit-3"}
                size={14}
                color={status === "followed_plan" ? "#22C55E" : "#F59E0B"}
              />
              <Text style={{ fontSize: 12, fontWeight: "600", color: status === "followed_plan" ? "#22C55E" : "#F59E0B" }}>
                {status === "followed_plan" ? "Followed plan" : "Logged alternative"}
              </Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nutriRow}>
          <NutriBadge label="Calories" value={plan.nutrition.calories} unit=" kcal" color={colors.primary} />
          <NutriBadge label="Protein" value={plan.nutrition.protein} unit="g" color="#3B82F6" />
          <NutriBadge label="Carbs" value={plan.nutrition.carbs} unit="g" color="#F59E0B" />
          <NutriBadge label="Fat" value={plan.nutrition.fat} unit="g" color="#EF4444" />
          <NutriBadge label="Fiber" value={plan.nutrition.fiber} unit="g" color="#8B5CF6" />
        </ScrollView>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
          {plan.ingredients.map((ing, i) => (
            <View
              key={i}
              style={[styles.ingRow, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.ingDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.ingName, { color: colors.foreground }]}>{ing.name}</Text>
              <Text style={[styles.ingQty, { color: colors.mutedForeground }]}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.expandBtn, { borderTopColor: colors.border }]}
            onPress={() => setStepsExpanded(!stepsExpanded)}
          >
            <MaterialCommunityIcons name="chef-hat" size={16} color={colors.primary} />
            <Text style={[styles.expandText, { color: colors.primary }]}>
              {stepsExpanded ? "Hide recipe steps" : "View full recipe steps"}
            </Text>
            <Feather name={stepsExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
          </TouchableOpacity>

          {stepsExpanded && (
            <View style={styles.stepsContainer}>
              {plan.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {!isLogged && !showAlternative && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleFollowPlan}
            >
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>I followed this meal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={() => setShowAlternative(true)}
            >
              <Feather name="edit-3" size={18} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Log a different meal</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLogged && !showAlternative && (
          <View style={styles.actionButtons}>
            <View style={[styles.alreadyLoggedBox, { backgroundColor: colors.muted }]}>
              <Feather
                name={status === "followed_plan" ? "check-circle" : "edit-3"}
                size={20}
                color={status === "followed_plan" ? "#22C55E" : "#F59E0B"}
              />
              <Text style={[styles.alreadyLoggedText, { color: colors.foreground }]}>
                {status === "followed_plan" ? "Great work! Meal logged." : "Alternative meal logged."}
              </Text>
            </View>
          </View>
        )}

        {showAlternative && (
          <View style={[styles.altLogger, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.altLoggerHeader}>
              <Text style={[styles.altTitle, { color: colors.foreground }]}>Log a Different Meal</Text>
              <TouchableOpacity onPress={() => setShowAlternative(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search food..."
                placeholderTextColor={colors.mutedForeground}
                value={altSearch}
                onChangeText={(v) => { setAltSearch(v); setSelectedFood(null); }}
              />
            </View>

            {RECENT_MEALS.length > 0 && altSearch.trim().length === 0 && (
              <View>
                <Text style={[styles.altSubTitle, { color: colors.mutedForeground }]}>RECENT MEALS</Text>
                {RECENT_MEALS.map((m) => (
                  <TouchableOpacity
                    key={m.name}
                    style={[
                      styles.foodItem,
                      { borderColor: selectedFood?.name === m.name ? colors.primary : colors.border },
                    ]}
                    onPress={() => {
                      setSelectedFood({ id: m.name, name: m.name, calories: m.calories, protein: m.protein, carbs: 0, fat: 0 });
                      setManualName("");
                    }}
                  >
                    <Text style={[styles.foodName, { color: colors.foreground }]}>{m.name}</Text>
                    <Text style={[styles.foodMeta, { color: colors.mutedForeground }]}>
                      {m.calories} cal · {m.protein}g P
                    </Text>
                    {selectedFood?.name === m.name && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {filteredFoods.length > 0 && (
              <View>
                <Text style={[styles.altSubTitle, { color: colors.mutedForeground }]}>
                  {altSearch.trim() ? "RESULTS" : "SUGGESTIONS"}
                </Text>
                {filteredFoods.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.foodItem,
                      { borderColor: selectedFood?.id === f.id ? colors.primary : colors.border },
                    ]}
                    onPress={() => { setSelectedFood(f); setManualName(""); }}
                  >
                    <Text style={[styles.foodName, { color: colors.foreground }]}>{f.name}</Text>
                    <Text style={[styles.foodMeta, { color: colors.mutedForeground }]}>
                      {f.calories} cal · {f.protein}g protein
                    </Text>
                    {selectedFood?.id === f.id && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.altSubTitle, { color: colors.mutedForeground }]}>MANUAL ENTRY</Text>
            <TextInput
              style={[styles.manualInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Meal name"
              placeholderTextColor={colors.mutedForeground}
              value={manualName}
              onChangeText={(v) => { setManualName(v); setSelectedFood(null); }}
            />
            <View style={styles.manualRow}>
              <TextInput
                style={[styles.manualHalf, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Calories"
                placeholderTextColor={colors.mutedForeground}
                value={manualCalories}
                onChangeText={setManualCalories}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.manualHalf, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Protein (g)"
                placeholderTextColor={colors.mutedForeground}
                value={manualProtein}
                onChangeText={setManualProtein}
                keyboardType="numeric"
              />
            </View>

            <Text style={[styles.altSubTitle, { color: colors.mutedForeground }]}>WHY DID YOU SWITCH?</Text>
            <TouchableOpacity
              style={[styles.reasonSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => setShowReasonPicker(!showReasonPicker)}
            >
              <Text style={[styles.reasonText, { color: colors.foreground }]}>{switchReason}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showReasonPicker && (
              <View style={[styles.reasonDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {SWITCH_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonOption, { borderBottomColor: colors.border }]}
                    onPress={() => { setSwitchReason(r); setShowReasonPicker(false); }}
                  >
                    <Text style={[styles.reasonOption_text, { color: r === switchReason ? colors.primary : colors.foreground }]}>
                      {r}
                    </Text>
                    {r === switchReason && <Feather name="check" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(selectedFood || (manualName && altCalories > 0)) && (
              <NutritionCompare
                planned={{ calories: plan.nutrition.calories, protein: plan.nutrition.protein }}
                alt={{ calories: altCalories, protein: altProtein }}
              />
            )}

            <TouchableOpacity
              style={[
                styles.logAltBtn,
                { backgroundColor: altName ? "#F59E0B" : colors.border },
              ]}
              onPress={handleLogAlternative}
              disabled={!altName}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.logAltBtnText}>Log This Meal</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ConfettiBurst trigger={confettiTrigger} />
      <XpToast points={xpPoints} trigger={xpTrigger} />

      {showPerfectDay && (
        <Animated.View
          style={[styles.perfectDayOverlay, { opacity: perfectDayOpacity }]}
          pointerEvents="none"
        >
          <View style={[styles.perfectDayCard, { backgroundColor: colors.card }]}>
            <View style={[styles.perfectDayIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="star" size={36} color="#fff" />
            </View>
            <Text style={[styles.perfectDayTitle, { color: colors.foreground }]}>Perfect Day!</Text>
            <Text style={[styles.perfectDaySub, { color: colors.mutedForeground }]}>
              You logged all 3 meals today. Amazing consistency!
            </Text>
            <View style={[styles.perfectDayXP, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.perfectDayXPText, { color: colors.primary }]}>+15 Bonus XP</Text>
            </View>
          </View>
        </Animated.View>
      )}
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
  navCenter: { alignItems: "center" },
  navTitle: { fontSize: 16, fontWeight: "700" },
  navTime: { fontSize: 12, marginTop: 1 },
  mealNameSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 10 },
  mealName: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  loggedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  nutriRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  nutriBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: "center", minWidth: 70 },
  nutriValue: { fontSize: 16, fontWeight: "800" },
  nutriLabel: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", padding: 14, paddingBottom: 8 },
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  ingDot: { width: 6, height: 6, borderRadius: 3 },
  ingName: { flex: 1, fontSize: 14 },
  ingQty: { fontSize: 13 },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
  },
  expandText: { flex: 1, fontSize: 14, fontWeight: "600" },
  stepsContainer: { paddingHorizontal: 14, paddingBottom: 14 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21 },
  actionButtons: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: "600" },
  alreadyLoggedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  alreadyLoggedText: { fontSize: 15, fontWeight: "600" },
  altLogger: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  altLoggerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  altTitle: { fontSize: 16, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  altSubTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7, marginTop: 4 },
  foodItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 6,
    gap: 6,
  },
  foodName: { fontSize: 13, fontWeight: "600", flex: 1 },
  foodMeta: { fontSize: 11 },
  manualInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  manualRow: { flexDirection: "row", gap: 8 },
  manualHalf: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  reasonSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reasonText: { fontSize: 14 },
  reasonDropdown: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -6,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  reasonOption_text: { fontSize: 14 },
  compareContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  compareTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7, marginBottom: 10 },
  compareRow: { flexDirection: "row" },
  compareCol: { flex: 1, gap: 4 },
  compareColTitle: { fontSize: 11, fontWeight: "600" },
  compareCalValue: { fontSize: 15, fontWeight: "700" },
  compareProtValue: { fontSize: 13, fontWeight: "600" },
  compareValueRow: { flexDirection: "row", alignItems: "center" },
  compareDivider: { width: 1, marginHorizontal: 16 },
  logAltBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  logAltBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  perfectDayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  perfectDayCard: {
    width: 280,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  perfectDayIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  perfectDayTitle: { fontSize: 26, fontWeight: "900" },
  perfectDaySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  perfectDayXP: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  perfectDayXPText: { fontSize: 14, fontWeight: "800" },
});
