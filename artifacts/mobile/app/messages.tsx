import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMessaging, type Chat } from "@/context/MessagingContext";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ChatRow({ chat }: { chat: Chat }) {
  const colors = useColors();
  const lastMsg = chat.messages[chat.messages.length - 1];
  const unreadCount = chat.messages.filter((m) => m.sentBy === "coach" && !m.read).length;

  return (
    <TouchableOpacity
      style={[styles.chatRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/chat/${chat.coachId}` as any)}
      activeOpacity={0.75}
    >
      <View style={[styles.avatar, { backgroundColor: chat.coachColor + "28" }]}>
        <Text style={[styles.avatarText, { color: chat.coachColor }]}>{chat.coachInitials}</Text>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTop}>
          <Text style={[styles.coachName, { color: colors.foreground }]}>{chat.coachName}</Text>
          <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
            {lastMsg ? timeAgo(lastMsg.timestamp) : ""}
          </Text>
        </View>
        <Text style={[styles.programName, { color: colors.primary }]} numberOfLines={1}>
          {chat.programName} {!chat.isActive ? "(Archived)" : ""}
        </Text>
        {lastMsg && (
          <Text style={[styles.lastMsg, { color: colors.mutedForeground }]} numberOfLines={1}>
            {lastMsg.sentBy === "user" ? "You: " : ""}{lastMsg.text}
          </Text>
        )}
      </View>
      {unreadCount > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chats, loaded } = useMessaging();

  const activeChats = chats.filter((c) => c.isActive);
  const archivedChats = chats.filter((c) => !c.isActive);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Messages</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {!loaded ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Once your coach starts a conversation, it will appear here.
            </Text>
          </View>
        ) : (
          <>
            {activeChats.length > 0 && (
              <View>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Active Programs</Text>
                <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {activeChats.map((c) => <ChatRow key={c.coachId} chat={c} />)}
                </View>
              </View>
            )}
            {archivedChats.length > 0 && (
              <View>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Archived</Text>
                <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {archivedChats.map((c) => <ChatRow key={c.coachId} chat={c} />)}
                </View>
              </View>
            )}
            <View style={[styles.dpdpNote, { borderColor: colors.border }]}>
              <Feather name="shield" size={13} color={colors.mutedForeground} />
              <Text style={[styles.dpdpText, { color: colors.mutedForeground }]}>
                Messages are shared with your coach only during active programs. Archived chats are read-only.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 38 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  groupLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginLeft: 16, marginTop: 20, marginBottom: 6 },
  groupCard: { borderTopWidth: 1, borderBottomWidth: 1 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800" },
  chatInfo: { flex: 1, gap: 3 },
  chatTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coachName: { fontSize: 15, fontWeight: "700" },
  chatTime: { fontSize: 12 },
  programName: { fontSize: 12, fontWeight: "600" },
  lastMsg: { fontSize: 13 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  dpdpNote: { flexDirection: "row", gap: 8, margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  dpdpText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
