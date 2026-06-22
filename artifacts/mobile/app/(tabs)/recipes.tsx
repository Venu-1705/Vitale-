import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCommunity, type Recipe } from "@/context/CommunityContext";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "coach-picks", label: "Coach Picks" },
  { id: "most-saved", label: "Most Saved" },
  { id: "my-recipes", label: "My Recipes" },
  { id: "Veg", label: "Veg" },
  { id: "Vegan", label: "Vegan" },
  { id: "High Protein", label: "High Protein" },
  { id: "Low Carb", label: "Low Carb" },
  { id: "Gluten Free", label: "Gluten Free" },
];

function RecipeGridCard({ recipe }: { recipe: Recipe }) {
  const colors = useColors();
  const { toggleRecipeSave } = useCommunity();

  const IMAGES: Record<string, any> = {
    recipe1: require("@/assets/images/recipe-smoothie.png"),
    recipe2: require("@/assets/images/recipe-salmon.png"),
    recipe3: require("@/assets/images/recipe-hero.png"),
    recipe4: require("@/assets/images/recipe-hero.png"),
  };

  return (
    <TouchableOpacity
      style={[styles.gridCard, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.photoContainer}>
        <Image
          source={IMAGES[recipe.id] ?? require("@/assets/images/recipe-hero.png")}
          style={styles.recipePhoto}
          resizeMode="cover"
        />
        <View style={[styles.calBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Feather name="zap" size={10} color="#fff" />
          <Text style={styles.calText}>{recipe.nutrition.calories}</Text>
        </View>
        {recipe.isCoachPick && (
          <View style={[styles.coachPickBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        )}
        <TouchableOpacity
          style={styles.bookmarkOverlay}
          onPress={() => toggleRecipeSave(recipe.id)}
        >
          <Ionicons
            name={recipe.saved ? "bookmark" : "bookmark-outline"}
            size={18}
            color={recipe.saved ? colors.primary : "#fff"}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={styles.authorRow}>
          <View style={[styles.authorAvatar, { backgroundColor: colors.primary + "33" }]}>
            <Text style={[styles.authorInitial, { color: colors.primary }]}>
              {recipe.authorName[0]}
            </Text>
          </View>
          <Text style={[styles.authorName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {recipe.authorName}
          </Text>
          {recipe.authorIsCoach && (
            <View style={[styles.coachMini, { backgroundColor: colors.primary }]}>
              <Text style={styles.coachMiniText}>Coach</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recipes } = useCommunity();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = recipes.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === "coach-picks") return r.isCoachPick;
    if (activeFilter === "most-saved") return r.saved;
    if (activeFilter === "my-recipes") return r.authorId === "current_user";
    if (activeFilter !== "all") return r.tags.includes(activeFilter);
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Recipes</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search recipes..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.filtersRow}
          renderItem={({ item }) => {
            const active = activeFilter === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border },
                ]}
                onPress={() => setActiveFilter(item.id)}
              >
                <Text style={[styles.filterText, { color: active ? "#fff" : colors.mutedForeground }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <RecipeGridCard recipe={item} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Feather name="book-open" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No recipes found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try a different filter</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filtersRow: { gap: 8, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: "600" },
  row: { gap: 12 },
  gridCard: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  photoContainer: { position: "relative" },
  recipePhoto: { width: "100%", height: 130 },
  calBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  calText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  coachPickBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkOverlay: { position: "absolute", top: 6, right: 6, padding: 4 },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  authorAvatar: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  authorInitial: { fontSize: 9, fontWeight: "700" },
  authorName: { fontSize: 11, flex: 1 },
  coachMini: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  coachMiniText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 14 },
});
