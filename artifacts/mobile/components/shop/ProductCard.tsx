import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";

export interface ProductCardData {
  id: string;
  name: string;
  shortDescription: string;
  imageUrl: string;
  avgRating: number;
  reviewCount: number;
  isBestseller?: boolean;
  isNewInStore?: boolean;
  variants: {
    id: string;
    name: string;
    pricePaise: number;
    mrpPaise: number;
    stockQty: number;
    gstRate?: number;
  }[];
}

interface Props {
  product: ProductCardData;
  style?: object;
}

function discountPct(price: number, mrp: number) {
  return Math.round(((mrp - price) / mrp) * 100);
}

export function ProductCard({ product, style }: Props) {
  const colors = useColors();
  const { addItem, getItemByVariant } = useCart();
  const firstVariant = product.variants[0];
  const cartItem = firstVariant ? getItemByVariant(firstVariant.id) : undefined;
  const disc = firstVariant
    ? discountPct(firstVariant.pricePaise, firstVariant.mrpPaise)
    : 0;

  const handleAdd = () => {
    if (!firstVariant) return;
    addItem({
      productId: product.id,
      variantId: firstVariant.id,
      name: product.name,
      variantName: firstVariant.name,
      pricePaise: firstVariant.pricePaise,
      mrpPaise: firstVariant.mrpPaise,
      imageUrl: product.imageUrl,
      qty: 1,
      stockQty: firstVariant.stockQty,
      gstRate: firstVariant.gstRate ?? 18,
    });
  };

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={() => router.push(`/(tabs)/resources/shop/product/${product.id}` as any)}
    >
      <View style={styles.imageBox}>
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.image}
          contentFit="cover"
        />
        {product.isBestseller && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Bestseller</Text>
          </View>
        )}
        {product.isNewInStore && !product.isBestseller && (
          <View style={[styles.badge, { backgroundColor: "#2563EB" }]}>
            <Text style={styles.badgeText}>New</Text>
          </View>
        )}
        {disc >= 15 && (
          <View style={styles.discBadge}>
            <Text style={styles.discBadgeText}>{disc}% off</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
          {product.shortDescription}
        </Text>
        <View style={styles.ratingRow}>
          <Feather name="star" size={11} color="#F59E0B" />
          <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
            {(product.avgRating / 10).toFixed(1)} ({product.reviewCount})
          </Text>
        </View>
        <View style={styles.priceRow}>
          {firstVariant ? (
            <>
              <Text style={[styles.price, { color: colors.foreground }]}>
                ₹{Math.round(firstVariant.pricePaise / 100)}
              </Text>
              {firstVariant.mrpPaise > firstVariant.pricePaise && (
                <Text style={[styles.mrp, { color: colors.mutedForeground }]}>
                  ₹{Math.round(firstVariant.mrpPaise / 100)}
                </Text>
              )}
            </>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.addBtn,
            cartItem
              ? { backgroundColor: colors.primary }
              : { backgroundColor: "#F0FDF4", borderWidth: 1.5, borderColor: colors.primary },
          ]}
          onPress={handleAdd}
        >
          {cartItem ? (
            <Text style={[styles.addBtnText, { color: "#fff" }]}>
              In Cart ({cartItem.qty})
            </Text>
          ) : (
            <Text style={[styles.addBtnText, { color: colors.primary }]}>
              Add to Cart
            </Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  imageBox: { height: 148, position: "relative" },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  discBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  discBadgeText: { fontSize: 10, fontWeight: "700", color: "#15803D" },
  body: { padding: 10, gap: 4 },
  name: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  desc: { fontSize: 11, lineHeight: 15 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  price: { fontSize: 15, fontWeight: "800" },
  mrp: { fontSize: 11, textDecorationLine: "line-through" },
  addBtn: {
    marginTop: 4,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: { fontSize: 12, fontWeight: "700" },
});
