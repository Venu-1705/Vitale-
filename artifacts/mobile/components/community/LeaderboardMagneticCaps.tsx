import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { LeaderboardEntry } from "@/context/CommunityContext";

function LeagueColor(league: string): string {
  switch (league) {
    case "Diamond": return "#38BDF8";
    case "Gold": return "#F59E0B";
    case "Silver": return "#94A3B8";
    default: return "#CD7F32";
  }
}

function AvatarCircle({ name, size = 38, isCurrentUser }: { name: string; size?: number; isCurrentUser?: boolean }) {
  const colors = useColors();
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 13 % 360;
  const bg = isCurrentUser ? colors.primary : `hsl(${hue},55%,68%)`;
  const textColor = isCurrentUser ? "#fff" : `hsl(${hue},55%,20%)`;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: textColor }}>{initials}</Text>
    </View>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Ionicons name="medal" size={18} color="#F59E0B" />;
  if (rank === 2) return <Ionicons name="medal" size={18} color="#94A3B8" />;
  if (rank === 3) return <Ionicons name="medal" size={18} color="#CD7F32" />;
  return <Text style={styles.rankNum}>#{rank}</Text>;
}

type RowProps = {
  entry: LeaderboardEntry;
  isAbove?: boolean;
  isBelow?: boolean;
  pointsGap?: number;
};

export function MagneticCapsRow({ entry, isAbove, isBelow, pointsGap }: RowProps) {
  const colors = useColors();
  const isMe = entry.isCurrentUser;

  return (
    <View>
      {isAbove && pointsGap !== undefined && (
        <View style={styles.gapIndicator}>
          <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
          <Text style={[styles.gapText, { color: colors.mutedForeground }]}>{pointsGap} pts to overtake</Text>
        </View>
      )}

      <View style={[
        styles.row,
        { backgroundColor: isMe ? colors.primary + "15" : colors.card, borderColor: isMe ? colors.primary : colors.border },
        isMe && styles.meRow,
      ]}>
        {isMe && <View style={[styles.meStripe, { backgroundColor: colors.primary }]} />}
        <View style={styles.rankCol}>
          <RankBadge rank={entry.rank} />
        </View>
        <AvatarCircle name={entry.isAnonymous ? "?" : entry.name} size={36} isCurrentUser={isMe} />
        <View style={styles.nameCol}>
          <Text style={[styles.name, { color: colors.foreground }, isMe && { color: colors.primary, fontWeight: "700" }]}>
            {entry.name}
          </Text>
          <View style={[styles.leaguePill, { backgroundColor: LeagueColor(entry.league) + "22" }]}>
            <Text style={[styles.leagueText, { color: LeagueColor(entry.league) }]}>{entry.league}</Text>
          </View>
        </View>
        <Text style={[styles.adherence, { color: colors.foreground }]}>{entry.adherence}%</Text>
        <View style={styles.streakCol}>
          <Ionicons name="flame" size={14} color="#F59E0B" />
          <Text style={[styles.streakCount, { color: colors.foreground }]}>{entry.streak}</Text>
        </View>
      </View>

      {isBelow && pointsGap !== undefined && (
        <View style={styles.gapIndicator}>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          <Text style={[styles.gapText, { color: colors.mutedForeground }]}>{pointsGap} pts ahead of you</Text>
        </View>
      )}
    </View>
  );
}

export function FullLeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const colors = useColors();
  const isMe = entry.isCurrentUser;
  return (
    <View style={[
      styles.fullRow,
      { backgroundColor: isMe ? colors.primary + "12" : "transparent", borderColor: isMe ? colors.primary + "44" : "transparent", borderWidth: isMe ? 1 : 0, borderRadius: 10 },
    ]}>
      <View style={styles.rankCol}>
        <RankBadge rank={entry.rank} />
      </View>
      <AvatarCircle name={entry.isAnonymous ? "?" : entry.name} size={30} isCurrentUser={isMe} />
      <Text style={[styles.name, { color: isMe ? colors.primary : colors.foreground, flex: 1 }]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.adherence, { color: colors.foreground, fontSize: 13 }]}>{entry.adherence}%</Text>
      <View style={styles.streakCol}>
        <Ionicons name="flame" size={12} color="#F59E0B" />
        <Text style={[styles.streakCount, { color: colors.mutedForeground, fontSize: 12 }]}>{entry.streak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", borderRadius: 14,
    borderWidth: 1.5, marginHorizontal: 16, marginVertical: 4,
    paddingVertical: 12, paddingHorizontal: 12, gap: 10, overflow: "hidden",
  },
  meRow: {},
  meStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  rankCol: { width: 28, alignItems: "center" },
  rankNum: { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  nameCol: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600" },
  leaguePill: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  leagueText: { fontSize: 10, fontWeight: "700" },
  adherence: { fontSize: 15, fontWeight: "700", minWidth: 42, textAlign: "right" },
  streakCol: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 36 },
  streakCount: { fontSize: 13, fontWeight: "600" },
  gapIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  gapText: { fontSize: 12, fontWeight: "500" },
  fullRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
});
