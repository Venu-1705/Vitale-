import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMessaging, REAL_COACH_ID, type Message } from "@/context/MessagingContext";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.floor((today.getTime() - ts) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

function MessageBubble({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
  const colors = useColors();
  const isUser = msg.sentBy === "user";

  const prevDate = prevMsg ? new Date(prevMsg.timestamp).toDateString() : null;
  const thisDate = new Date(msg.timestamp).toDateString();
  const showDateSep = !prevMsg || prevDate !== thisDate;

  return (
    <>
      {showDateSep && (
        <View style={styles.dateSep}>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dateLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
            {formatDate(msg.timestamp)}
          </Text>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        </View>
      )}
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: "#22C55E" }]
              : [styles.coachBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
            {msg.text}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, { color: isUser ? "#ffffff99" : colors.mutedForeground }]}>
              {formatTime(msg.timestamp)}
            </Text>
            {isUser && (
              <Feather name="check-circle" size={11} color={msg.read ? "#ffffff99" : "#ffffff66"} />
            )}
          </View>
        </View>
      </View>
    </>
  );
}

export default function ChatScreen() {
  // The route param is ignored — there is only ever ONE real coach thread now.
  useLocalSearchParams<{ coachId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getChat, sendMessage, markChatRead } = useMessaging();
  const [draft, setDraft] = useState("");
  const flatRef = useRef<FlatList>(null);

  const chat = getChat(REAL_COACH_ID);

  useEffect(() => {
    markChatRead(REAL_COACH_ID);
  }, [markChatRead]);

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }, [chat?.messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    sendMessage(REAL_COACH_ID, text);
    setDraft("");
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }

  if (!chat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Chat not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 12 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const messages = chat.messages;

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
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: chat.coachColor + "28" }]}>
            <Text style={[styles.headerAvatarText, { color: chat.coachColor }]}>{chat.coachInitials}</Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{chat.coachName}</Text>
            <View style={styles.headerProgramRow}>
              <View style={[styles.activeDot, { backgroundColor: chat.isActive ? "#22C55E" : colors.border }]} />
              <Text style={[styles.headerProgram, { color: colors.mutedForeground }]}>
                {chat.isActive ? chat.programName : "Archived · " + chat.programName}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <MessageBubble msg={item} prevMsg={messages[index - 1]} />
        )}
        contentContainerStyle={[styles.messageList, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {!chat.isActive ? (
        <View style={[styles.archivedBar, { backgroundColor: colors.muted, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Feather name="archive" size={14} color={colors.mutedForeground} />
          <Text style={[styles.archivedText, { color: colors.mutedForeground }]}>
            Your program with {chat.coachName} has ended. Messages are archived.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View
            style={[styles.inputBar, {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 8,
            }]}
          >
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Message your coach..."
              placeholderTextColor={colors.mutedForeground}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? "#22C55E" : colors.border }]}
              onPress={handleSend}
              disabled={!draft.trim()}
            >
              <Feather name="send" size={18} color={draft.trim() ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 38 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { fontSize: 13, fontWeight: "800" },
  headerName: { fontSize: 15, fontWeight: "700" },
  headerProgramRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  headerProgram: { fontSize: 12 },
  messageList: { paddingHorizontal: 14, paddingTop: 14, gap: 2 },
  dateSep: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontWeight: "600", paddingHorizontal: 4 },
  bubbleRow: { marginVertical: 3 },
  bubbleLeft: { alignItems: "flex-start" },
  bubbleRight: { alignItems: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, gap: 4 },
  userBubble: { borderBottomRightRadius: 4 },
  coachBubble: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "flex-end" },
  bubbleTime: { fontSize: 10 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  archivedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  archivedText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
