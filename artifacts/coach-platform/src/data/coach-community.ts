export type PostStatus = 'published' | 'hidden' | 'flagged' | 'pending';
export type FlagReason = 'spam' | 'inappropriate' | 'misinformation' | 'harassment' | 'other';
export type RecipeReviewStatus = 'pending' | 'approved' | 'featured' | 'rejected';

export interface CommunityPost {
  id: string;
  programId: string;
  programName: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorInitials: string;
  isCoach: boolean;
  channel: string;
  channelEmoji: string;
  content: string;
  imageUrl?: string;
  attachedRecipeId?: string;
  attachedRecipeName?: string;
  likes: number;
  comments: number;
  isPinned: boolean;
  isFeatured: boolean;
  status: PostStatus;
  createdAt: string;
  flagCount: number;
}

export interface FlaggedPost {
  id: string;
  postId: string;
  post: CommunityPost;
  flaggedBy: string;
  flaggedByInitials: string;
  reason: FlagReason;
  detail: string;
  flaggedAt: string;
  autoFlagged: boolean;
}

export interface PendingRecipe {
  id: string;
  title: string;
  authorName: string;
  authorInitials: string;
  programName: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  submittedAt: string;
  status: RecipeReviewStatus;
  image?: string;
  notes?: string;
}

export interface CoachChannel {
  id: string;
  name: string;
  emoji: string;
  description: string;
  memberCount: number;
}

export const COACH_CHANNELS: CoachChannel[] = [
  { id: 'c1', name: 'general', emoji: '💬', description: 'General discussion', memberCount: 312 },
  { id: 'c2', name: 'meal-prep', emoji: '🍽️', description: 'Share meal prep ideas', memberCount: 187 },
  { id: 'c3', name: 'wins', emoji: '🏆', description: 'Celebrate your wins!', memberCount: 245 },
  { id: 'c4', name: 'pcos-support', emoji: '💜', description: 'PCOS community support', memberCount: 134 },
  { id: 'c5', name: 'recipes', emoji: '🥗', description: 'User-shared recipes', memberCount: 203 },
  { id: 'c6', name: 'fitness', emoji: '💪', description: 'Fitness & movement', memberCount: 156 },
  { id: 'c7', name: 'announcements', emoji: '📣', description: 'Coach announcements', memberCount: 312 },
];

export const COACH_PROGRAMS = [
  { id: 'all', name: 'All Programs' },
  { id: 'p1', name: 'PCOS Reversal Program' },
  { id: 'p2', name: 'Transform 90' },
  { id: 'p3', name: 'Gut Reset 30-Day' },
];

const NOW = new Date();
function daysAgo(n: number) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function hoursAgo(n: number) {
  const d = new Date(NOW);
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post1', programId: 'p1', programName: 'PCOS Reversal Program',
    authorId: 'u1', authorName: 'Ananya Sharma', authorAvatar: '', authorInitials: 'AS',
    isCoach: false, channel: 'wins', channelEmoji: '🏆',
    content: 'Just completed Week 6 of the PCOS program! My cycle has been regular for the first time in 3 years. The meal plan changes really made a difference. Thank you coach! 🌸',
    likes: 47, comments: 12, isPinned: true, isFeatured: false,
    status: 'published', createdAt: hoursAgo(2), flagCount: 0,
  },
  {
    id: 'post2', programId: 'p2', programName: 'Transform 90',
    authorId: 'u2', authorName: 'Meera Patel', authorAvatar: '', authorInitials: 'MP',
    isCoach: false, channel: 'meal-prep', channelEmoji: '🍽️',
    content: 'Made the quinoa Buddha bowl from the recipe library today — swapped chickpeas for tofu and it came out amazing! Anyone else tried variations?',
    attachedRecipeName: 'Quinoa Buddha Bowl',
    likes: 23, comments: 8, isPinned: false, isFeatured: false,
    status: 'published', createdAt: hoursAgo(5), flagCount: 0,
  },
  {
    id: 'post3', programId: 'p1', programName: 'PCOS Reversal Program',
    authorId: 'u3', authorName: 'Priya Singh', authorAvatar: '', authorInitials: 'PS',
    isCoach: false, channel: 'pcos-support', channelEmoji: '💜',
    content: 'Struggling with the no-sugar week. Any tips from those who made it through? I really want to stick to the plan but the cravings are intense around day 3-4.',
    likes: 31, comments: 19, isPinned: false, isFeatured: false,
    status: 'published', createdAt: hoursAgo(8), flagCount: 0,
  },
  {
    id: 'post4', programId: 'p3', programName: 'Gut Reset 30-Day',
    authorId: 'u4', authorName: 'Lakshmi Rao', authorAvatar: '', authorInitials: 'LR',
    isCoach: false, channel: 'general', channelEmoji: '💬',
    content: 'Day 10 of Gut Reset! Bloating has reduced noticeably. Energy levels feel way more stable throughout the day. The probiotic foods recommendation really works.',
    likes: 18, comments: 5, isPinned: false, isFeatured: false,
    status: 'published', createdAt: daysAgo(1), flagCount: 0,
  },
  {
    id: 'post5', programId: 'p2', programName: 'Transform 90',
    authorId: 'u5', authorName: 'Divya Nair', authorAvatar: '', authorInitials: 'DN',
    isCoach: false, channel: 'fitness', channelEmoji: '💪',
    content: 'Just hit my first 5km run this morning! 8 weeks ago I could barely walk 1km. This program changed everything. The accountability check-ins kept me going on tough days.',
    likes: 62, comments: 24, isPinned: false, isFeatured: false,
    status: 'published', createdAt: daysAgo(1), flagCount: 0,
  },
  {
    id: 'post6', programId: 'p1', programName: 'PCOS Reversal Program',
    authorId: 'u6', authorName: 'Ritu Gupta', authorAvatar: '', authorInitials: 'RG',
    isCoach: false, channel: 'meal-prep', channelEmoji: '🍽️',
    content: 'Sharing my weekly meal prep photo! Prepped all 5 days of lunches in 2 hours. Lentil soup, roasted veg, and overnight oats for breakfast.',
    likes: 29, comments: 7, isPinned: false, isFeatured: false,
    status: 'published', createdAt: daysAgo(2), flagCount: 0,
  },
  {
    id: 'post7', programId: 'p3', programName: 'Gut Reset 30-Day',
    authorId: 'u7', authorName: 'Sunita Mehta', authorAvatar: '', authorInitials: 'SM',
    isCoach: false, channel: 'recipes', channelEmoji: '🥗',
    content: 'My gut-friendly khichdi recipe — mung dal, basmati rice, turmeric, ginger, ghee. No onion or garlic for the first 2 weeks. Super easy to digest and absolutely filling!',
    likes: 41, comments: 15, isPinned: false, isFeatured: false,
    status: 'published', createdAt: daysAgo(2), flagCount: 0,
  },
  {
    id: 'post8', programId: 'p2', programName: 'Transform 90',
    authorId: 'u8', authorName: 'Kavya Reddy', authorAvatar: '', authorInitials: 'KR',
    isCoach: false, channel: 'general', channelEmoji: '💬',
    content: 'Does anyone else feel like Week 4 is a plateau? My weight hasn\'t moved in 10 days but my measurements are still changing. Coach, any advice?',
    likes: 14, comments: 22, isPinned: false, isFeatured: false,
    status: 'published', createdAt: daysAgo(3), flagCount: 0,
  },
];

export const FLAGGED_POSTS: FlaggedPost[] = [
  {
    id: 'f1', postId: 'fp1',
    post: {
      id: 'fp1', programId: 'p2', programName: 'Transform 90',
      authorId: 'u9', authorName: 'Rohit Verma', authorAvatar: '', authorInitials: 'RV',
      isCoach: false, channel: 'general', channelEmoji: '💬',
      content: 'This program is a scam. I\'ve been doing everything and haven\'t lost a single kg in 6 weeks. Save your money — there are free YouTube videos that work better.',
      likes: 3, comments: 8, isPinned: false, isFeatured: false,
      status: 'flagged', createdAt: hoursAgo(6), flagCount: 4,
    },
    flaggedBy: 'Multiple users', flaggedByInitials: '4×',
    reason: 'misinformation', detail: 'Misleading claims about program efficacy',
    flaggedAt: hoursAgo(4), autoFlagged: false,
  },
  {
    id: 'f2', postId: 'fp2',
    post: {
      id: 'fp2', programId: 'p1', programName: 'PCOS Reversal Program',
      authorId: 'u10', authorName: 'Vikram Das', authorAvatar: '', authorInitials: 'VD',
      isCoach: false, channel: 'pcos-support', channelEmoji: '💜',
      content: 'Buy my supplement kit for only ₹2999! Cures PCOS in 30 days guaranteed. DM me for the link. Works 100% better than any diet plan.',
      likes: 0, comments: 2, isPinned: false, isFeatured: false,
      status: 'flagged', createdAt: hoursAgo(12), flagCount: 7,
    },
    flaggedBy: 'Auto-filter + 7 users', flaggedByInitials: '🤖',
    reason: 'spam', detail: 'Promotional content / unsolicited sales pitch',
    flaggedAt: hoursAgo(12), autoFlagged: true,
  },
  {
    id: 'f3', postId: 'fp3',
    post: {
      id: 'fp3', programId: 'p3', programName: 'Gut Reset 30-Day',
      authorId: 'u11', authorName: 'Pooja Jain', authorAvatar: '', authorInitials: 'PJ',
      isCoach: false, channel: 'general', channelEmoji: '💬',
      content: 'I think some of the recipes have way too many calories. I\'ve been tracking and the lentil bowl has almost 700 kcal which doesn\'t match what the chart says.',
      likes: 5, comments: 3, isPinned: false, isFeatured: false,
      status: 'flagged', createdAt: daysAgo(1), flagCount: 1,
    },
    flaggedBy: 'Neha Kapoor', flaggedByInitials: 'NK',
    reason: 'misinformation', detail: 'Incorrect calorie claims',
    flaggedAt: daysAgo(1), autoFlagged: false,
  },
];

export const PENDING_RECIPES: PendingRecipe[] = [
  {
    id: 'pr1', title: 'Gut-Healing Khichdi',
    authorName: 'Sunita Mehta', authorInitials: 'SM',
    programName: 'Gut Reset 30-Day', category: 'Main Course',
    calories: 310, protein: 12, carbs: 48, fat: 7,
    ingredients: ['Mung dal 1/2 cup', 'Basmati rice 1/3 cup', 'Turmeric 1/2 tsp', 'Fresh ginger 1 inch', 'Ghee 1 tsp', 'Cumin seeds', 'Rock salt'],
    submittedAt: daysAgo(1), status: 'pending',
  },
  {
    id: 'pr2', title: 'PCOS Anti-Inflammatory Smoothie',
    authorName: 'Ananya Sharma', authorInitials: 'AS',
    programName: 'PCOS Reversal Program', category: 'Beverage',
    calories: 180, protein: 6, carbs: 32, fat: 4,
    ingredients: ['Spinach 1 cup', 'Flaxseed 1 tbsp', 'Almond milk 200ml', 'Frozen berries 1/2 cup', 'Banana 1 small', 'Ginger 1/2 tsp'],
    submittedAt: daysAgo(2), status: 'pending',
  },
  {
    id: 'pr3', title: 'High-Protein Tofu Scramble',
    authorName: 'Meera Patel', authorInitials: 'MP',
    programName: 'Transform 90', category: 'Breakfast',
    calories: 280, protein: 22, carbs: 18, fat: 12,
    ingredients: ['Firm tofu 200g', 'Bell peppers 1/2 cup', 'Spinach 1 cup', 'Turmeric 1/4 tsp', 'Nutritional yeast 2 tbsp', 'Olive oil 1 tsp', 'Black salt'],
    submittedAt: daysAgo(3), status: 'pending',
    notes: 'Great protein source for vegan participants',
  },
  {
    id: 'pr4', title: 'Overnight Chia Oats',
    authorName: 'Divya Nair', authorInitials: 'DN',
    programName: 'Transform 90', category: 'Breakfast',
    calories: 340, protein: 10, carbs: 52, fat: 10,
    ingredients: ['Rolled oats 1/2 cup', 'Chia seeds 2 tbsp', 'Almond milk 250ml', 'Honey 1 tsp', 'Vanilla extract 1/2 tsp', 'Mixed berries for topping'],
    submittedAt: daysAgo(4), status: 'pending',
  },
];

export function formatPostTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
