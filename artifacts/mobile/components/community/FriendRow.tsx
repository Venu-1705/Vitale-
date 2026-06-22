import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Friend } from "@/context/CommunityContext";

function LeagueColor(league: string): string {
  switch (league) {
    case "Diamond": return "#38BDF8";
    case "Gold": return "#F59E0B";
    case "Silver": return "#94A3B8";
    default: return "#CD7F32";
  }
}

function AvatarCircle({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 13 % 360;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},60%,70%)`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: `hsl(${hue},60%,25%)` }}>{initials}</Text>
    </View>
  );
}

type Props = {
  friend: Friend;
  rank: number;
  isCurrentUser?: boolean;
  adherence?: number;
  streak?: number;
  onRemove: (id: string) => void;
  onPress: () => void;
};

export function FriendRow({ friend, rank, isCurrentUser, adherence, onRemove, onPress }: Props) {
  const colors = useColors();

  function handleLongPress() {
    if (isCurrentUser) return;
    Alert.alert(
      "Friend Options",
      friend.name,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Friend",
          style: "destructive",
          onPress: () =>
            Alert.alert("Remove Friend", `Remove ${friend.name}?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => onRemove(friend.id) },
            ]),
        },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isCurrentUser ? colors.primary + "15" : colors.card, borderColor: isCurrentUser ? colors.primary : colors.border },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      {isCurrentUser && <View style={[styles.stripe, { backgroundColor: colors.primary }]} />}
      <Text style={[styles.rank, { color: isCurrentUser ? colors.primary : colors.mutedForeground }]}>#{rank}</Text>
      <AvatarCircle name={friend.name} size={38} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: isCurrentUser ? colors.primary : colors.foreground }]}>
          {isCurrentUser ? "You" : friend.name}
        </Text>
        <View style={[styles.leaguePill, { backgroundColor: LeagueColor(friend.league) + "22" }]}>
          <Text style={[styles.leagueText, { color: LeagueColor(friend.league) }]}>{friend.league}</Text>
        </View>
      </View>
      <Text style={[styles.adherence, { color: colors.foreground }]}>{adherence ?? friend.adherence}%</Text>
      <View style={styles.streak}>
        <Ionicons name="flame" size={14} color="#F59E0B" />
        <Text style={[styles.streakCount, { color: colors.foreground }]}>{friend.streak}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5,
    marginHorizontal: 16, marginVertical: 3, paddingVertical: 12, paddingHorizontal: 12,
    gap: 10, overflow: "hidden",
  },
  stripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  rank: { fontSize: 13, fontWeight: "700", width: 28, textAlign: "center" },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600" },
  leaguePill: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  leagueText: { fontSize: 10, fontWeight: "700" },
  adherence: { fontSize: 15, fontWeight: "700", minWidth: 42, textAlign: "right" },
  streak: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 36 },
  streakCount: { fontSize: 13, fontWeight: "600" },
});
