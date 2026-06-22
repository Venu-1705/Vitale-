import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCommunity } from "@/context/CommunityContext";

const MOCK_SEARCH_RESULTS = [
  { id: "s1", name: "Jordan Lee", mutual: 2 },
  { id: "s2", name: "Priya Sharma", mutual: 1 },
  { id: "s3", name: "Marcus Thompson", mutual: 3 },
  { id: "s4", name: "Aisha Patel", mutual: 0 },
  { id: "s5", name: "Daniel Kim", mutual: 1 },
];

function AvatarCircle({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 13 % 360;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},60%,70%)`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: `hsl(${hue},60%,25%)` }}>{initials}</Text>
    </View>
  );
}

export default function SearchFriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addFriend, friends } = useCommunity();
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());

  const friendNames = new Set(friends.map((f) => f.name));

  const results = query.trim()
    ? MOCK_SEARCH_RESULTS.filter((r) =>
        r.name.toLowerCase().includes(query.toLowerCase()) && !friendNames.has(r.name)
      )
    : [];

  function handleSendRequest(person: (typeof MOCK_SEARCH_RESULTS)[0]) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent((prev) => new Set([...prev, person.id]));
    addFriend(person.name);
    Alert.alert("Friend Request Sent", `You are now friends with ${person.name}!`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Find Friends</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by name..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.inviteCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "44" }]}
          onPress={() => Alert.alert("Share Invite Link", "Your invite link has been copied to clipboard!\n\nvitalé.app/invite/you123")}
        >
          <View style={[styles.inviteIcon, { backgroundColor: colors.primary }]}>
            <Feather name="share-2" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inviteTitle, { color: colors.foreground }]}>Share Invite Link</Text>
            <Text style={[styles.inviteSubtitle, { color: colors.mutedForeground }]}>
              Invite friends to join and compete together
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </TouchableOpacity>

        {query.trim().length > 0 && (
          <>
            <Text style={[styles.resultsLabel, { color: colors.mutedForeground }]}>
              {results.length} result{results.length !== 1 ? "s" : ""}
            </Text>
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => {
                const isSent = sent.has(item.id);
                const isFriend = friendNames.has(item.name);
                return (
                  <View style={[styles.personRow, { borderBottomColor: colors.border }]}>
                    <AvatarCircle name={item.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: colors.foreground }]}>{item.name}</Text>
                      {item.mutual > 0 && (
                        <Text style={[styles.mutual, { color: colors.mutedForeground }]}>
                          {item.mutual} mutual friend{item.mutual !== 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.addBtn,
                        {
                          backgroundColor:
                            isSent || isFriend ? colors.muted : colors.primary,
                          borderColor: isSent || isFriend ? colors.border : colors.primary,
                        },
                      ]}
                      onPress={() => !isSent && !isFriend && handleSendRequest(item)}
                      disabled={isSent || isFriend}
                    >
                      <Text
                        style={[
                          styles.addBtnText,
                          { color: isSent || isFriend ? colors.mutedForeground : "#fff" },
                        ]}
                      >
                        {isFriend ? "Friends" : isSent ? "Sent" : "Add"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.noResults}>
                  <Feather name="user-x" size={40} color={colors.border} />
                  <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                    No results for "{query}"
                  </Text>
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}

        {query.trim().length === 0 && (
          <View style={styles.placeholder}>
            <Feather name="users" size={48} color={colors.border} />
            <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>Find Your Friends</Text>
            <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
              Search by name to find friends and compete on the leaderboard together.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  closeBtn: { width: 38, alignItems: "flex-start" },
  title: { fontSize: 17, fontWeight: "700" },
  content: { flex: 1, padding: 16 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15 },
  inviteCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 20,
  },
  inviteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  inviteTitle: { fontSize: 15, fontWeight: "600" },
  inviteSubtitle: { fontSize: 12, marginTop: 2 },
  resultsLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, letterSpacing: 0.5 },
  personRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  personName: { fontSize: 15, fontWeight: "600" },
  mutual: { fontSize: 12, marginTop: 2 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontWeight: "700" },
  noResults: { alignItems: "center", paddingTop: 40, gap: 8 },
  noResultsText: { fontSize: 14 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  placeholderTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  placeholderText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
