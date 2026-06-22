import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useCommunity, type Post } from "@/context/CommunityContext";

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AvatarCircle({ name, size = 40 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 13 % 360;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},60%,70%)` }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35, color: `hsl(${hue},60%,25%)` }]}>{initials}</Text>
    </View>
  );
}

function NutritionBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.nutriBadge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.nutriValue, { color }]}>{value}g</Text>
      <Text style={[styles.nutriLabel, { color: color + "cc" }]}>{label}</Text>
    </View>
  );
}

function RecipePreview({ recipe, onBookmark }: { recipe: NonNullable<Post["recipe"]>; onBookmark: () => void }) {
  const colors = useColors();
  const { toggleRecipeSave } = useCommunity();
  return (
    <View style={[styles.recipeCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={[styles.recipePhotoPlaceholder, { backgroundColor: colors.border }]}>
        <Feather name="image" size={32} color={colors.mutedForeground} />
      </View>
      <View style={styles.recipeInfo}>
        <Text style={[styles.recipeTitle, { color: colors.foreground }]} numberOfLines={1}>{recipe.title}</Text>
        <View style={styles.nutriRow}>
          <View style={[styles.calBadge, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="zap" size={10} color={colors.primary} />
            <Text style={[styles.calText, { color: colors.primary }]}>{recipe.nutrition.calories} cal</Text>
          </View>
          <NutritionBadge label="P" value={recipe.nutrition.protein} color="#3B82F6" />
          <NutritionBadge label="C" value={recipe.nutrition.carbs} color="#F59E0B" />
          <NutritionBadge label="F" value={recipe.nutrition.fat} color="#EF4444" />
        </View>
      </View>
      <TouchableOpacity style={styles.bookmarkBtn} onPress={onBookmark}>
        <Ionicons
          name={recipe.saved ? "bookmark" : "bookmark-outline"}
          size={20}
          color={recipe.saved ? colors.primary : colors.mutedForeground}
        />
      </TouchableOpacity>
    </View>
  );
}

function PollPreview({ poll, postId }: { poll: NonNullable<Post["poll"]>; postId: string }) {
  const colors = useColors();
  const { votePoll } = useCommunity();
  const hasVoted = poll.userVoteId !== null;

  return (
    <View style={styles.pollContainer}>
      <Text style={[styles.pollQuestion, { color: colors.foreground }]}>{poll.question}</Text>
      {poll.options.map((opt) => {
        const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
        const isSelected = poll.userVoteId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.pollOption, { borderColor: isSelected ? colors.primary : colors.border }]}
            onPress={() => { if (!hasVoted) { Haptics.selectionAsync(); votePoll(postId, opt.id); } }}
            disabled={hasVoted}
          >
            {hasVoted && (
              <View style={[styles.pollBar, { width: `${pct}%`, backgroundColor: isSelected ? colors.primary + "33" : colors.muted }]} />
            )}
            <Text style={[styles.pollOptionText, { color: isSelected ? colors.primary : colors.foreground }]}>{opt.text}</Text>
            {hasVoted && <Text style={[styles.pollPct, { color: isSelected ? colors.primary : colors.mutedForeground }]}>{pct}%</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.pollMeta, { color: colors.mutedForeground }]}>{poll.totalVotes} votes</Text>
    </View>
  );
}

export function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const { toggleLike, toggleBookmark } = useCommunity();
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isLiked = post.likes.includes("current_user");
  const isLong = post.content.length > 200;

  function handleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    toggleLike(post.id);
  }

  function openDetail() {
    router.push(`/post/${post.id}`);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: "#000" }]}>
      {post.isPosting && (
        <View style={[styles.postingBanner, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.postingText, { color: colors.primary }]}>Posting...</Text>
        </View>
      )}
      {post.isFailed && (
        <TouchableOpacity style={[styles.failedBanner, { backgroundColor: "#FEE2E2" }]}>
          <Text style={styles.failedText}>Failed to post. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <AvatarCircle name={post.userName} size={40} />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{post.userName}</Text>
            {post.isCoach && (
              <View style={[styles.coachBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.coachText}>Coach</Text>
              </View>
            )}
          </View>
          <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{timeAgo(post.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleBookmark(post.id)} style={styles.bookmarkTopBtn}>
          <Ionicons
            name={post.bookmarked ? "bookmark" : "bookmark-outline"}
            size={18}
            color={post.bookmarked ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <Pressable onPress={openDetail}>
        {post.content.length > 0 && (
          <View style={styles.contentContainer}>
            <Text style={[styles.content, { color: colors.foreground }]} numberOfLines={expanded ? undefined : 4}>
              {post.content}
            </Text>
            {isLong && !expanded && (
              <TouchableOpacity onPress={() => setExpanded(true)}>
                <Text style={[styles.readMore, { color: colors.primary }]}>Read more</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {post.imageUrl && (
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}

        {post.recipe && (
          <RecipePreview recipe={post.recipe} onBookmark={() => {}} />
        )}

        {post.poll && (
          <PollPreview poll={post.poll} postId={post.id} />
        )}
      </Pressable>

      <View style={[styles.engagementRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.engagBtn} onPress={handleLike}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? "#EF4444" : colors.mutedForeground}
            />
          </Animated.View>
          <Text style={[styles.engagCount, { color: colors.mutedForeground }]}>{post.likes.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.engagBtn} onPress={openDetail}>
          <Feather name="message-circle" size={19} color={colors.mutedForeground} />
          <Text style={[styles.engagCount, { color: colors.mutedForeground }]}>{post.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.engagBtn} onPress={() => Haptics.selectionAsync()}>
          <Feather name="share" size={19} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  postingBanner: { paddingHorizontal: 16, paddingVertical: 6 },
  postingText: { fontSize: 12, fontWeight: "500" },
  failedBanner: { paddingHorizontal: 16, paddingVertical: 8 },
  failedText: { fontSize: 12, color: "#DC2626", fontWeight: "500" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 10 },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700" },
  headerText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontWeight: "600" },
  coachBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coachText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  timeAgo: { fontSize: 12, marginTop: 1 },
  bookmarkTopBtn: { padding: 4 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 10 },
  content: { fontSize: 14, lineHeight: 21 },
  readMore: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  postImage: { width: "100%", height: 220, marginBottom: 4 },
  recipeCard: {
    marginHorizontal: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", overflow: "hidden", alignItems: "center",
  },
  recipePhotoPlaceholder: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  recipeInfo: { flex: 1, padding: 10 },
  recipeTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  nutriRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  calBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  calText: { fontSize: 11, fontWeight: "600" },
  nutriBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignItems: "center" },
  nutriValue: { fontSize: 11, fontWeight: "700" },
  nutriLabel: { fontSize: 9, fontWeight: "500" },
  bookmarkBtn: { padding: 12 },
  pollContainer: { paddingHorizontal: 16, paddingBottom: 10 },
  pollQuestion: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  pollOption: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
    flexDirection: "row", alignItems: "center", overflow: "hidden", position: "relative",
  },
  pollBar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10 },
  pollOptionText: { fontSize: 13, fontWeight: "500", flex: 1, zIndex: 1 },
  pollPct: { fontSize: 13, fontWeight: "700", zIndex: 1 },
  pollMeta: { fontSize: 12, marginTop: 2 },
  engagementRow: { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 8, paddingVertical: 8 },
  engagBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 4 },
  engagCount: { fontSize: 13, fontWeight: "500" },
});
