import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
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
import {
  useGrantCoachAccess,
  useMyGrants,
  useRevokeGrant,
  CONSENT_TEXT,
  type GrantDataCategory,
} from "@/lib/access";

const CATEGORIES: { key: GrantDataCategory; label: string; essential?: boolean }[] = [
  { key: "health_data", label: "Health data", essential: true },
  { key: "meals", label: "Meals", essential: true },
  { key: "programs", label: "Programs", essential: true },
  { key: "lab_results", label: "Lab results" },
  { key: "messages", label: "Messages" },
];

export default function GrantAccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ organizationId?: string; firstTime?: string }>();
  const isFirstTime = params.firstTime === "true";

  const [orgId, setOrgId] = useState(params.organizationId ?? "");
  const [selected, setSelected] = useState<GrantDataCategory[]>(["health_data", "meals", "programs"]);

  const grant = useGrantCoachAccess();
  const myGrants = useMyGrants();
  const revoke = useRevokeGrant();

  function toggle(cat: GrantDataCategory) {
    setSelected((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  function submit() {
    const id = orgId.trim();
    if (!id) {
      Alert.alert("Organization ID required", "Paste the organization ID your coach shared.");
      return;
    }
    if (selected.length === 0) {
      Alert.alert("Select data", "Choose at least one data category to share.");
      return;
    }
    grant.mutate(
      { organizationId: id, dataCategoriesGranted: selected },
      {
        onSuccess: () => {
          if (isFirstTime) {
            router.replace("/(tabs)" as any);
          } else {
            Alert.alert("Access granted", "Your coach can now see the data you shared. You can revoke this anytime.");
          }
        },
        onError: (e: unknown) =>
          Alert.alert("Couldn't grant access", e instanceof Error ? e.message : "Please check the organization ID and try again."),
      },
    );
  }

  function confirmRevoke(id: string) {
    Alert.alert("Revoke access?", "Your coach will immediately lose access to the shared data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () => revoke.mutate(id, { onError: () => Alert.alert("Couldn't revoke", "Please try again.") }),
      },
    ]);
  }

  const activeGrants = (myGrants.data ?? []).filter((g) => g.status === "active");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 16 : insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Share with your coach</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        {isFirstTime && (
          <View style={[styles.banner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}>
            <Feather name="user-check" size={18} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.foreground }]}>
              Welcome! Enter your coach's organization ID to get started.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>ORGANIZATION ID</Text>
          <TextInput
            value={orgId}
            onChangeText={setOrgId}
            placeholder="Paste the ID your coach shared"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>WHAT TO SHARE</Text>
          {CATEGORIES.map((c) => {
            const on = selected.includes(c.key);
            return (
              <TouchableOpacity key={c.key} onPress={() => toggle(c.key)} style={styles.row} activeOpacity={0.7}>
                <View style={[styles.checkbox, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : "transparent" }]}>
                  {on && <Feather name="check" size={13} color="#fff" />}
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{c.label}</Text>
                {c.essential && <Text style={[styles.essential, { color: colors.mutedForeground }]}>recommended</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.consent, { color: colors.mutedForeground }]}>{CONSENT_TEXT}</Text>

        <TouchableOpacity
          onPress={submit}
          disabled={grant.isPending}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: grant.isPending ? 0.7 : 1 }]}
          activeOpacity={0.85}
        >
          {grant.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Grant Access</Text>}
        </TouchableOpacity>

        {isFirstTime && (
          <TouchableOpacity onPress={() => router.replace("/(tabs)" as any)} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
          </TouchableOpacity>
        )}

        {/* Existing grants */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>ACTIVE GRANTS</Text>
          {myGrants.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : activeGrants.length === 0 ? (
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>You haven't shared data with any coach yet.</Text>
          ) : (
            activeGrants.map((g) => (
              <View key={g.id} style={[styles.grantRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.grantOrg, { color: colors.foreground }]} numberOfLines={1}>Org {g.organizationId.slice(0, 8)}</Text>
                  <Text style={[styles.muted, { color: colors.mutedForeground }]}>{g.dataCategoriesGranted.join(", ")}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmRevoke(g.id)}>
                  <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "500", flex: 1 },
  essential: { fontSize: 11 },
  consent: { fontSize: 12, lineHeight: 18 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  muted: { fontSize: 13 },
  grantRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  grantOrg: { fontSize: 14, fontWeight: "600" },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  skipBtn: { alignItems: "center", paddingVertical: 6 },
  skipText: { fontSize: 14, fontWeight: "600" },
});
