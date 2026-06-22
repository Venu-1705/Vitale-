import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import ShopHomeScreen from "@/components/shop/ShopHomeScreen";
import LabScreen from "@/components/lab/LabScreen";

type SubTab = "shop" | "lab";
const STORAGE_KEY = "resources_active_tab";

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SubTab>("shop");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "shop" || val === "lab") setActiveTab(val);
      setHydrated(true);
    });
  }, []);

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab);
    AsyncStorage.setItem(STORAGE_KEY, tab);
  };

  if (!hydrated) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky header */}
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
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Resources
          </Text>
          {activeTab === "shop" && (
            <Pressable
              onPress={() => router.push("/(tabs)/resources/shop/cart" as any)}
              style={styles.cartBtn}
            >
              <Feather name="shopping-cart" size={22} color={colors.foreground} />
            </Pressable>
          )}
        </View>

        {/* Segmented control */}
        <View
          style={[
            styles.segmented,
            { backgroundColor: colors.muted },
          ]}
        >
          {(["shop", "lab"] as SubTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === "shop" ? "Shop" : "Lab Tests & Reports";
            return (
              <Pressable
                key={tab}
                style={[
                  styles.segment,
                  isActive && {
                    backgroundColor: colors.card,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
                onPress={() => handleTabChange(tab)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? colors.foreground : colors.mutedForeground,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "shop" ? <ShopHomeScreen /> : <LabScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingTop: 6,
  },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  cartBtn: { padding: 4 },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    marginBottom: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentText: { fontSize: 13 },
  content: { flex: 1 },
});
