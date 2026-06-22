import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { ProductCard, type ProductCardData } from "@/components/shop/ProductCard";
import { apiGet } from "@/lib/api";

type SortKey = "default" | "price_asc" | "price_desc" | "rating" | "newest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Recommended" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "rating", label: "Highest Rated" },
  { key: "newest", label: "Newest First" },
];

export default function CategoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [sort, setSort] = useState<SortKey>("default");
  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [minDiscount, setMinDiscount] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["category-products", slug, sort, minPrice, maxPrice, minDiscount],
    queryFn: () => {
      const params = new URLSearchParams({
        sort,
        minPrice: String(minPrice * 100),
        maxPrice: String(maxPrice * 100),
        minDiscount: String(minDiscount),
      });
      return apiGet<{
        category: { name: string; slug: string } | null;
        products: any[];
        total: number;
      }>(`/shop/categories/${slug}/products?${params}`);
    },
    staleTime: 30_000,
  });

  const products = data?.products ?? [];
  const categoryName = data?.category?.name ?? slug?.charAt(0).toUpperCase() + (slug?.slice(1) ?? "");

  function mapProduct(p: any): ProductCardData {
    return {
      id: p.id,
      name: p.name,
      shortDescription: p.shortDescription ?? "",
      imageUrl: p.images?.[0] ?? "",
      avgRating: p.avgRating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      isBestseller: p.isBestseller,
      isNewInStore: p.isNewInStore,
      variants: (p.variants ?? []).map((v: any) => ({
        id: v.id,
        name: v.name,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        stockQty: v.stockQty,
        gstRate: p.gstRate ?? 18,
      })),
    };
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 16 : insets.top,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {categoryName}
        </Text>
        <Pressable onPress={() => setShowFilter(true)} style={styles.filterBtn}>
          <Feather name="sliders" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Sort bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.sortBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}
      >
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[
              styles.sortChip,
              sort === opt.key
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.muted },
            ]}
            onPress={() => setSort(opt.key)}
          >
            <Text
              style={[
                styles.sortChipText,
                { color: sort === opt.key ? "#fff" : colors.foreground },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Product count */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {isLoading ? "Loading…" : `${data?.total ?? 0} products`}
        </Text>
      </View>

      {/* Grid */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>Failed to load</Text>
          <Pressable onPress={() => refetch()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 15 }}>
            No products found
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => (
            <ProductCard product={mapProduct(item)} style={{ flex: 1 }} />
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={styles.filterOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilter(false)} />
          <View
            style={[
              styles.filterSheet,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 },
            ]}
          >
            <View style={styles.filterHandle} />
            <Text style={[styles.filterTitle, { color: colors.foreground }]}>
              Filter & Sort
            </Text>
            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>
              Min discount
            </Text>
            <View style={styles.discOptions}>
              {[0, 10, 20, 30, 40].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.discChip,
                    minDiscount === d
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.muted },
                  ]}
                  onPress={() => setMinDiscount(d)}
                >
                  <Text
                    style={{ color: minDiscount === d ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}
                  >
                    {d === 0 ? "Any" : `${d}%+`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowFilter(false)}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 2 },
  title: { flex: 1, fontSize: 18, fontWeight: "800" },
  filterBtn: { padding: 2 },
  sortBar: { borderBottomWidth: 1 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  sortChipText: { fontSize: 12, fontWeight: "600" },
  countRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  countText: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  filterOverlay: { flex: 1, justifyContent: "flex-end" },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  filterHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  filterTitle: { fontSize: 18, fontWeight: "800" },
  filterLabel: { fontSize: 13, fontWeight: "600" },
  discOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  discChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  applyBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  applyBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
