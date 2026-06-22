import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
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
import { useCommunity, type Poll, type Recipe, type RecipeIngredient, type RecipeStep } from "@/context/CommunityContext";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const UNITS = ["g", "kg", "ml", "L", "cup", "tbsp", "tsp", "oz", "whole", "slice", "piece", "scoop", "clove"];
const POLL_DURATIONS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
];

function RecipeSubForm({
  onAttach,
  onClose,
}: {
  onAttach: (r: Recipe) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { id: generateId(), name: "", quantity: "", unit: "g" },
  ]);
  const [steps, setSteps] = useState<RecipeStep[]>([{ id: generateId(), text: "" }]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  function addIngredient() {
    setIngredients((prev) => [...prev, { id: generateId(), name: "", quantity: "", unit: "g" }]);
  }

  function updateIngredient(id: string, field: keyof RecipeIngredient, value: string) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function removeIngredient(id: string) {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: generateId(), text: "" }]);
  }

  function updateStep(id: string, text: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function removeStep(id: string) {
    if (steps.length === 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAttach() {
    if (!title.trim()) {
      Alert.alert("Recipe Title Required");
      return;
    }
    const recipe: Recipe = {
      id: generateId(),
      title,
      photo: null,
      authorId: "current_user",
      authorName: "You",
      authorIsCoach: false,
      nutrition: {
        calories: parseInt(calories) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
      },
      ingredients: ingredients.filter((i) => i.name.trim()),
      steps: steps.filter((s) => s.text.trim()),
      servings: 1,
      tags: [],
      saved: false,
      isCoachPick: false,
      createdAt: Date.now(),
    };
    onAttach(recipe);
  }

  return (
    <View style={[styles.subForm, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.subFormHeader}>
        <Text style={[styles.subFormTitle, { color: colors.foreground }]}>Create Recipe</Text>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.recipeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        placeholder="Recipe title"
        placeholderTextColor={colors.mutedForeground}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>INGREDIENTS</Text>
      {ingredients.map((ing) => (
        <View key={ing.id} style={styles.ingredientRow}>
          <TextInput
            style={[styles.ingNameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Ingredient"
            placeholderTextColor={colors.mutedForeground}
            value={ing.name}
            onChangeText={(v) => updateIngredient(ing.id, "name", v)}
          />
          <TextInput
            style={[styles.ingQtyInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Qty"
            placeholderTextColor={colors.mutedForeground}
            value={ing.quantity}
            onChangeText={(v) => updateIngredient(ing.id, "quantity", v)}
            keyboardType="numeric"
          />
          <View style={[styles.unitPill, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.unitText, { color: colors.primary }]}>{ing.unit}</Text>
          </View>
          <TouchableOpacity onPress={() => removeIngredient(ing.id)}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.addRowBtn, { borderColor: colors.border }]}
        onPress={addIngredient}
      >
        <Feather name="plus" size={14} color={colors.primary} />
        <Text style={[styles.addRowText, { color: colors.primary }]}>Add ingredient</Text>
      </TouchableOpacity>

      <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>STEPS</Text>
      {steps.map((step, idx) => (
        <View key={step.id} style={styles.stepRow}>
          <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
            <Text style={styles.stepNumText}>{idx + 1}</Text>
          </View>
          <TextInput
            style={[styles.stepInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder={`Step ${idx + 1}`}
            placeholderTextColor={colors.mutedForeground}
            value={step.text}
            onChangeText={(v) => updateStep(step.id, v)}
            multiline
          />
          <TouchableOpacity onPress={() => removeStep(step.id)}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.addRowBtn, { borderColor: colors.border }]}
        onPress={addStep}
      >
        <Feather name="plus" size={14} color={colors.primary} />
        <Text style={[styles.addRowText, { color: colors.primary }]}>Add step</Text>
      </TouchableOpacity>

      <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>NUTRITION (per serving)</Text>
      <View style={styles.nutritionRow}>
        {[
          { label: "Cal", value: calories, setter: setCalories },
          { label: "Protein", value: protein, setter: setProtein },
          { label: "Carbs", value: carbs, setter: setCarbs },
          { label: "Fat", value: fat, setter: setFat },
        ].map((n) => (
          <View key={n.label} style={styles.nutritionField}>
            <TextInput
              style={[styles.nutritionInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              value={n.value}
              onChangeText={n.setter}
              keyboardType="numeric"
            />
            <Text style={[styles.nutritionLabel, { color: colors.mutedForeground }]}>{n.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.attachBtn, { backgroundColor: colors.primary }]}
        onPress={handleAttach}
      >
        <Text style={styles.attachBtnText}>Attach to Post</Text>
      </TouchableOpacity>
    </View>
  );
}

function PollSubForm({
  onAttach,
  onClose,
}: {
  onAttach: (p: Poll) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [durationIdx, setDurationIdx] = useState(1);

  function addOption() {
    if (options.length >= 4) return;
    setOptions((prev) => [...prev, ""]);
  }

  function updateOption(idx: number, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAttach() {
    if (!question.trim()) {
      Alert.alert("Poll question required");
      return;
    }
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      Alert.alert("At least 2 options required");
      return;
    }
    const duration = POLL_DURATIONS[durationIdx];
    const poll: Poll = {
      id: generateId(),
      question,
      options: validOptions.map((o, i) => ({ id: `opt${i}`, text: o, votes: 0 })),
      totalVotes: 0,
      userVoteId: null,
      durationDays: duration.days,
      endsAt: Date.now() + duration.days * 24 * 60 * 60 * 1000,
    };
    onAttach(poll);
  }

  return (
    <View style={[styles.subForm, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.subFormHeader}>
        <Text style={[styles.subFormTitle, { color: colors.foreground }]}>Create Poll</Text>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.recipeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        placeholder="Ask a question..."
        placeholderTextColor={colors.mutedForeground}
        value={question}
        onChangeText={setQuestion}
      />

      <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>OPTIONS</Text>
      {options.map((opt, idx) => (
        <View key={idx} style={styles.pollOptionRow}>
          <TextInput
            style={[styles.pollOptionInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder={`Option ${idx + 1}`}
            placeholderTextColor={colors.mutedForeground}
            value={opt}
            onChangeText={(v) => updateOption(idx, v)}
          />
          {options.length > 2 && (
            <TouchableOpacity onPress={() => removeOption(idx)}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {options.length < 4 && (
        <TouchableOpacity
          style={[styles.addRowBtn, { borderColor: colors.border }]}
          onPress={addOption}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.addRowText, { color: colors.primary }]}>Add option (max 4)</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>DURATION</Text>
      <View style={styles.durationRow}>
        {POLL_DURATIONS.map((d, idx) => (
          <TouchableOpacity
            key={d.days}
            style={[
              styles.durationBtn,
              {
                backgroundColor: durationIdx === idx ? colors.primary : colors.card,
                borderColor: durationIdx === idx ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setDurationIdx(idx)}
          >
            <Text style={[styles.durationText, { color: durationIdx === idx ? "#fff" : colors.foreground }]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.attachBtn, { backgroundColor: colors.primary }]}
        onPress={handleAttach}
      >
        <Text style={styles.attachBtnText}>Attach to Post</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CreatePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { channels, createPost } = useCommunity();
  const [content, setContent] = useState("");
  const [channelId, setChannelId] = useState("general");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [attachedRecipe, setAttachedRecipe] = useState<Recipe | null>(null);
  const [attachedPoll, setAttachedPoll] = useState<Poll | null>(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const hasContent = content.trim().length > 0 || !!imageUri || !!attachedRecipe || !!attachedPoll;
  const selectedChannel = channels.find((c) => c.id === channelId) ?? channels[1];

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handlePost() {
    if (!hasContent || isPosting) return;
    setIsPosting(true);
    try {
      await createPost({
        channelId,
        content,
        imageUrl: imageUri,
        recipe: attachedRecipe,
        poll: attachedPoll,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Failed to post", "Please try again.");
    } finally {
      setIsPosting(false);
    }
  }

  const nonRecipeChannels = channels.filter((c) => c.id !== "all");

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 },
        ]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.channelSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => setShowChannelPicker(!showChannelPicker)}
        >
          <Text style={[styles.channelText, { color: colors.foreground }]}>{selectedChannel.label}</Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.postBtn,
            { backgroundColor: hasContent && !isPosting ? colors.primary : colors.border },
          ]}
          onPress={handlePost}
          disabled={!hasContent || isPosting}
        >
          <Text style={[styles.postBtnText, { color: hasContent && !isPosting ? "#fff" : colors.mutedForeground }]}>
            {isPosting ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>

      {showChannelPicker && (
        <View style={[styles.channelDropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}>
          {nonRecipeChannels.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={[styles.channelOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setChannelId(ch.id);
                setShowChannelPicker(false);
              }}
            >
              <Text style={[styles.channelOptionText, { color: ch.id === channelId ? colors.primary : colors.foreground }]}>
                {ch.label}
              </Text>
              {ch.id === channelId && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.composerRow}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.userAvatarText}>Y</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.foreground }]}>You</Text>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Share something with the community..."
              placeholderTextColor={colors.mutedForeground}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </View>

        {imageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
              <View style={[styles.removeImageCircle, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                <Feather name="x" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {attachedRecipe && (
          <View style={[styles.attachedCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.attachedCardHeader}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={colors.primary} />
              <Text style={[styles.attachedTitle, { color: colors.foreground }]} numberOfLines={1}>
                {attachedRecipe.title}
              </Text>
              <TouchableOpacity onPress={() => setAttachedRecipe(null)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.attachedMeta, { color: colors.mutedForeground }]}>
              {attachedRecipe.nutrition.calories} cal | {attachedRecipe.ingredients.length} ingredients | {attachedRecipe.steps.length} steps
            </Text>
          </View>
        )}

        {attachedPoll && (
          <View style={[styles.attachedCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.attachedCardHeader}>
              <Feather name="bar-chart-2" size={16} color={colors.primary} />
              <Text style={[styles.attachedTitle, { color: colors.foreground }]} numberOfLines={1}>
                {attachedPoll.question}
              </Text>
              <TouchableOpacity onPress={() => setAttachedPoll(null)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.attachedMeta, { color: colors.mutedForeground }]}>
              {attachedPoll.options.length} options | {POLL_DURATIONS.find((d) => d.days === attachedPoll.durationDays)?.label}
            </Text>
          </View>
        )}

        {showRecipeForm && (
          <RecipeSubForm
            onAttach={(r) => {
              setAttachedRecipe(r);
              setShowRecipeForm(false);
            }}
            onClose={() => setShowRecipeForm(false)}
          />
        )}

        {showPollForm && (
          <PollSubForm
            onAttach={(p) => {
              setAttachedPoll(p);
              setShowPollForm(false);
            }}
            onClose={() => setShowPollForm(false)}
          />
        )}
      </ScrollView>

      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity style={styles.toolbarBtn} onPress={handlePickImage}>
          <Feather name="camera" size={22} color={imageUri ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => {
            setShowPollForm(false);
            setShowRecipeForm(!showRecipeForm);
          }}
        >
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={22}
            color={showRecipeForm || attachedRecipe ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => {
            setShowRecipeForm(false);
            setShowPollForm(!showPollForm);
          }}
        >
          <Feather
            name="bar-chart-2"
            size={22}
            color={showPollForm || attachedPoll ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: { padding: 4 },
  channelSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  channelText: { fontSize: 14, fontWeight: "600" },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { fontSize: 14, fontWeight: "700" },
  channelDropdown: {
    position: "absolute",
    top: 80,
    left: 56,
    right: 80,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
    overflow: "hidden",
  },
  channelOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  channelOptionText: { fontSize: 14 },
  composerRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  userName: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  textInput: { fontSize: 15, lineHeight: 22, minHeight: 100 },
  imagePreviewContainer: { marginHorizontal: 68, marginTop: 12, borderRadius: 12, overflow: "hidden" },
  imagePreview: { width: "100%", height: 200 },
  removeImageBtn: { position: "absolute", top: 8, right: 8 },
  removeImageCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  attachedCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  attachedCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  attachedTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  attachedMeta: { fontSize: 12 },
  toolbar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 4,
    borderTopWidth: 1,
  },
  toolbarBtn: { padding: 10, borderRadius: 10 },
  subForm: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  subFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subFormTitle: { fontSize: 16, fontWeight: "700" },
  subLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, marginTop: 4 },
  recipeInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ingNameInput: {
    flex: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
  },
  ingQtyInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
  },
  unitPill: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  unitText: { fontSize: 12, fontWeight: "600" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  stepNumText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  stepInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    minHeight: 40,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  addRowText: { fontSize: 13, fontWeight: "600" },
  nutritionRow: { flexDirection: "row", gap: 8 },
  nutritionField: { flex: 1, alignItems: "center", gap: 4 },
  nutritionInput: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    textAlign: "center",
  },
  nutritionLabel: { fontSize: 10, fontWeight: "600" },
  attachBtn: { borderRadius: 12, padding: 12, alignItems: "center", marginTop: 4 },
  attachBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollOptionInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  durationRow: { flexDirection: "row", gap: 8 },
  durationBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  durationText: { fontSize: 13, fontWeight: "600" },
});
