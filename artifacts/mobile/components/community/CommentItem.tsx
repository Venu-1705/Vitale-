import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Comment } from "@/context/CommunityContext";

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function AvatarCircle({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 13 % 360;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},60%,70%)`, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: `hsl(${hue},60%,25%)` }}>{initials}</Text>
    </View>
  );
}

type Props = {
  comment: Comment;
  replies: Comment[];
  currentUserId: string;
  onReply: (commentId: string, userName: string) => void;
  onDelete: (commentId: string) => void;
};

export function CommentItem({ comment, replies, currentUserId, onReply, onDelete }: Props) {
  const colors = useColors();
  const [showAll, setShowAll] = useState(false);
  const isOwn = comment.userId === currentUserId;

  const visibleReplies = showAll ? replies : replies.slice(0, 3);
  const hiddenCount = replies.length - 3;

  function handleLongPress() {
    const options: string[] = ["Cancel", "Report", "Copy Text"];
    if (isOwn) options.push("Delete");

    Alert.alert("Comment Options", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: () => {} },
      { text: "Copy Text", onPress: () => {} },
      ...(isOwn ? [{ text: "Delete", style: "destructive" as const, onPress: () => onDelete(comment.id) }] : []),
    ]);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.commentRow} onLongPress={handleLongPress} activeOpacity={0.8}>
        <AvatarCircle name={comment.userName} size={32} />
        <View style={[styles.bubble, { backgroundColor: "#F3F4F6" }]}>
          <View style={styles.bubbleHeader}>
            <Text style={[styles.name, { color: colors.foreground }]}>{comment.userName}</Text>
            {comment.isCoach && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>Coach</Text>
              </View>
            )}
            <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(comment.createdAt)}</Text>
          </View>
          <Text style={[styles.text, { color: colors.foreground }]}>{comment.text}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.replyBtn}
        onPress={() => onReply(comment.id, comment.userName)}
      >
        <Text style={[styles.replyText, { color: colors.mutedForeground }]}>Reply</Text>
      </TouchableOpacity>

      {replies.length > 0 && (
        <View style={styles.repliesContainer}>
          <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
          <View style={styles.repliesInner}>
            {visibleReplies.map((reply) => (
              <TouchableOpacity key={reply.id} style={styles.replyRow} onLongPress={handleLongPress} activeOpacity={0.8}>
                <AvatarCircle name={reply.userName} size={26} />
                <View style={[styles.bubble, { backgroundColor: "#F3F4F6" }]}>
                  <View style={styles.bubbleHeader}>
                    <Text style={[styles.name, { color: colors.foreground, fontSize: 12 }]}>{reply.userName}</Text>
                    {reply.isCoach && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>Coach</Text>
                      </View>
                    )}
                    <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(reply.createdAt)}</Text>
                  </View>
                  <Text style={[styles.text, { color: colors.foreground, fontSize: 13 }]}>{reply.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {!showAll && hiddenCount > 0 && (
              <TouchableOpacity onPress={() => setShowAll(true)}>
                <Text style={[styles.viewMore, { color: colors.primary }]}>View {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  commentRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 6 },
  replyRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  bubble: { flex: 1, borderRadius: 12, padding: 10 },
  bubbleHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  name: { fontSize: 13, fontWeight: "600" },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  time: { fontSize: 11, marginLeft: "auto" },
  text: { fontSize: 14, lineHeight: 20 },
  replyBtn: { paddingLeft: 56, paddingVertical: 2 },
  replyText: { fontSize: 12, fontWeight: "500" },
  repliesContainer: { flexDirection: "row", paddingLeft: 56 },
  replyLine: { width: 2, borderRadius: 2, marginRight: 10, marginLeft: 16 },
  repliesInner: { flex: 1, paddingRight: 16 },
  viewMore: { fontSize: 12, fontWeight: "600", paddingVertical: 4 },
});
