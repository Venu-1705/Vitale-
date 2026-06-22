import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Image } from "expo-image";

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  bgColor: string;
  link?: string | null;
}

const { width: W } = Dimensions.get("window");
const ITEM_W = W - 32;

interface Props {
  banners: Banner[];
  onPress?: (banner: Banner) => void;
}

export function PromoCarousel({ banners, onPress }: Props) {
  const [active, setActive] = useState(0);
  const ref = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % banners.length;
        ref.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActive(viewableItems[0].index);
      }
    },
  ).current;

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        snapToInterval={ITEM_W + 12}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.slide, { backgroundColor: item.bgColor, width: ITEM_W }]}
            onPress={() => onPress?.(item)}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.overlay} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === active && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 16 },
  slide: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  text: { padding: 16 },
  title: { fontSize: 20, fontWeight: "800", color: "#fff", lineHeight: 26 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  dotActive: { width: 16, backgroundColor: "#22C55E" },
});
