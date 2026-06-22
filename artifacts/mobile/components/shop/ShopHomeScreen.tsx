import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { PromoCarousel } from "@/components/shop/PromoCarousel";
import { StatStrip } from "@/components/shop/StatStrip";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { ProductCard, type ProductCardData } from "@/components/shop/ProductCard";
import { useCart } from "@/context/CartContext";
import { apiGet } from "@/lib/api";

function fetchShopHome() {
  return apiGet<{
    banners: any[];
    categories: any[];
    bestsellers: any[];
    offers: any[];
    newInStore: any[];
    coachCurated: any[];
    featured: any | null;
    stats: any;
  }>("/shop/home");
}

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 32 - 10) / 2;

export function mapProduct(p: any): ProductCardData {
  return {
    id: p.id,
    name: p.name,
    shortDescription: p.shortDescription ?? "",
    imageUrl:
      p.images?.[0] ??
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
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

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600" }}>
            See all
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CoachCuratedCard({ rec, colors }: { rec: any; colors: any }) {
  return (
    <Pressable
      style={[
        styles.curatedCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() =>
        router.push(
          `/(tabs)/resources/shop/product/${rec.product?.id}` as any,
        )
      }
    >
      <View style={styles.curatedCoach}>
        <View style={[styles.coachAvatar, { backgroundColor: "#F0FDF4" }]}>
          <Text style={[styles.coachInitials, { color: "#16A34A" }]}>
            {(rec.coachName ?? "C")
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.coachName, { color: colors.foreground }]}>
            {rec.coachName}
          </Text>
          {rec.clinicalNote && (
            <Text
              style={[styles.clinicalNote, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              "{rec.clinicalNote}"
            </Text>
          )}
        </View>
      </View>
      {rec.product && (
        <View style={[styles.curatedProduct, { backgroundColor: colors.muted }]}>
          <Image
            source={{ uri: rec.product.images?.[0] }}
            style={styles.curatedImg}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.curatedName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {rec.product.name}
            </Text>
            {rec.product.variants?.[0] && (
              <Text style={[styles.curatedPrice, { color: "#22C55E" }]}>
                ₹{Math.round(rec.product.variants[0].pricePaise / 100)}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      )}
    </Pressable>
  );
}

function FeaturedBlock({ product, colors }: { product: any; colors: any }) {
  const { addItem } = useCart();
  const variant = product.variants?.[0];

  return (
    <View style={[styles.featuredBlock, { backgroundColor: "#0F1923" }]}>
      <Image
        source={{ uri: product.images?.[0] }}
        style={styles.featuredImg}
        contentFit="cover"
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(0,0,0,0.55)" },
        ]}
      />
      <View style={styles.featuredContent}>
        <Text style={styles.featuredTag}>Featured Product</Text>
        <Text style={styles.featuredName}>{product.name}</Text>
        <View style={styles.featuredBenefits}>
          {(product.benefits ?? []).slice(0, 3).map((b: string) => (
            <View key={b} style={styles.benefitRow}>
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>
        {variant && (
          <Pressable
            style={styles.featuredBtn}
            onPress={() => {
              addItem({
                productId: product.id,
                variantId: variant.id,
                name: product.name,
                variantName: variant.name,
                pricePaise: variant.pricePaise,
                mrpPaise: variant.mrpPaise,
                imageUrl: product.images?.[0] ?? "",
                qty: 1,
                stockQty: variant.stockQty,
                gstRate: product.gstRate ?? 18,
                organizationId: product.organizationId,
              });
              router.push("/(tabs)/resources/shop/cart" as any);
            }}
          >
            <Text style={styles.featuredBtnText}>
              Shop Now · ₹{Math.round(variant.pricePaise / 100)}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function EmailCapture({ colors }: { colors: any }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <View
      style={[
        styles.emailCapture,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.emailTitle, { color: colors.foreground }]}>
        Get wellness tips &amp; exclusive offers
      </Text>
      {subscribed ? (
        <View style={styles.subscribedRow}>
          <Feather name="check-circle" size={18} color="#22C55E" />
          <Text
            style={{ color: "#22C55E", fontWeight: "600", marginLeft: 6 }}
          >
            You're subscribed!
          </Text>
        </View>
      ) : (
        <View style={styles.emailRow}>
          <TextInput
            style={[
              styles.emailInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="your@email.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.subscribeBtn, { backgroundColor: "#22C55E" }]}
            onPress={() => {
              if (email.includes("@")) setSubscribed(true);
            }}
          >
            <Text style={styles.subscribeBtnText}>Subscribe</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function ShopHomeScreen() {
  const colors = useColors();
  const { totalItems } = useCart();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["shop-home"],
    queryFn: fetchShopHome,
    staleTime: 60_000,
  });

  const handleSearch = useCallback(() => {
    if (search.trim()) {
      router.push(
        `/(tabs)/resources/shop/category/all?q=${encodeURIComponent(search.trim())}` as any,
      );
    }
  }, [search]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Could not load shop
        </Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: "#22C55E" }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { banners, categories, bestsellers, offers, newInStore, coachCurated, featured } =
    data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor="#22C55E"
        />
      }
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Search Bar */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search products…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {banners.length > 0 && <PromoCarousel banners={banners} />}

      <StatStrip />

      {categories.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Shop by Category" />
          <CategoryGrid categories={categories} />
        </View>
      )}

      {bestsellers.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Bestsellers"
            onSeeAll={() =>
              router.push(
                "/(tabs)/resources/shop/category/all?filter=bestseller" as any,
              )
            }
          />
          <FlatList
            horizontal
            data={bestsellers}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item }) => (
              <ProductCard
                product={mapProduct(item)}
                style={{ width: CARD_W }}
              />
            )}
          />
        </View>
      )}

      {offers.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Offer Zone 🔥" />
          <View style={styles.grid}>
            {offers.map((p: any) => (
              <ProductCard
                key={p.id}
                product={mapProduct(p)}
                style={{ width: "48%" }}
              />
            ))}
          </View>
        </View>
      )}

      {newInStore.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="New In Store"
            onSeeAll={() =>
              router.push(
                "/(tabs)/resources/shop/category/all?filter=new" as any,
              )
            }
          />
          <View style={styles.grid}>
            {newInStore.map((p: any) => (
              <ProductCard
                key={p.id}
                product={mapProduct(p)}
                style={{ width: "48%" }}
              />
            ))}
          </View>
        </View>
      )}

      {coachCurated.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Coach-Curated Picks" />
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {coachCurated.map((rec: any) => (
              <CoachCuratedCard key={rec.id} rec={rec} colors={colors} />
            ))}
          </View>
        </View>
      )}

      <Pressable
        style={styles.editorialBand}
        onPress={() =>
          router.push("/(tabs)/resources/shop/category/all" as any)
        }
      >
        <Text style={styles.editorialText}>Explore What's New →</Text>
        <Text style={styles.editorialSub}>
          Fresh products, coach-curated stacks
        </Text>
      </Pressable>

      {featured && <FeaturedBlock product={featured} colors={colors} />}

      <EmailCapture colors={colors} />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          © 2025 Vitalé · Free shipping on orders ₹999+
        </Text>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          All products are FSSAI approved
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 15 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: "#fff", fontWeight: "700" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  section: { paddingTop: 22 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  curatedCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  curatedCoach: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  coachAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  coachInitials: { fontSize: 15, fontWeight: "800" },
  coachName: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  clinicalNote: { fontSize: 12, lineHeight: 16, fontStyle: "italic" },
  curatedProduct: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
  },
  curatedImg: { width: 48, height: 48, borderRadius: 8 },
  curatedName: { fontSize: 13, fontWeight: "600" },
  curatedPrice: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  editorialBand: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#0F1923",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  editorialText: { fontSize: 18, fontWeight: "800", color: "#fff" },
  editorialSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  featuredBlock: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    height: 300,
    justifyContent: "flex-end",
  },
  featuredImg: { ...StyleSheet.absoluteFillObject },
  featuredContent: { padding: 20, gap: 8 },
  featuredTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
    letterSpacing: 1,
  },
  featuredName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 28,
  },
  featuredBenefits: { gap: 5 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  benefitText: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  featuredBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  featuredBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  emailCapture: {
    margin: 16,
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  emailTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  subscribedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emailRow: { flexDirection: "row", gap: 8 },
  emailInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  subscribeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  subscribeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  footer: {
    borderTopWidth: 1,
    margin: 16,
    paddingTop: 16,
    gap: 4,
    alignItems: "center",
  },
  footerText: { fontSize: 12 },
});
