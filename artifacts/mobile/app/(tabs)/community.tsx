import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCommunity, type Post } from "@/context/CommunityContext";
import { PostCard } from "@/components/community/PostCard";
import { SkeletonCard } from "@/components/community/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import {
  FullLeaderboardRow,
  MagneticCapsRow,
} from "@/components/community/LeaderboardMagneticCaps";
import { FriendRow } from "@/components/community/FriendRow";
import AskAIBubble from "@/components/AskAIBubble";

type SubTab = "feed" | "leaderboard" | "friends";

function ChannelPills({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  const { channels } = useCommunity();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillsContainer}
      style={{ backgroundColor: colors.card }}
    >
      {channels.map((ch) => {
        const active = ch.id === selectedId;
        return (
          <TouchableOpacity
            key={ch.id}
            style={[
              styles.pill,
              {
                backgroundColor: active ? colors.primary : colors.muted,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(ch.id);
            }}
          >
            <Text
              style={[
                styles.pillText,
                { color: active ? "#fff" : colors.mutedForeground },
              ]}
            >
              {ch.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function FeedTab({
  bottomInset,
  showSearch,
  setShowSearch,
}: {
  bottomInset: number;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
}) {
  const colors = useColors();
  const { posts, isLoading, hasCommunity } = useCommunity();
  const [channelId, setChannelId] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = posts.filter((p) => {
    const matchChannel = channelId === "all" || p.channelId === channelId;
    const matchSearch = !search.trim() ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      p.userName.toLowerCase().includes(search.toLowerCase());
    return matchChannel && matchSearch;
  });

  async function handleRefresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }

  const renderPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} />,
    []
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const ListHeader = () => (
    <View>
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border, margin: 12, marginBottom: 4 }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search posts, people..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ChannelPills selectedId={channelId} onSelect={setChannelId} />
    </View>
  );

  const ListEmpty = () => {
    if (!hasCommunity && !search) {
      return (
        <EmptyState
          icon="users"
          title="Join a community"
          subtitle="Enter your coach's organization ID in your profile to see and post in their community feed."
          actionLabel="Connect to a coach"
          onAction={() => router.push("/grant-access")}
        />
      );
    }
    return (
      <EmptyState
        icon={search ? "search" : "message-square"}
        title={search ? "No posts found" : "No posts yet"}
        subtitle={search ? "Try a different search term or clear the search." : "Be the first to share a meal, recipe or progress photo!"}
        actionLabel={search ? "Clear Search" : "Create Post"}
        onAction={search ? () => setSearch("") : () => router.push("/create-post")}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ChannelPills selectedId={channelId} onSelect={setChannelId} />
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomInset + 100 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomInset + 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

function LeaderboardTab({ bottomInset }: { bottomInset: number }) {
  const colors = useColors();
  const { leaderboard, programs, selectedProgram, setSelectedProgram } =
    useCommunity();
  const [showFullList, setShowFullList] = useState(false);
  const [showProgramPicker, setShowProgramPicker] = useState(false);

  const currentUserIndex = leaderboard.findIndex((e) => e.isCurrentUser);
  const above = currentUserIndex > 0 ? leaderboard[currentUserIndex - 1] : null;
  const current = leaderboard[currentUserIndex];
  const below =
    currentUserIndex < leaderboard.length - 1
      ? leaderboard[currentUserIndex + 1]
      : null;

  const aboveGap = above && current ? above.adherence - current.adherence : 0;
  const belowGap = below && current ? current.adherence - below.adherence : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
    >
      <View style={[styles.leaderboardHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.programSelector, { borderColor: colors.border, backgroundColor: colors.muted }]}
          onPress={() => setShowProgramPicker(!showProgramPicker)}
        >
          <Text style={[styles.programName, { color: colors.foreground }]}>{selectedProgram.name}</Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {showProgramPicker && (
          <View style={[styles.programDropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}>
            {programs.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.programOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedProgram(p);
                  setShowProgramPicker(false);
                }}
              >
                <Text style={[styles.programOptionText, { color: p.id === selectedProgram.id ? colors.primary : colors.foreground }]}>
                  {p.name}
                </Text>
                {p.id === selectedProgram.id && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>{weekLabel}</Text>

        {current && (
          <View style={[styles.leagueBadge, { backgroundColor: "#F59E0B22" }]}>
            <MaterialCommunityIcons name="shield-star" size={20} color="#F59E0B" />
            <Text style={[styles.leagueLabel, { color: "#F59E0B" }]}>{current.league} League</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionLabel}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>YOUR POSITION</Text>
      </View>

      {above && (
        <MagneticCapsRow entry={above} isAbove pointsGap={aboveGap} />
      )}
      {current && <MagneticCapsRow entry={current} />}
      {below && (
        <MagneticCapsRow entry={below} isBelow pointsGap={belowGap} />
      )}

      <TouchableOpacity
        style={[styles.viewFullBtn, { borderColor: colors.border }]}
        onPress={() => setShowFullList(!showFullList)}
      >
        <Text style={[styles.viewFullText, { color: colors.primary }]}>
          {showFullList ? "Hide Full Leaderboard" : "View Full Leaderboard"}
        </Text>
        <Feather name={showFullList ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
      </TouchableOpacity>

      {showFullList && (
        <View style={[styles.fullListContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {leaderboard.map((entry) => (
            <FullLeaderboardRow key={entry.userId} entry={entry} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function FriendsTab({ bottomInset }: { bottomInset: number }) {
  const colors = useColors();
  const { friends, currentUserId, removeFriend } = useCommunity();

  const CURRENT_ADHERENCE = 82;
  const CURRENT_STREAK = 5;

  const meAsFriend = {
    id: currentUserId,
    name: "You",
    avatar: null,
    streak: CURRENT_STREAK,
    adherence: CURRENT_ADHERENCE,
    league: "Silver" as const,
    since: Date.now(),
    mealsTodayCount: 1,
  };

  const allEntries = [
    ...friends.map((f) => ({ ...f, adherence: f.adherence, isMe: false })),
    { ...meAsFriend, isMe: true },
  ].sort((a, b) => b.adherence - a.adherence);

  const nudgeFriend = friends.find((f) => f.mealsTodayCount > meAsFriend.mealsTodayCount);

  if (friends.length === 0) {
    return (
      <View style={styles.emptyFriends}>
        <MaterialCommunityIcons name="account-group" size={64} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No friends yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
          Add friends to compete and stay motivated together!
        </Text>
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/search-friends")}
        >
          <Feather name="user-plus" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>Find Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteBtn, { borderColor: colors.primary }]}
          onPress={() => Alert.alert("Share Invite Link", "Invite link copied to clipboard!")}
        >
          <Feather name="share-2" size={16} color={colors.primary} />
          <Text style={[styles.inviteBtnText, { color: colors.primary }]}>Share Invite Link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + 100, paddingTop: 12 }}
    >
      {nudgeFriend && (
        <View style={[styles.nudgeBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "44" }]}>
          <Ionicons name="flame" size={16} color={colors.primary} />
          <Text style={[styles.nudgeText, { color: colors.foreground }]}>
            <Text style={{ fontWeight: "700" }}>{nudgeFriend.name}</Text>
            {" "}already logged {nudgeFriend.mealsTodayCount} meals today. Don't fall behind!
          </Text>
        </View>
      )}

      <View style={[styles.friendsHeader, { paddingHorizontal: 16, marginBottom: 8 }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>THIS WEEK'S STANDINGS</Text>
        <TouchableOpacity onPress={() => router.push("/search-friends")} style={styles.addFriendBtn}>
          <Feather name="user-plus" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {allEntries.map((entry, idx) => {
        if (entry.isMe) {
          return (
            <FriendRow
              key="me"
              friend={meAsFriend}
              rank={idx + 1}
              isCurrentUser
              adherence={CURRENT_ADHERENCE}
              onRemove={() => {}}
              onPress={() => {}}
            />
          );
        }
        const f = friends.find((fr) => fr.id === entry.id)!;
        return (
          <FriendRow
            key={f.id}
            friend={f}
            rank={idx + 1}
            adherence={f.adherence}
            onRemove={removeFriend}
            onPress={() =>
              Alert.alert(
                f.name,
                `Streak: ${f.streak} days\nLeague: ${f.league}\nFriends since: ${new Date(f.since).toLocaleDateString()}`,
                [
                  { text: "Close" },
                  {
                    text: "Remove Friend",
                    style: "destructive",
                    onPress: () =>
                      Alert.alert("Remove Friend", `Remove ${f.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => removeFriend(f.id) },
                      ]),
                  },
                ]
              )
            }
          />
        );
      })}
    </ScrollView>
  );
}

export default function CommunityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<SubTab>("feed");
  const [showSearch, setShowSearch] = useState(false);

  const tabBarH = Platform.OS === "web" ? 84 : 56 + insets.bottom;

  const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
    { id: "feed", label: "Feed", icon: "home" },
    { id: "leaderboard", label: "Leaderboard", icon: "bar-chart-2" },
    { id: "friends", label: "Friends", icon: "users" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Community</Text>
        {subTab === "feed" && (
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setShowSearch((v) => !v);
            }}
          >
            <Feather
              name={showSearch ? "x" : "search"}
              size={20}
              color={showSearch ? colors.primary : colors.foreground}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.subTabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {SUB_TABS.map((tab) => {
          const active = subTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTabBtn, active && [styles.subTabActive, { borderBottomColor: colors.primary }]]}
              onPress={() => {
                Haptics.selectionAsync();
                setSubTab(tab.id);
                if (tab.id !== "feed") setShowSearch(false);
              }}
            >
              <Feather name={tab.icon as any} size={16} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.subTabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {subTab === "feed" && (
          <FeedTab
            bottomInset={insets.bottom}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
          />
        )}
        {subTab === "leaderboard" && <LeaderboardTab bottomInset={insets.bottom} />}
        {subTab === "friends" && <FriendsTab bottomInset={insets.bottom} />}
      </View>

      {subTab === "feed" && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, bottom: tabBarH + 16 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/create-post");
          }}
        >
          <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <AskAIBubble />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  searchIconBtn: { padding: 6 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabActive: {},
  subTabText: { fontSize: 13, fontWeight: "600" },
  pillsContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyFriends: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptySubtitle: { fontSize: 14, lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  inviteBtnText: { fontSize: 15, fontWeight: "600" },
  leaderboardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    gap: 10,
    position: "relative",
    zIndex: 10,
  },
  programSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  programName: { fontSize: 15, fontWeight: "600" },
  programDropdown: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  programOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  programOptionText: { fontSize: 15 },
  weekLabel: { fontSize: 13 },
  leagueBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" },
  leagueLabel: { fontSize: 14, fontWeight: "700" },
  sectionLabel: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  viewFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewFullText: { fontSize: 14, fontWeight: "600" },
  fullListContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  nudgeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  nudgeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  friendsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addFriendBtn: { padding: 4 },
});
