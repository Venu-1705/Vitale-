import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

interface Props {
  categories: Category[];
}

export function CategoryGrid({ categories }: Props) {
  const colors = useColors();

  return (
    <View style={styles.grid}>
      {categories.map((cat) => (
        <Pressable
          key={cat.id}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() =>
            router.push(
              `/(tabs)/resources/shop/category/${cat.slug}` as any,
            )
          }
        >
          <Image
            source={{ uri: cat.imageUrl ?? "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200" }}
            style={styles.image}
            contentFit="cover"
          />
          <View style={styles.overlay} />
          <Text style={styles.name} numberOfLines={2}>
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: "47.5%",
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    padding: 10,
    lineHeight: 17,
  },
});
