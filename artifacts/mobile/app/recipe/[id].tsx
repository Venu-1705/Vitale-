import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCommunity } from "@/context/CommunityContext";

const RECIPE_IMAGES: Record<string, any> = {
  recipe1: require("@/assets/images/recipe-smoothie.png"),
  recipe2: require("@/assets/images/recipe-salmon.png"),
  recipe3: require("@/assets/images/recipe-hero.png"),
  recipe4: require("@/assets/images/recipe-hero.png"),
};

function NutritionRing({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.ring, { borderColor: color + "55", backgroundColor: color + "12" }]}>
      <Text style={[styles.ringValue, { color }]}>{value}{unit}</Text>
      <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", icon: "sun", color: "#F59E0B" },
  { id: "lunch", label: "Lunch", icon: "coffee", color: "#3B82F6" },
  { id: "dinner", label: "Dinner", icon: "moon", color: "#8B5CF6" },
  { id: "snack", label: "Snack", icon: "zap", color: "#22C55E" },
] as const;

export default function RecipeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, toggleRecipeSave } = useCommunity();

  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [loggedSlot, setLoggedSlot] = useState<string | null>(null);
  const successOpacity = useRef(new Animated.Value(0)).current;

  function handleLogMeal(slotId: string, slotLabel: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMealPicker(false);
    setLoggedSlot(slotLabel);
    Animated.sequence([
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(successOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setLoggedSlot(null));
  }

  if (!recipe) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[{ color: colors.mutedForeground }]}>Recipe not found</Text>
      </View>
    );
  }

  const ratio = servings / recipe.servings;

  function toggleIngredient(id: string) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function scaleQty(qty: string): string {
    const num = parseFloat(qty);
    if (isNaN(num)) return qty;
    const scaled = num * ratio;
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={styles.heroContainer}>
          <Image
            source={RECIPE_IMAGES[recipe.id] ?? require("@/assets/images/recipe-hero.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={[styles.heroOverlay]} />
          <TouchableOpacity
            style={[styles.backOverlay, { top: Platform.OS === "web" ? 67 : insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <View style={styles.overlayCircle}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookmarkOverlay, { top: Platform.OS === "web" ? 67 : insets.top + 8 }]}
            onPress={() => toggleRecipeSave(recipe.id)}
          >
            <View style={styles.overlayCircle}>
              <Ionicons name={recipe.saved ? "bookmark" : "bookmark-outline"} size={20} color={recipe.saved ? colors.primary : "#fff"} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <Text style={[styles.recipeTitle, { color: colors.foreground }]}>{recipe.title}</Text>

          <View style={styles.authorRow}>
            <View style={[styles.authorAvatar, { backgroundColor: colors.primary + "33" }]}>
              <Text style={[styles.authorInitial, { color: colors.primary }]}>{recipe.authorName[0]}</Text>
            </View>
            <Text style={[styles.authorName, { color: colors.foreground }]}>{recipe.authorName}</Text>
            {recipe.authorIsCoach && (
              <View style={[styles.coachBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.coachText}>Coach</Text>
              </View>
            )}
            {recipe.isCoachPick && (
              <View style={[styles.starBadge, { backgroundColor: "#F59E0B22" }]}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.starText, { color: "#F59E0B" }]}>Coach Pick</Text>
              </View>
            )}
          </View>

          <View style={styles.nutritionRow}>
            <NutritionRing label="Calories" value={Math.round(recipe.nutrition.calories * ratio)} unit="" color={colors.primary} />
            <NutritionRing label="Protein" value={Math.round(recipe.nutrition.protein * ratio)} unit="g" color="#3B82F6" />
            <NutritionRing label="Carbs" value={Math.round(recipe.nutrition.carbs * ratio)} unit="g" color="#F59E0B" />
            <NutritionRing label="Fat" value={Math.round(recipe.nutrition.fat * ratio)} unit="g" color="#EF4444" />
          </View>

          <View style={[styles.servingsRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
            <View style={styles.servingsControl}>
              <TouchableOpacity
                style={[styles.servingBtn, { backgroundColor: colors.border }]}
                onPress={() => setServings((s) => Math.max(1, s - 1))}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.servingsCount, { color: colors.foreground }]}>{servings}</Text>
              <TouchableOpacity
                style={[styles.servingBtn, { backgroundColor: colors.border }]}
                onPress={() => setServings((s) => s + 1)}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
          {recipe.ingredients.map((ing) => {
            const checked = checkedIngredients.has(ing.id);
            return (
              <TouchableOpacity
                key={ing.id}
                style={[styles.ingredientRow, { borderBottomColor: colors.border }]}
                onPress={() => toggleIngredient(ing.id)}
              >
                <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" }]}>
                  {checked && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[styles.ingName, { color: checked ? colors.mutedForeground : colors.foreground, textDecorationLine: checked ? "line-through" : "none" }]}>
                  {ing.name}
                </Text>
                <Text style={[styles.ingQty, { color: colors.mutedForeground }]}>{scaleQty(ing.quantity)} {ing.unit}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>Steps</Text>
          {recipe.steps.map((step, idx) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumText}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{step.text}</Text>
            </View>
          ))}

          {recipe.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {recipe.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomActions,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 },
        ]}
      >
        <TouchableOpacity
          style={[styles.addMealBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowMealPicker(true);
          }}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.addMealText}>Add to Today's Meal Log</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shareBtn, { borderColor: colors.border }]}
          onPress={() => Haptics.selectionAsync()}
        >
          <Feather name="share" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <Modal visible={showMealPicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMealPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.mealPickerSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.mealPickerTitle, { color: colors.foreground }]}>
              Log to Meal Slot
            </Text>
            <Text style={[styles.mealPickerSub, { color: colors.mutedForeground }]}>
              {recipe.title} · {Math.round(recipe.nutrition.calories * (servings / recipe.servings))} cal
            </Text>
            <View style={styles.mealSlotsGrid}>
              {MEAL_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={[styles.mealSlotBtn, { backgroundColor: slot.color + "14", borderColor: slot.color + "55" }]}
                  onPress={() => handleLogMeal(slot.id, slot.label)}
                >
                  <View style={[styles.mealSlotIcon, { backgroundColor: slot.color + "22" }]}>
                    <Feather name={slot.icon as any} size={22} color={slot.color} />
                  </View>
                  <Text style={[styles.mealSlotLabel, { color: colors.foreground }]}>{slot.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.cancelSlotBtn, { borderColor: colors.border }]}
              onPress={() => setShowMealPicker(false)}
            >
              <Text style={[styles.cancelSlotText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {loggedSlot && (
        <Animated.View
          style={[styles.successToast, { backgroundColor: colors.card, opacity: successOpacity }]}
          pointerEvents="none"
        >
          <View style={[styles.successToastIcon, { backgroundColor: "#22C55E" }]}>
            <Feather name="check" size={16} color="#fff" />
          </View>
          <Text style={[styles.successToastText, { color: colors.foreground }]}>
            Added to <Text style={{ fontWeight: "700", color: "#22C55E" }}>{loggedSlot}</Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { position: "relative", height: 260 },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
  },
  backOverlay: { position: "absolute", left: 16 },
  bookmarkOverlay: { position: "absolute", right: 16 },
  overlayCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 16 },
  recipeTitle: { fontSize: 22, fontWeight: "800", lineHeight: 28, marginBottom: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  authorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  authorInitial: { fontSize: 12, fontWeight: "700" },
  authorName: { fontSize: 14, fontWeight: "500" },
  coachBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coachText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  starBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  starText: { fontSize: 11, fontWeight: "600" },
  nutritionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  ring: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  ringValue: { fontSize: 15, fontWeight: "800" },
  ringLabel: { fontSize: 10, fontWeight: "500", marginTop: 2 },
  servingsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20,
  },
  servingsLabel: { fontSize: 15, fontWeight: "600" },
  servingsControl: { flexDirection: "row", alignItems: "center", gap: 14 },
  servingBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  servingsCount: { fontSize: 17, fontWeight: "700", minWidth: 20, textAlign: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  ingredientRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  ingName: { flex: 1, fontSize: 14 },
  ingQty: { fontSize: 13 },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: "600" },
  bottomActions: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1,
  },
  addMealBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  addMealText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  shareBtn: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  mealPickerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, gap: 4,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  mealPickerTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  mealPickerSub: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  mealSlotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 16 },
  mealSlotBtn: {
    width: "44%", borderWidth: 1.5, borderRadius: 16,
    alignItems: "center", paddingVertical: 18, gap: 10,
  },
  mealSlotIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
  },
  mealSlotLabel: { fontSize: 14, fontWeight: "700" },
  cancelSlotBtn: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  cancelSlotText: { fontSize: 15, fontWeight: "600" },
  successToast: {
    position: "absolute", bottom: 100, left: 24, right: 24,
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  successToastIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  successToastText: { fontSize: 14, fontWeight: "600", flex: 1 },
});
