import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCommunity, type Comment, type Post } from "@/context/CommunityContext";
import { CommentItem } from "@/components/community/CommentItem";

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

function PostHeader({ post }: { post: Post }) {
  const colors = useColors();
  const { toggleLike, toggleBookmark, votePoll } = useCommunity();
  const isLiked = post.likes.includes("current_user");

  return (
    <View style={[styles.postHeaderContainer, { backgroundColor: colors.card }]}>
      <View style={styles.authorRow}>
        <AvatarCircle name={post.userName} size={44} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.postAuthor, { color: colors.foreground }]}>{post.userName}</Text>
            {post.isCoach && (
              <View style={[styles.coachBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.coachText}>Coach</Text>
              </View>
            )}
          </View>
          <Text style={[styles.postTime, { color: colors.mutedForeground }]}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {post.content.length > 0 && (
        <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
      )}

      {post.imageUrl && (
        <TouchableOpacity>
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
        </TouchableOpacity>
      )}

      {post.recipe && (
        <View style={[styles.recipeFullCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.recipeTitle, { color: colors.foreground }]}>{post.recipe.title}</Text>
          <View style={styles.nutritionRow}>
            {[
              { label: "Calories", value: post.recipe.nutrition.calories, unit: "", color: colors.primary },
              { label: "Protein", value: post.recipe.nutrition.protein, unit: "g", color: "#3B82F6" },
              { label: "Carbs", value: post.recipe.nutrition.carbs, unit: "g", color: "#F59E0B" },
              { label: "Fat", value: post.recipe.nutrition.fat, unit: "g", color: "#EF4444" },
            ].map((n) => (
              <View key={n.label} style={[styles.nutritionBadge, { backgroundColor: n.color + "18" }]}>
                <Text style={[styles.nutritionValue, { color: n.color }]}>{n.value}{n.unit}</Text>
                <Text style={[styles.nutritionLabel, { color: n.color + "bb" }]}>{n.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.ingredientsTitle, { color: colors.foreground }]}>Ingredients</Text>
          {post.recipe.ingredients.map((ing) => (
            <View key={ing.id} style={[styles.ingRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.ingName, { color: colors.foreground }]}>{ing.name}</Text>
              <Text style={[styles.ingQty, { color: colors.mutedForeground }]}>{ing.quantity} {ing.unit}</Text>
            </View>
          ))}
          <Text style={[styles.ingredientsTitle, { color: colors.foreground, marginTop: 10 }]}>Steps</Text>
          {post.recipe.steps.map((step, idx) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumText}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{step.text}</Text>
            </View>
          ))}
        </View>
      )}

      {post.poll && (
        <View style={styles.pollContainer}>
          <Text style={[styles.pollQuestion, { color: colors.foreground }]}>{post.poll.question}</Text>
          {post.poll.options.map((opt) => {
            const pct = post.poll!.totalVotes > 0 ? Math.round((opt.votes / post.poll!.totalVotes) * 100) : 0;
            const isSelected = post.poll!.userVoteId === opt.id;
            const hasVoted = !!post.poll!.userVoteId;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.pollOption, { borderColor: isSelected ? colors.primary : colors.border }]}
                onPress={() => { if (!hasVoted) { Haptics.selectionAsync(); votePoll(post.id, opt.id); } }}
                disabled={hasVoted}
              >
                {hasVoted && (
                  <View style={[styles.pollBar, { width: `${pct}%` as any, backgroundColor: isSelected ? colors.primary + "30" : colors.muted }]} />
                )}
                <Text style={[styles.pollOptionText, { color: isSelected ? colors.primary : colors.foreground }]}>{opt.text}</Text>
                {hasVoted && (
                  <Text style={[styles.pollPct, { color: isSelected ? colors.primary : colors.mutedForeground }]}>{pct}%</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.pollMeta, { color: colors.mutedForeground }]}>{post.poll.totalVotes} total votes</Text>
        </View>
      )}

      <View style={[styles.engagRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.engagBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleLike(post.id);
          }}
        >
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#EF4444" : colors.mutedForeground} />
          <Text style={[styles.engagCount, { color: colors.mutedForeground }]}>{post.likes.length} likes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.engagBtn}
          onPress={() => toggleBookmark(post.id)}
        >
          <Ionicons
            name={post.bookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color={post.bookmarked ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.engagCount, { color: colors.mutedForeground }]}>
            {post.bookmarked ? "Saved" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.commentsHeader, { borderTopColor: colors.border }]}>
        <Feather name="message-circle" size={16} color={colors.mutedForeground} />
        <Text style={[styles.commentsTitle, { color: colors.foreground }]}>Comments</Text>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, addComment, getPostComments, currentUserId } = useCommunity();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const inputRef = useRef<TextInput>(null);

  const post = posts.find((p) => p.id === id);

  useEffect(() => {
    if (id) {
      setComments(getPostComments(id));
    }
  }, [id, getPostComments]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      setComments(getPostComments(id));
    }, 10000);
    return () => clearInterval(interval);
  }, [id, getPostComments]);

  function handleReply(commentId: string, userName: string) {
    setReplyTo({ id: commentId, name: userName });
    setText(`@${userName} `);
    inputRef.current?.focus();
  }

  function handleDeleteComment(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !id) return;
    const newComment = await addComment(id, trimmed, replyTo?.id ?? null);
    setComments((prev) => [...prev, newComment]);
    setText("");
    setReplyTo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const topComments = comments.filter((c) => c.parentId === null);
  const getReplies = useCallback(
    (parentId: string) => comments.filter((c) => c.parentId === parentId),
    [comments]
  );

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Post not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Post</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={topComments}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CommentItem
            comment={item}
            replies={getReplies(item.id)}
            currentUserId={currentUserId}
            onReply={handleReply}
            onDelete={handleDeleteComment}
          />
        )}
        ListHeaderComponent={<PostHeader post={post} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.noComments}>
            <Text style={[styles.noCommentsText, { color: colors.mutedForeground }]}>
              No comments yet. Be the first to comment!
            </Text>
          </View>
        )}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {replyTo && (
          <View style={[styles.replyingTo, { backgroundColor: colors.muted }]}>
            <Text style={[styles.replyingText, { color: colors.mutedForeground }]}>
              Replying to <Text style={{ fontWeight: "700", color: colors.foreground }}>@{replyTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={() => { setReplyTo(null); setText(""); }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <View style={[styles.inputAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.inputAvatarText}>Y</Text>
          </View>
          <TextInput
            ref={inputRef}
            style={[styles.commentInput, { backgroundColor: colors.muted, color: colors.foreground }]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Feather name="send" size={16} color={text.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  backBtn: { width: 38, alignItems: "flex-start" },
  navTitle: { fontSize: 17, fontWeight: "700" },
  postHeaderContainer: { paddingBottom: 8 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  postAuthor: { fontSize: 15, fontWeight: "700" },
  coachBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coachText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  postTime: { fontSize: 12, marginTop: 2 },
  postContent: { fontSize: 15, lineHeight: 23, paddingHorizontal: 16, paddingBottom: 12 },
  postImage: { width: "100%", height: 240 },
  recipeFullCard: { margin: 16, borderRadius: 14, borderWidth: 1, padding: 14 },
  recipeTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  nutritionRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  nutritionBadge: { flex: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  nutritionValue: { fontSize: 14, fontWeight: "700" },
  nutritionLabel: { fontSize: 10, fontWeight: "500", marginTop: 2 },
  ingredientsTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  ingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  ingName: { fontSize: 13 },
  ingQty: { fontSize: 13 },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 2 },
  stepNumText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
  pollContainer: { paddingHorizontal: 16, paddingBottom: 10 },
  pollQuestion: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  pollOption: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    flexDirection: "row", alignItems: "center", overflow: "hidden", position: "relative",
  },
  pollBar: { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollOptionText: { flex: 1, fontSize: 14, fontWeight: "500", zIndex: 1 },
  pollPct: { fontSize: 14, fontWeight: "700", zIndex: 1 },
  pollMeta: { fontSize: 12, marginTop: 4 },
  engagRow: { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 24 },
  engagBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  engagCount: { fontSize: 14 },
  commentsHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  commentsTitle: { fontSize: 16, fontWeight: "700" },
  noComments: { padding: 24, alignItems: "center" },
  noCommentsText: { fontSize: 14 },
  inputBar: { borderTopWidth: 1 },
  replyingTo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  replyingText: { fontSize: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 10 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  inputAvatarText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  commentInput: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 80,
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16 },
});
