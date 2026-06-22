import { router, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { QuantityStepper } from "@/components/shop/QuantityStepper";
import { useCart } from "@/context/CartContext";
import { apiGet } from "@/lib/api";

const { width: W } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem, getItemByVariant } = useCart();

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>("description");

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => apiGet<any>(`/shop/products/${id}`),
    staleTime: 60_000,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
          Product not found
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const variant = product.variants?.[selectedVariantIdx] ?? product.variants?.[0];
  const cartItem = variant ? getItemByVariant(variant.id) : undefined;
  const images: string[] = product.images?.length ? product.images : ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"];
  const discPct = variant
    ? Math.round(((variant.mrpPaise - variant.pricePaise) / variant.mrpPaise) * 100)
    : 0;

  const handleAddToCart = () => {
    if (!variant) return;
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      imageUrl: images[0],
      qty,
      stockQty: variant.stockQty,
      gstRate: product.gstRate ?? 18,
      organizationId: product.organizationId,
    });
  };

  const ACCORDION_SECTIONS = [
    {
      key: "description",
      title: "Description",
      content: product.description,
    },
    {
      key: "benefits",
      title: "Benefits",
      content: (product.benefits ?? []).join("\n"),
    },
    {
      key: "shipping",
      title: "Shipping & Returns",
      content: "Free shipping on orders ₹999+. Estimated 3-5 business days. Easy 7-day returns for sealed products.",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back button overlay */}
      <View
        style={[
          styles.topBar,
          { paddingTop: Platform.OS === "web" ? 16 : insets.top },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/resources/shop/cart" as any)}
          style={styles.cartOverlayBtn}
        >
          <Feather name="shopping-cart" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W);
            setActiveImage(idx);
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={{ width: W, height: 300 }} contentFit="cover" />
          )}
        />
        {images.length > 1 && (
          <View style={styles.imageDots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeImage && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}

        <View style={{ padding: 16, gap: 12 }}>
          {/* Brand + Name */}
          {product.brand && (
            <Text style={[styles.brand, { color: colors.mutedForeground }]}>
              {product.brand}
            </Text>
          )}
          <Text style={[styles.name, { color: colors.foreground }]}>
            {product.name}
          </Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons
                key={i}
                name={
                  i <= Math.round((product.avgRating ?? 0) / 10)
                    ? "star"
                    : "star-outline"
                }
                size={14}
                color="#F59E0B"
              />
            ))}
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {((product.avgRating ?? 0) / 10).toFixed(1)} ({product.reviewCount} reviews)
            </Text>
          </View>

          {/* Price */}
          {variant && (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.foreground }]}>
                ₹{Math.round(variant.pricePaise / 100)}
              </Text>
              {variant.mrpPaise > variant.pricePaise && (
                <>
                  <Text style={[styles.mrp, { color: colors.mutedForeground }]}>
                    ₹{Math.round(variant.mrpPaise / 100)}
                  </Text>
                  <View style={styles.discPill}>
                    <Text style={styles.discText}>{discPct}% off</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Variant chips */}
          {product.variants?.length > 1 && (
            <View>
              <Text style={[styles.variantLabel, { color: colors.mutedForeground }]}>
                Select Size
              </Text>
              <View style={styles.variantRow}>
                {product.variants.map((v: any, i: number) => (
                  <Pressable
                    key={v.id}
                    style={[
                      styles.variantChip,
                      i === selectedVariantIdx
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          }
                        : {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                    ]}
                    onPress={() => {
                      setSelectedVariantIdx(i);
                      setQty(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.variantChipText,
                        {
                          color:
                            i === selectedVariantIdx ? "#fff" : colors.foreground,
                        },
                      ]}
                    >
                      {v.name}
                    </Text>
                    {v.stockQty === 0 && (
                      <Text style={{ fontSize: 9, color: i === selectedVariantIdx ? "rgba(255,255,255,0.7)" : colors.mutedForeground }}>
                        {" "}· OOS
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Qty stepper */}
          <View style={styles.qtyRow}>
            <Text style={[styles.variantLabel, { color: colors.mutedForeground }]}>
              Quantity
            </Text>
            <QuantityStepper
              qty={qty}
              min={1}
              max={variant?.stockQty ?? 10}
              onInc={() => setQty((q) => q + 1)}
              onDec={() => setQty((q) => Math.max(1, q - 1))}
            />
          </View>

          {/* GST note */}
          <Text style={[styles.gstNote, { color: colors.mutedForeground }]}>
            Inclusive of all taxes (GST {product.gstRate ?? 18}%)
          </Text>

          {/* Accordion sections */}
          <View style={[styles.accordionWrap, { borderColor: colors.border }]}>
            {ACCORDION_SECTIONS.map((sec, i) => (
              <View key={sec.key}>
                {i > 0 && (
                  <View style={[styles.accordionDivider, { backgroundColor: colors.border }]} />
                )}
                <Pressable
                  style={styles.accordionHeader}
                  onPress={() =>
                    setExpandedSection((s) => (s === sec.key ? null : sec.key))
                  }
                >
                  <Text style={[styles.accordionTitle, { color: colors.foreground }]}>
                    {sec.title}
                  </Text>
                  <Feather
                    name={expandedSection === sec.key ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {expandedSection === sec.key && sec.content && (
                  <Text style={[styles.accordionBody, { color: colors.mutedForeground }]}>
                    {sec.content}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Reviews */}
          {(product.reviews ?? []).length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={[styles.reviewsTitle, { color: colors.foreground }]}>
                Customer Reviews
              </Text>
              {product.reviews.map((rev: any) => (
                <View
                  key={rev.id}
                  style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={i <= rev.rating ? "star" : "star-outline"}
                          size={12}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                    {rev.isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Feather name="check" size={10} color="#16A34A" />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                  {rev.title && (
                    <Text style={[styles.reviewTitle, { color: colors.foreground }]}>
                      {rev.title}
                    </Text>
                  )}
                  {rev.body && (
                    <Text style={[styles.reviewBody, { color: colors.mutedForeground }]}>
                      {rev.body}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[
            styles.addToCartBtn,
            { borderColor: colors.primary, borderWidth: 1.5 },
            variant?.stockQty === 0 && { opacity: 0.5 },
          ]}
          disabled={!variant || variant.stockQty === 0}
          onPress={handleAddToCart}
        >
          <Feather name="shopping-cart" size={16} color={colors.primary} />
          <Text style={[styles.addToCartText, { color: colors.primary }]}>
            {cartItem ? `In Cart (${cartItem.qty})` : "Add to Cart"}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.buyNowBtn,
            { backgroundColor: colors.primary },
            variant?.stockQty === 0 && { opacity: 0.5, backgroundColor: colors.mutedForeground },
          ]}
          disabled={!variant || variant.stockQty === 0}
          onPress={() => {
            handleAddToCart();
            router.push("/(tabs)/resources/shop/cart" as any);
          }}
        >
          <Text style={styles.buyNowText}>
            {variant?.stockQty === 0 ? "Out of Stock" : "Buy Now"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartOverlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  dotActive: { width: 16, backgroundColor: "#22C55E" },
  brand: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13, marginLeft: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 26, fontWeight: "800" },
  mrp: { fontSize: 15, textDecorationLine: "line-through" },
  discPill: { backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  discText: { fontSize: 12, fontWeight: "700", color: "#15803D" },
  variantLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  variantRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  variantChipText: { fontSize: 13, fontWeight: "700" },
  qtyRow: { gap: 8 },
  gstNote: { fontSize: 11 },
  accordionWrap: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  accordionTitle: { fontSize: 14, fontWeight: "700" },
  accordionDivider: { height: 1 },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 13, lineHeight: 20 },
  reviewsSection: { gap: 10 },
  reviewsTitle: { fontSize: 17, fontWeight: "800" },
  reviewCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  starsRow: { flexDirection: "row", gap: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#DCFCE7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  verifiedText: { fontSize: 10, fontWeight: "700", color: "#16A34A" },
  reviewTitle: { fontSize: 13, fontWeight: "700" },
  reviewBody: { fontSize: 13, lineHeight: 18 },
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addToCartText: { fontSize: 14, fontWeight: "700" },
  buyNowBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  buyNowText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
