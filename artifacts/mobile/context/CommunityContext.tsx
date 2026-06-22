import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { getUserId } from "@/lib/session";
import { useMyGrants } from "@/lib/access";
import {
  useCommunityPosts,
  useCreatePost,
  useToggleLike,
  useAddComment,
  type ApiCommunityPost,
  type ApiComment,
  type ApiPostType,
} from "@/lib/community";

export type Channel = {
  id: string;
  label: string;
  slug: string;
};

export type NutritionSummary = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type RecipeIngredient = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

export type RecipeStep = {
  id: string;
  text: string;
};

export type Recipe = {
  id: string;
  title: string;
  photo: string | null;
  authorId: string;
  authorName: string;
  authorIsCoach: boolean;
  nutrition: NutritionSummary;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  servings: number;
  tags: string[];
  saved: boolean;
  isCoachPick: boolean;
  createdAt: number;
};

export type PollOption = {
  id: string;
  text: string;
  votes: number;
};

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVoteId: string | null;
  durationDays: number;
  endsAt: number;
};

export type Post = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  isCoach: boolean;
  channelId: string;
  content: string;
  imageUrl: string | null;
  recipe: Recipe | null;
  poll: Poll | null;
  likes: string[];
  commentCount: number;
  bookmarked: boolean;
  createdAt: number;
  isPinned: boolean;
  isFeatured: boolean;
  isPosting?: boolean;
  isFailed?: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  isCoach: boolean;
  text: string;
  parentId: string | null;
  createdAt: number;
};

export type Friend = {
  id: string;
  name: string;
  avatar: string | null;
  streak: number;
  adherence: number;
  league: "Bronze" | "Silver" | "Gold" | "Diamond";
  since: number;
  mealsTodayCount: number;
};

export type FriendRequest = {
  id: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string | null;
  status: "pending" | "accepted" | "declined";
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  adherence: number;
  streak: number;
  league: "Bronze" | "Silver" | "Gold" | "Diamond";
  isCurrentUser: boolean;
  isAnonymous: boolean;
};

export type Program = {
  id: string;
  name: string;
};

const CURRENT_USER_ID = "current_user";
const CURRENT_USER_NAME = "You";

const CHANNELS: Channel[] = [
  { id: "all", label: "All", slug: "all" },
  { id: "general", label: "General", slug: "general" },
  { id: "recipes", label: "Recipes", slug: "recipes" },
  { id: "qa", label: "Q&A", slug: "qa" },
  { id: "support", label: "Support", slug: "support" },
  { id: "tips", label: "Tips", slug: "tips" },
];

const PROGRAMS: Program[] = [
  { id: "pcos", name: "PCOS Management" },
  { id: "weight", name: "Weight Loss" },
  { id: "transform", name: "Transform 90" },
];


const SEED_FRIENDS: Friend[] = [
  { id: "f1", name: "Sarah K.", avatar: null, streak: 12, adherence: 94, league: "Gold", since: Date.now() - 1000 * 60 * 60 * 24 * 30, mealsTodayCount: 2 },
  { id: "f2", name: "Alex M.", avatar: null, streak: 5, adherence: 78, league: "Silver", since: Date.now() - 1000 * 60 * 60 * 24 * 15, mealsTodayCount: 1 },
  { id: "f3", name: "Emma W.", avatar: null, streak: 20, adherence: 98, league: "Diamond", since: Date.now() - 1000 * 60 * 60 * 24 * 60, mealsTodayCount: 3 },
];

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: "f3", name: "Emma W.", avatar: null, adherence: 98, streak: 20, league: "Diamond", isCurrentUser: false, isAnonymous: false },
  { rank: 2, userId: "u2", name: "Jordan L.", avatar: null, adherence: 95, streak: 15, league: "Diamond", isCurrentUser: false, isAnonymous: false },
  { rank: 3, userId: "f1", name: "Sarah K.", avatar: null, adherence: 94, streak: 12, league: "Gold", isCurrentUser: false, isAnonymous: false },
  { rank: 4, userId: "u3", name: "Anonymous User", avatar: null, adherence: 91, streak: 9, league: "Gold", isCurrentUser: false, isAnonymous: true },
  { rank: 5, userId: "u4", name: "Marcus T.", avatar: null, adherence: 88, streak: 7, league: "Gold", isCurrentUser: false, isAnonymous: false },
  { rank: 6, userId: CURRENT_USER_ID, name: "You", avatar: null, adherence: 82, streak: 5, league: "Silver", isCurrentUser: true, isAnonymous: false },
  { rank: 7, userId: "f2", name: "Alex M.", avatar: null, adherence: 78, streak: 5, league: "Silver", isCurrentUser: false, isAnonymous: false },
  { rank: 8, userId: "u5", name: "Priya S.", avatar: null, adherence: 71, streak: 3, league: "Silver", isCurrentUser: false, isAnonymous: false },
  { rank: 9, userId: "u6", name: "Daniel K.", avatar: null, adherence: 65, streak: 2, league: "Bronze", isCurrentUser: false, isAnonymous: false },
  { rank: 10, userId: "u7", name: "Mia R.", avatar: null, adherence: 58, streak: 1, league: "Bronze", isCurrentUser: false, isAnonymous: false },
];

const SEED_RECIPES: Recipe[] = [
  {
    id: "recipe1",
    title: "High-Protein Berry Smoothie Bowl",
    photo: null,
    authorId: "coach1",
    authorName: "Dr. Chen",
    authorIsCoach: true,
    nutrition: { calories: 320, protein: 35, carbs: 28, fat: 8 },
    ingredients: [
      { id: "i1", name: "Greek yogurt", quantity: "1", unit: "cup" },
      { id: "i2", name: "Mixed berries", quantity: "1/2", unit: "cup" },
      { id: "i3", name: "Whey protein", quantity: "1", unit: "scoop" },
      { id: "i4", name: "Almond milk", quantity: "1/4", unit: "cup" },
      { id: "i5", name: "Granola", quantity: "2", unit: "tbsp" },
      { id: "i6", name: "Honey", quantity: "1", unit: "tsp" },
    ],
    steps: [
      { id: "s1", text: "Blend yogurt, berries, protein powder, and almond milk until smooth." },
      { id: "s2", text: "Pour into a bowl and top with granola and fresh berries." },
      { id: "s3", text: "Drizzle with honey and serve immediately." },
    ],
    servings: 1,
    tags: ["High Protein", "Low Carb"],
    saved: true,
    isCoachPick: true,
    createdAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: "recipe2",
    title: "Grilled Lemon Herb Salmon",
    photo: null,
    authorId: "user2",
    authorName: "Sarah K.",
    authorIsCoach: false,
    nutrition: { calories: 480, protein: 42, carbs: 22, fat: 24 },
    ingredients: [
      { id: "i1", name: "Salmon fillet", quantity: "200", unit: "g" },
      { id: "i2", name: "Lemon", quantity: "1", unit: "whole" },
      { id: "i3", name: "Olive oil", quantity: "2", unit: "tbsp" },
      { id: "i4", name: "Garlic", quantity: "2", unit: "cloves" },
      { id: "i5", name: "Fresh dill", quantity: "1", unit: "tbsp" },
      { id: "i6", name: "Sweet potato", quantity: "150", unit: "g" },
      { id: "i7", name: "Broccoli florets", quantity: "1", unit: "cup" },
    ],
    steps: [
      { id: "s1", text: "Marinate salmon in lemon juice, olive oil, minced garlic, and dill for 15 minutes." },
      { id: "s2", text: "Cube sweet potato and roast at 200C for 20 minutes." },
      { id: "s3", text: "Grill salmon 4 minutes per side until cooked through." },
      { id: "s4", text: "Steam broccoli for 5 minutes and serve alongside salmon and potato." },
    ],
    servings: 2,
    tags: ["High Protein", "Gluten Free"],
    saved: false,
    isCoachPick: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "recipe3",
    title: "Overnight Chia Oats",
    photo: null,
    authorId: "coach2",
    authorName: "Coach Lisa",
    authorIsCoach: true,
    nutrition: { calories: 380, protein: 18, carbs: 52, fat: 12 },
    ingredients: [
      { id: "i1", name: "Rolled oats", quantity: "1/2", unit: "cup" },
      { id: "i2", name: "Chia seeds", quantity: "2", unit: "tbsp" },
      { id: "i3", name: "Almond milk", quantity: "1", unit: "cup" },
      { id: "i4", name: "Greek yogurt", quantity: "1/4", unit: "cup" },
      { id: "i5", name: "Maple syrup", quantity: "1", unit: "tsp" },
      { id: "i6", name: "Vanilla extract", quantity: "1/2", unit: "tsp" },
    ],
    steps: [
      { id: "s1", text: "Mix oats, chia seeds, almond milk, yogurt, syrup, and vanilla in a jar." },
      { id: "s2", text: "Stir well and refrigerate overnight or for at least 4 hours." },
      { id: "s3", text: "Top with fresh fruit and nuts before serving." },
    ],
    servings: 1,
    tags: ["Veg", "High Protein"],
    saved: false,
    isCoachPick: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "recipe4",
    title: "Chickpea Veggie Buddha Bowl",
    photo: null,
    authorId: "user4",
    authorName: "Emma W.",
    authorIsCoach: false,
    nutrition: { calories: 520, protein: 22, carbs: 68, fat: 18 },
    ingredients: [
      { id: "i1", name: "Chickpeas", quantity: "1", unit: "can" },
      { id: "i2", name: "Quinoa", quantity: "1/2", unit: "cup" },
      { id: "i3", name: "Spinach", quantity: "2", unit: "cups" },
      { id: "i4", name: "Cherry tomatoes", quantity: "1/2", unit: "cup" },
      { id: "i5", name: "Cucumber", quantity: "1/2", unit: "whole" },
      { id: "i6", name: "Tahini", quantity: "2", unit: "tbsp" },
      { id: "i7", name: "Lemon juice", quantity: "2", unit: "tbsp" },
    ],
    steps: [
      { id: "s1", text: "Cook quinoa according to package instructions." },
      { id: "s2", text: "Roast chickpeas at 200C with olive oil and spices for 25 minutes." },
      { id: "s3", text: "Assemble bowl: quinoa base, spinach, tomatoes, cucumber, chickpeas." },
      { id: "s4", text: "Whisk tahini with lemon juice and water for dressing, drizzle over bowl." },
    ],
    servings: 2,
    tags: ["Vegan", "Gluten Free"],
    saved: false,
    isCoachPick: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
  },
];

type CommunityContextType = {
  channels: Channel[];
  posts: Post[];
  comments: Comment[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  leaderboard: LeaderboardEntry[];
  recipes: Recipe[];
  programs: Program[];
  selectedProgram: Program;
  setSelectedProgram: (p: Program) => void;
  currentUserId: string;
  currentUserName: string;
  isLoading: boolean;
  /** True when the user has an active access grant (an org community to read). */
  hasCommunity: boolean;

  createPost: (data: {
    channelId: string;
    content: string;
    imageUrl?: string | null;
    recipe?: Recipe | null;
    poll?: Poll | null;
  }) => Promise<void>;
  toggleLike: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  votePoll: (postId: string, optionId: string) => void;
  addComment: (postId: string, text: string, parentId?: string | null) => Promise<Comment>;
  getPostComments: (postId: string) => Comment[];
  removeFriend: (friendId: string) => void;
  addFriend: (name: string) => void;
  toggleRecipeSave: (recipeId: string) => void;
};

const CommunityContext = createContext<CommunityContextType | null>(null);

function tempId() {
  return "pending_" + Date.now().toString() + Math.random().toString(36).slice(2, 8);
}

/** Map a backend post onto the rich UI `Post` shape (honest defaults — no fabricated PII). */
function mapApiPost(
  p: ApiCommunityPost,
  myId: string,
  bookmarkedIds: Set<string>,
): Post {
  // likedByMe / likeCount are server truth (feed subquery) — no session-local overlay.
  const liked = p.likedByMe;
  const count = Math.max(p.likeCount, liked ? 1 : 0);
  const likes = Array.from({ length: count }, (_, i) => (i === 0 && liked ? CURRENT_USER_ID : `l${i}`));
  if (liked && likes.length && !likes.includes(CURRENT_USER_ID)) likes[0] = CURRENT_USER_ID;

  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  const mediaUrl =
    typeof meta.imageUrl === "string"
      ? (meta.imageUrl as string)
      : p.media && typeof (p.media as Record<string, unknown>).imageUrl === "string"
        ? ((p.media as Record<string, unknown>).imageUrl as string)
        : null;
  // Structured recipe/poll payloads are persisted on the post's metadata (D7 GAP 4).
  const recipe = p.postType === "recipe" && meta.recipe ? (meta.recipe as unknown as Recipe) : null;
  const poll = p.postType === "poll" && meta.poll ? (meta.poll as unknown as Poll) : null;

  return {
    id: p.id,
    userId: p.authorUserId,
    userName: p.authorUserId === myId ? CURRENT_USER_NAME : "Member",
    userAvatar: null,
    isCoach: false,
    channelId: p.postType === "recipe" ? "recipes" : "general",
    content: p.body ?? "",
    imageUrl: mediaUrl,
    recipe,
    poll,
    likes,
    commentCount: p.commentCount,
    bookmarked: bookmarkedIds.has(p.id),
    createdAt: new Date(p.createdAt).getTime(),
    isPinned: p.isPinned,
    isFeatured: p.isPinned,
  };
}

function mapApiComment(c: ApiComment, myId: string): Comment {
  return {
    id: c.id,
    postId: c.postId,
    userId: c.authorUserId,
    userName: c.authorUserId === myId ? CURRENT_USER_NAME : "Member",
    userAvatar: null,
    isCoach: false,
    text: c.body,
    parentId: c.parentCommentId,
    createdAt: new Date(c.createdAt).getTime(),
  };
}

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const myId = getUserId();

  // Org context = the user's first ACTIVE access grant (their coach's community).
  const grants = useMyGrants();
  const organizationId = useMemo(
    () => grants.data?.find((g) => g.status === "active")?.organizationId,
    [grants.data],
  );

  const postsQuery = useCommunityPosts(organizationId);
  const createPostMut = useCreatePost();
  const toggleLikeMut = useToggleLike(organizationId);
  const addCommentMut = useAddComment(organizationId);

  // Bookmark is the only remaining session-local overlay (no backend yet). Likes now come
  // from the feed's likedByMe (server truth) with an optimistic cache update in the hook.
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [commentsCache, setCommentsCache] = useState<Comment[]>([]);

  // Local-only mock domains (no backend yet — leaderboard/friends/recipes/programs).
  const [friends, setFriends] = useState<Friend[]>(SEED_FRIENDS);
  const [friendRequests] = useState<FriendRequest[]>([]);
  const [leaderboard] = useState<LeaderboardEntry[]>(SEED_LEADERBOARD);
  const [recipes, setRecipes] = useState<Recipe[]>(SEED_RECIPES);
  const [selectedProgram, setSelectedProgram] = useState<Program>(PROGRAMS[0]);

  const posts = useMemo<Post[]>(() => {
    const mapped = (postsQuery.data ?? []).map((p) => mapApiPost(p, myId, bookmarkedIds));
    return [...pendingPosts, ...mapped];
  }, [postsQuery.data, pendingPosts, bookmarkedIds, myId]);

  const isLoading = grants.isLoading || (!!organizationId && postsQuery.isLoading);

  const createPost = useCallback(
    async (data: {
      channelId: string;
      content: string;
      imageUrl?: string | null;
      recipe?: Recipe | null;
      poll?: Poll | null;
    }) => {
      if (!organizationId) return; // no community to post into
      const postType: ApiPostType = data.recipe
        ? "recipe"
        : data.poll
          ? "poll"
          : data.imageUrl
            ? "image"
            : "text";
      const optimistic: Post = {
        id: tempId(),
        userId: myId,
        userName: CURRENT_USER_NAME,
        userAvatar: null,
        isCoach: false,
        channelId: data.channelId,
        content: data.content,
        imageUrl: data.imageUrl ?? null,
        recipe: data.recipe ?? null,
        poll: data.poll ?? null,
        likes: [],
        commentCount: 0,
        bookmarked: false,
        createdAt: Date.now(),
        isPinned: false,
        isFeatured: false,
        isPosting: true,
      };
      // Persist the structured recipe/poll payload so it survives a refetch (D7 GAP 4).
      const metadata: Record<string, unknown> | undefined =
        postType === "recipe"
          ? { recipe: data.recipe, imageUrl: data.imageUrl ?? data.recipe?.photo ?? null }
          : postType === "poll"
            ? { poll: data.poll }
            : data.imageUrl
              ? { imageUrl: data.imageUrl }
              : undefined;

      setPendingPosts((prev) => [optimistic, ...prev]);
      try {
        await createPostMut.mutateAsync({
          organizationId,
          postType,
          body: data.content,
          ...(metadata ? { metadata } : {}),
        });
        // The refetch (mutation onSuccess invalidates) will include the real post.
        setPendingPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
      } catch {
        setPendingPosts((prev) =>
          prev.map((p) => (p.id === optimistic.id ? { ...p, isPosting: false, isFailed: true } : p)),
        );
      }
    },
    [organizationId, myId, createPostMut],
  );

  const toggleLike = useCallback(
    (postId: string) => {
      // Current state from server truth; the mutation optimistically flips the cache.
      const current = (postsQuery.data ?? []).find((p) => p.id === postId)?.likedByMe ?? false;
      toggleLikeMut.mutate({ postId, liked: !current });
    },
    [postsQuery.data, toggleLikeMut],
  );

  const toggleBookmark = useCallback((postId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  // Polls aren't backed in the feed payload yet; real posts carry poll=null so this
  // is effectively inert (kept for interface compatibility).
  const votePoll = useCallback((_postId: string, _optionId: string) => {}, []);

  const addComment = useCallback(
    async (postId: string, text: string, parentId?: string | null): Promise<Comment> => {
      const res = await addCommentMut.mutateAsync({
        postId,
        body: text,
        ...(parentId ? { parentCommentId: parentId } : {}),
      });
      const c = mapApiComment(res, myId);
      setCommentsCache((prev) => [...prev, c]);
      return c;
    },
    [addCommentMut, myId],
  );

  const getPostComments = useCallback(
    (postId: string) => commentsCache.filter((c) => c.postId === postId),
    [commentsCache],
  );

  const removeFriend = useCallback((friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
  }, []);

  const addFriend = useCallback((name: string) => {
    setFriends((prev) => [
      ...prev,
      { id: tempId(), name, avatar: null, streak: 0, adherence: 0, league: "Bronze", since: Date.now(), mealsTodayCount: 0 },
    ]);
  }, []);

  const toggleRecipeSave = useCallback((recipeId: string) => {
    setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, saved: !r.saved } : r)));
  }, []);

  return (
    <CommunityContext.Provider
      value={{
        channels: CHANNELS,
        posts,
        comments: commentsCache,
        friends,
        friendRequests,
        leaderboard,
        recipes,
        programs: PROGRAMS,
        selectedProgram,
        setSelectedProgram,
        currentUserId: CURRENT_USER_ID,
        currentUserName: CURRENT_USER_NAME,
        isLoading,
        hasCommunity: !!organizationId,
        createPost,
        toggleLike,
        toggleBookmark,
        votePoll,
        addComment,
        getPostComments,
        removeFriend,
        addFriend,
        toggleRecipeSave,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error("useCommunity must be used inside CommunityProvider");
  return ctx;
}
