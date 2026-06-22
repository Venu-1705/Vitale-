// ─── Types ─────────────────────────────────────────────────────────────────────

export type ChannelCategory = 'General' | 'Program-Specific' | 'Interest-Based' | 'Announcements' | 'Support';
export type ChannelStatus = 'Active' | 'Muted' | 'Archived';
export type AccessRuleType = 'Everyone' | 'Program' | 'Tier' | 'Interest' | 'Custom';
export type PostStatus = 'Published' | 'Pending' | 'Removed' | 'Flagged';
export type MemberRole = 'Admin' | 'Coach' | 'Team' | 'Member';
export type FlagReason = 'Auto-flagged: keyword' | 'User reported' | 'Pending approval' | 'Spam' | 'Inappropriate';
export type ModActionType = 'Approved' | 'Removed' | 'Muted' | 'Banned' | 'Warned';

export interface AccessRule {
  type: AccessRuleType;
  label: string;
  value?: string;
}

export interface Channel {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: ChannelCategory;
  status: ChannelStatus;
  memberCount: number;
  postCount: number;
  accessRules: AccessRule[];
  moderationQueue: boolean;
  whoCanPost: 'Everyone' | 'Coaches & Team Only' | 'Admins Only';
  whoCanReply: 'Everyone' | 'Coaches & Team Only' | 'Members Only';
  allowImages: boolean;
  allowVideos: boolean;
  allowDocuments: boolean;
  allowLinks: boolean;
  profanityFilter: boolean;
  autoFlagKeywords: string[];
  notifyOnPost: boolean;
  notifyFreq: 'Every post' | 'Daily digest' | 'Weekly digest';
  pinned: boolean;
}

export interface CommunityMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: MemberRole;
  channels: string[];
  totalPosts: number;
  totalComments: number;
  reactionsGiven: number;
  flags: number;
  warnings: number;
  status: 'Active' | 'Muted' | 'Banned';
  joinedDate: string;
  lastActive: string;
  interestTags: string[];
}

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorRole: MemberRole;
  content: string;
  timestamp: string;
  reactions: { emoji: string; count: number }[];
}

export interface CommunityPost {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorRole: MemberRole;
  content: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  reactions: { emoji: string; count: number }[];
  comments: PostComment[];
  timestamp: string;
  status: PostStatus;
  pinned: boolean;
  flagReason?: FlagReason;
  flaggedBy?: string;
}

export interface ModerationItem {
  id: string;
  postId: string;
  postContent: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorRole: MemberRole;
  channelId: string;
  channelName: string;
  flagReason: FlagReason;
  flaggedBy?: string;
  timestamp: string;
  status: 'Pending' | 'Reviewed' | 'Escalated';
}

export interface ModerationLogItem {
  id: string;
  date: string;
  moderator: string;
  action: ModActionType;
  target: string;
  channel: string;
  reason: string;
}

export interface InterestTag {
  id: string;
  name: string;
  emoji: string;
  description: string;
  usageCount: number;
}

export interface EngagementDay {
  date: string;
  posts: number;
  comments: number;
  newMembers: number;
}

// ─── Config ────────────────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<ChannelCategory, { label: string; badge: string; text: string }> = {
  General:          { label: 'General',          badge: 'bg-blue-50 border-blue-200',   text: 'text-blue-700' },
  'Program-Specific': { label: 'Program',         badge: 'bg-green-50 border-green-200', text: 'text-green-700' },
  'Interest-Based': { label: 'Interest',          badge: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
  Announcements:    { label: 'Announcements',     badge: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  Support:          { label: 'Support',           badge: 'bg-red-50 border-red-200',     text: 'text-red-700' },
};

export const ACCESS_RULE_CONFIG: Record<AccessRuleType, { badge: string; text: string; icon: string }> = {
  Everyone: { badge: 'bg-green-100 border-green-200',  text: 'text-green-700',  icon: '🌐' },
  Program:  { badge: 'bg-blue-100 border-blue-200',    text: 'text-blue-700',   icon: '📗' },
  Tier:     { badge: 'bg-amber-100 border-amber-200',  text: 'text-amber-700',  icon: '⭐' },
  Interest: { badge: 'bg-violet-100 border-violet-200',text: 'text-violet-700', icon: '#️⃣' },
  Custom:   { badge: 'bg-gray-100 border-gray-200',    text: 'text-gray-700',   icon: '👥' },
};

export const ROLE_CONFIG: Record<MemberRole, { badge: string; text: string }> = {
  Admin:  { badge: 'bg-red-100 border-red-200',    text: 'text-red-700' },
  Coach:  { badge: 'bg-primary/10 border-primary/30', text: 'text-primary' },
  Team:   { badge: 'bg-blue-100 border-blue-200',  text: 'text-blue-700' },
  Member: { badge: 'bg-gray-100 border-gray-200',  text: 'text-gray-600' },
};

// ─── Channels ──────────────────────────────────────────────────────────────────

export const CHANNELS: Channel[] = [
  {
    id: 'ch-general', name: 'General Discussion', emoji: '💬', description: 'Open discussion for all platform members',
    category: 'General', status: 'Active', memberCount: 342, postCount: 487, pinned: true,
    accessRules: [{ type: 'Everyone', label: 'Everyone' }],
    moderationQueue: false, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: true, allowLinks: true,
    profanityFilter: true, autoFlagKeywords: [],
    notifyOnPost: true, notifyFreq: 'Daily digest',
  },
  {
    id: 'ch-recipes', name: 'Recipe Sharing', emoji: '🍽️', description: 'Share healthy recipes and cooking tips',
    category: 'General', status: 'Active', memberCount: 289, postCount: 341, pinned: false,
    accessRules: [{ type: 'Everyone', label: 'Everyone' }],
    moderationQueue: false, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: false, allowLinks: true,
    profanityFilter: false, autoFlagKeywords: [],
    notifyOnPost: true, notifyFreq: 'Daily digest',
  },
  {
    id: 'ch-pcos', name: 'PCOS Support Group', emoji: '💜', description: 'Safe space for members on the PCOS Management program',
    category: 'Program-Specific', status: 'Active', memberCount: 67, postCount: 214, pinned: false,
    accessRules: [{ type: 'Program', label: 'Program: PCOS Management', value: 'PCOS Management' }],
    moderationQueue: true, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: false, allowDocuments: true, allowLinks: false,
    profanityFilter: true, autoFlagKeywords: ['scam', 'cure', 'miracle'],
    notifyOnPost: true, notifyFreq: 'Every post',
  },
  {
    id: 'ch-weight', name: 'Weight Loss Warriors', emoji: '🏋️', description: 'Exclusive channel for Weight Loss Challenge participants',
    category: 'Program-Specific', status: 'Active', memberCount: 112, postCount: 178, pinned: false,
    accessRules: [{ type: 'Program', label: 'Program: Weight Loss Challenge', value: 'Weight Loss Challenge' }],
    moderationQueue: false, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: false, allowLinks: true,
    profanityFilter: true, autoFlagKeywords: [],
    notifyOnPost: false, notifyFreq: 'Daily digest',
  },
  {
    id: 'ch-transform', name: 'Transformation Stories', emoji: '✨', description: 'Celebrate member wins and transformation journeys',
    category: 'General', status: 'Active', memberCount: 342, postCount: 89, pinned: false,
    accessRules: [{ type: 'Everyone', label: 'Everyone' }],
    moderationQueue: true, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: false, allowLinks: false,
    profanityFilter: true, autoFlagKeywords: ['before', 'after'],
    notifyOnPost: true, notifyFreq: 'Every post',
  },
  {
    id: 'ch-coachqa', name: 'Coach Q&A', emoji: '🎓', description: 'Ask your coach anything — coaches answer here',
    category: 'General', status: 'Active', memberCount: 342, postCount: 256, pinned: false,
    accessRules: [{ type: 'Everyone', label: 'Everyone' }],
    moderationQueue: false, whoCanPost: 'Coaches & Team Only', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: false, allowDocuments: true, allowLinks: true,
    profanityFilter: false, autoFlagKeywords: [],
    notifyOnPost: true, notifyFreq: 'Every post',
  },
  {
    id: 'ch-fitness', name: 'Fitness Tips', emoji: '💪', description: 'Workout tips, exercise guides, and fitness motivation',
    category: 'Interest-Based', status: 'Active', memberCount: 145, postCount: 203, pinned: false,
    accessRules: [{ type: 'Interest', label: 'Interest: #fitness', value: '#fitness' }],
    moderationQueue: false, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: false, allowLinks: true,
    profanityFilter: false, autoFlagKeywords: [],
    notifyOnPost: false, notifyFreq: 'Weekly digest',
  },
  {
    id: 'ch-mealprep', name: 'Meal Prep Ideas', emoji: '🥗', description: 'Weekly meal prep inspo and batch cooking tips',
    category: 'Interest-Based', status: 'Active', memberCount: 198, postCount: 167, pinned: false,
    accessRules: [{ type: 'Interest', label: 'Interest: #mealprep', value: '#mealprep' }],
    moderationQueue: false, whoCanPost: 'Everyone', whoCanReply: 'Everyone',
    allowImages: true, allowVideos: true, allowDocuments: true, allowLinks: true,
    profanityFilter: false, autoFlagKeywords: [],
    notifyOnPost: false, notifyFreq: 'Daily digest',
  },
];

// ─── Members ───────────────────────────────────────────────────────────────────

export const COMMUNITY_MEMBERS: CommunityMember[] = [
  { id: 'mem-1', name: 'Priya Malhotra', email: 'priya@example.com', initials: 'PM', color: 'bg-pink-500', role: 'Member', channels: ['ch-general','ch-pcos','ch-recipes'], totalPosts: 47, totalComments: 122, reactionsGiven: 203, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-11-12', lastActive: '2026-04-24', interestTags: ['#fitness','#mealprep'] },
  { id: 'mem-2', name: 'Aarav Gupta', email: 'aarav@example.com', initials: 'AG', color: 'bg-blue-500', role: 'Member', channels: ['ch-general','ch-weight','ch-fitness'], totalPosts: 31, totalComments: 89, reactionsGiven: 145, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-12-03', lastActive: '2026-04-23', interestTags: ['#fitness'] },
  { id: 'mem-3', name: 'Meera Joshi', email: 'meera@example.com', initials: 'MJ', color: 'bg-violet-500', role: 'Member', channels: ['ch-pcos','ch-general','ch-transform'], totalPosts: 28, totalComments: 71, reactionsGiven: 98, flags: 1, warnings: 0, status: 'Active', joinedDate: '2025-01-15', lastActive: '2026-04-22', interestTags: ['#mealprep'] },
  { id: 'mem-4', name: 'Rahul Sharma', email: 'rahul@example.com', initials: 'RS', color: 'bg-green-600', role: 'Member', channels: ['ch-weight','ch-fitness','ch-mealprep'], totalPosts: 19, totalComments: 54, reactionsGiven: 87, flags: 0, warnings: 1, status: 'Active', joinedDate: '2025-02-20', lastActive: '2026-04-21', interestTags: ['#fitness','#mealprep'] },
  { id: 'mem-5', name: 'Kavya Reddy', email: 'kavya@example.com', initials: 'KR', color: 'bg-amber-500', role: 'Member', channels: ['ch-general','ch-recipes','ch-mealprep'], totalPosts: 52, totalComments: 134, reactionsGiven: 276, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-10-07', lastActive: '2026-04-24', interestTags: ['#mealprep','#recipes'] },
  { id: 'mem-6', name: 'Sunita Reddy', email: 'sunita@example.com', initials: 'SR', color: 'bg-rose-500', role: 'Member', channels: ['ch-general'], totalPosts: 3, totalComments: 12, reactionsGiven: 22, flags: 2, warnings: 1, status: 'Muted', joinedDate: '2025-03-10', lastActive: '2026-04-18', interestTags: [] },
  { id: 'mem-7', name: 'Anita Singh', email: 'anita@example.com', initials: 'AS', color: 'bg-teal-500', role: 'Member', channels: ['ch-pcos','ch-transform','ch-coachqa'], totalPosts: 14, totalComments: 41, reactionsGiven: 63, flags: 0, warnings: 0, status: 'Active', joinedDate: '2025-01-28', lastActive: '2026-04-23', interestTags: ['#fitness'] },
  { id: 'mem-8', name: 'Deepa Rao', email: 'deepa@example.com', initials: 'DR', color: 'bg-orange-500', role: 'Member', channels: ['ch-recipes','ch-mealprep','ch-general'], totalPosts: 38, totalComments: 97, reactionsGiven: 189, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-11-30', lastActive: '2026-04-24', interestTags: ['#mealprep','#recipes'] },
  { id: 'mem-9', name: 'Vikram Nair', email: 'vikram@example.com', initials: 'VN', color: 'bg-indigo-500', role: 'Member', channels: ['ch-fitness','ch-general'], totalPosts: 7, totalComments: 23, reactionsGiven: 34, flags: 1, warnings: 0, status: 'Active', joinedDate: '2025-04-02', lastActive: '2026-04-20', interestTags: ['#fitness'] },
  { id: 'mem-10', name: 'Pooja Iyer', email: 'pooja@example.com', initials: 'PI', color: 'bg-cyan-500', role: 'Member', channels: ['ch-pcos','ch-weight'], totalPosts: 22, totalComments: 58, reactionsGiven: 91, flags: 0, warnings: 0, status: 'Active', joinedDate: '2025-01-05', lastActive: '2026-04-22', interestTags: ['#mealprep'] },
  { id: 'mem-coach', name: 'Dr. Radha Krishnan', email: 'radha@vitale.com', initials: 'RK', color: 'bg-primary', role: 'Coach', channels: ['ch-general','ch-pcos','ch-weight','ch-coachqa','ch-transform','ch-recipes','ch-fitness','ch-mealprep'], totalPosts: 89, totalComments: 312, reactionsGiven: 445, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-08-01', lastActive: '2026-04-24', interestTags: [] },
  { id: 'mem-admin', name: 'Admin', email: 'admin@vitale.com', initials: 'AD', color: 'bg-red-600', role: 'Admin', channels: ['ch-general','ch-pcos','ch-weight','ch-coachqa','ch-transform','ch-recipes','ch-fitness','ch-mealprep'], totalPosts: 24, totalComments: 67, reactionsGiven: 198, flags: 0, warnings: 0, status: 'Active', joinedDate: '2024-07-15', lastActive: '2026-04-24', interestTags: [] },
];

// ─── Posts ─────────────────────────────────────────────────────────────────────

function makeComment(id: string, authorIdx: number, content: string, ts: string): PostComment {
  const m = COMMUNITY_MEMBERS[authorIdx];
  return {
    id, authorId: m.id, authorName: m.name, authorInitials: m.initials, authorColor: m.color,
    authorRole: m.role, content, timestamp: ts,
    reactions: [{ emoji: '👍', count: Math.floor(Math.random() * 8) + 1 }],
  };
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  // ── General Discussion
  {
    id: 'p-gen-1', channelId: 'ch-general', authorId: 'mem-coach', authorName: 'Dr. Radha Krishnan',
    authorInitials: 'RK', authorColor: 'bg-primary', authorRole: 'Coach',
    content: `🌟 Welcome to the Vitalé community! This is your safe space to share, connect, and grow together. Remember: every small step counts on your wellness journey. Feel free to introduce yourself below! 👇`,
    reactions: [{ emoji: '❤️', count: 47 }, { emoji: '👏', count: 31 }, { emoji: '🙌', count: 22 }],
    comments: [
      makeComment('c-gen-1a', 0, 'So excited to be part of this community! 🎉', '2h ago'),
      makeComment('c-gen-1b', 4, 'This is exactly the support system I needed, thank you!', '1h ago'),
    ],
    timestamp: '3 days ago', status: 'Published', pinned: true,
  },
  {
    id: 'p-gen-2', channelId: 'ch-general', authorId: 'mem-1', authorName: 'Priya Malhotra',
    authorInitials: 'PM', authorColor: 'bg-pink-500', authorRole: 'Member',
    content: `Hi everyone! I'm Priya, 32, from Pune 🙏 I've been struggling with PCOS for 4 years and just started my wellness journey with Vitalé 2 months ago. Already feeling so much better. Happy to connect with all of you!`,
    reactions: [{ emoji: '❤️', count: 28 }, { emoji: '👏', count: 19 }],
    comments: [makeComment('c-gen-2a', 10, 'Welcome Priya! Your energy is infectious 🌸', '45m ago')],
    timestamp: '2 days ago', status: 'Published', pinned: false,
  },
  {
    id: 'p-gen-3', channelId: 'ch-general', authorId: 'mem-4', authorName: 'Rahul Sharma',
    authorInitials: 'RS', authorColor: 'bg-green-600', authorRole: 'Member',
    content: `Quick question for everyone — how many of you track your water intake daily? I started using a 1L bottle and refilling it 3x a day and honestly the difference in energy is crazy 💧`,
    reactions: [{ emoji: '👍', count: 34 }, { emoji: '💧', count: 21 }],
    comments: [
      makeComment('c-gen-3a', 1, 'Yes! I use an app to track it. Aim for 3.5L daily 💪', '2h ago'),
      makeComment('c-gen-3b', 7, 'I mark rubber bands on my bottle. Old school but works!', '1h ago'),
    ],
    timestamp: '1 day ago', status: 'Published', pinned: false,
  },
  {
    id: 'p-gen-4', channelId: 'ch-general', authorId: 'mem-6', authorName: 'Sunita Reddy',
    authorInitials: 'SR', authorColor: 'bg-rose-500', authorRole: 'Member',
    content: `Buy my weight loss supplement now!!! 100% guaranteed results in 3 days!!! DM me for special price!!! 🔥🔥`,
    reactions: [],
    comments: [],
    timestamp: '12h ago', status: 'Flagged', pinned: false, flagReason: 'Auto-flagged: keyword', flaggedBy: 'System',
  },

  // ── Recipes
  {
    id: 'p-rec-1', channelId: 'ch-recipes', authorId: 'mem-4', authorName: 'Kavya Reddy',
    authorInitials: 'KR', authorColor: 'bg-amber-500', authorRole: 'Member',
    content: `🍳 Tried Dr. Radha\'s Besan Cheela recipe this morning — added a handful of spinach and grated carrots. GAME CHANGER. So filling and I was not hungry till noon. Here\'s my version:\n\n• 1 cup besan\n• 1/2 cup chopped spinach\n• 1 grated carrot\n• 1 small onion, 1 green chilli\n• Ajwain, salt, turmeric\n• 1 tsp ghee\n\nMix, spread thin on non-stick pan, cook on medium for 3 mins each side. Eat with mint chutney 🤤`,
    reactions: [{ emoji: '❤️', count: 41 }, { emoji: '👏', count: 27 }, { emoji: '😋', count: 18 }],
    comments: [
      makeComment('c-rec-1a', 10, 'Love this variation Kavya! I\'ll add some grated paneer too 🧀', '3h ago'),
      makeComment('c-rec-1b', 2, 'Saving this immediately! Can I use rice flour instead?', '2h ago'),
    ],
    timestamp: '5h ago', status: 'Published', pinned: false,
  },
  {
    id: 'p-rec-2', channelId: 'ch-recipes', authorId: 'mem-coach', authorName: 'Dr. Radha Krishnan',
    authorInitials: 'RK', authorColor: 'bg-primary', authorRole: 'Coach',
    content: `💡 Coach Tip Tuesday:\n\nFor those struggling with mid-morning hunger — here is a 5-minute breakfast that will keep you full until lunch:\n\n🥣 Overnight Oats with Sabja Seeds\n• 1/2 cup rolled oats\n• 1 cup unsweetened almond milk\n• 1 tbsp chia seeds + 1 tsp sabja seeds (soaked)\n• 1 tsp honey\n• Seasonal fruit on top\n\nPrepare the night before. Takes 5 minutes. Protein: 12g. Fibre: 8g. 325 calories.`,
    reactions: [{ emoji: '❤️', count: 58 }, { emoji: '🙏', count: 34 }],
    comments: [makeComment('c-rec-2a', 0, 'Been making this for 3 weeks straight now! So delicious 😍', '6h ago')],
    timestamp: '8h ago', status: 'Published', pinned: true,
  },

  // ── PCOS Support
  {
    id: 'p-pcos-1', channelId: 'ch-pcos', authorId: 'mem-1', authorName: 'Priya Malhotra',
    authorInitials: 'PM', authorColor: 'bg-pink-500', authorRole: 'Member',
    content: `Week 8 update 💜 My cycles have finally started becoming more regular — this is the first time in 3 years I\'ve had back-to-back regular cycles! Dr. Radha\'s anti-inflammatory diet protocol has been a revelation. Cutting out refined sugar was HARD but absolutely worth it.`,
    reactions: [{ emoji: '❤️', count: 34 }, { emoji: '🎉', count: 28 }, { emoji: '👏', count: 21 }],
    comments: [
      makeComment('c-pcos-1a', 10, 'This is HUGE, Priya! So proud of you 🌸 Consistency is key and you\'re proving it!', '4h ago'),
      makeComment('c-pcos-1b', 6, 'This gives me so much hope! How strict are you with the diet?', '2h ago'),
    ],
    timestamp: '6h ago', status: 'Published', pinned: false,
  },
  {
    id: 'p-pcos-2', channelId: 'ch-pcos', authorId: 'mem-coach', authorName: 'Dr. Radha Krishnan',
    authorInitials: 'RK', authorColor: 'bg-primary', authorRole: 'Coach',
    content: `📌 PINNED: PCOS-Friendly Grocery List for this week\n\nGreen light:\n✅ Leafy greens (palak, methi, kale)\n✅ Cruciferous veggies (broccoli, cauliflower)\n✅ Low GI fruits (berries, guava, pear)\n✅ Protein: eggs, chicken, fish, tofu, legumes\n✅ Healthy fats: ghee, nuts, seeds\n\nRed light:\n❌ White rice (switch to millets)\n❌ Maida products\n❌ Sugar & jaggery in large quantities\n❌ Vegetable oils high in omega-6\n\nSave this for your next shopping trip! 🛒`,
    reactions: [{ emoji: '🙏', count: 52 }, { emoji: '❤️', count: 41 }],
    comments: [makeComment('c-pcos-2a', 0, 'Screenshot taken! This is so helpful 📸', '1d ago')],
    timestamp: '1 day ago', status: 'Published', pinned: true,
  },
  {
    id: 'p-pcos-3', channelId: 'ch-pcos', authorId: 'mem-9', authorName: 'Vikram Nair',
    authorInitials: 'VN', authorColor: 'bg-indigo-500', authorRole: 'Member',
    content: `Has anyone tried that keto supplement brand? They\'re claiming it cures PCOS completely in 30 days. Seems too good to be true but sharing the link here...`,
    reactions: [{ emoji: '⚠️', count: 3 }],
    comments: [],
    timestamp: '3h ago', status: 'Pending', pinned: false, flagReason: 'Pending approval', flaggedBy: 'Moderation Queue',
  },

  // ── Weight Loss
  {
    id: 'p-wl-1', channelId: 'ch-weight', authorId: 'mem-2', authorName: 'Aarav Gupta',
    authorInitials: 'AG', authorColor: 'bg-blue-500', authorRole: 'Member',
    content: `🏋️ Weekly check-in: Week 12\nStarting weight: 98 kg\nCurrent weight: 87.5 kg\nTotal lost: 10.5 kg in 12 weeks 🎉\n\nHonestly the biggest change has been cutting liquid calories. No more packaged juices or sodas. Just water, jeera water, and green tea. Ate proper home food every day. That\'s it.`,
    reactions: [{ emoji: '🎉', count: 43 }, { emoji: '💪', count: 38 }, { emoji: '🔥', count: 27 }],
    comments: [
      makeComment('c-wl-1a', 10, 'Incredible transformation Aarav!! 10.5kg is huge 🙌🙌', '2h ago'),
      makeComment('c-wl-1b', 3, 'This motivates me so much! What is your meal plan like?', '1h ago'),
    ],
    timestamp: '4h ago', status: 'Published', pinned: false,
  },
  {
    id: 'p-wl-2', channelId: 'ch-weight', authorId: 'mem-3', authorName: 'Meera Joshi',
    authorInitials: 'MJ', authorColor: 'bg-violet-500', authorRole: 'Member',
    content: `I know the scale hasn\'t moved much this week (only 0.3 kg down) but my jeans that didn\'t fit 2 months ago literally ZIPPED UP today 🙌 Non-scale victories matter!! Don\'t just live by the number!`,
    reactions: [{ emoji: '❤️', count: 56 }, { emoji: '👏', count: 42 }],
    comments: [makeComment('c-wl-2a', 10, 'YES! This is exactly what I\'ve been saying — body recomposition is real! So proud 💪', '3h ago')],
    timestamp: '8h ago', status: 'Published', pinned: false,
  },

  // ── Transformation Stories
  {
    id: 'p-trans-1', channelId: 'ch-transform', authorId: 'mem-0', authorName: 'Deepa Rao',
    authorInitials: 'DR', authorColor: 'bg-orange-500', authorRole: 'Member',
    content: `✨ 6-MONTH TRANSFORMATION ✨\n\nI never thought I\'d be posting something like this but here we are 🥹\n\nMarch 2025: 94 kg, insulin resistant, borderline hypothyroid, chronic fatigue, zero self-confidence\n\nOctober 2025: 78 kg, labs fully normal, energy through the roof, ran my first 5K!\n\nDr. Radha and the Vitalé team literally changed my life. This is not a diet, this is a lifestyle. If you\'re on the fence about starting — JUST DO IT. 💚`,
    reactions: [{ emoji: '❤️', count: 89 }, { emoji: '🎉', count: 67 }, { emoji: '👏', count: 54 }, { emoji: '😭', count: 32 }],
    comments: [
      makeComment('c-trans-1a', 10, 'Deepa this made my day 😭❤️ You worked so hard for every single kilo of this!', '1h ago'),
      makeComment('c-trans-1b', 0, 'I remember you sharing your struggles in Week 2. Look at you now!! 🌟', '45m ago'),
    ],
    timestamp: '1h ago', status: 'Published', pinned: true,
  },
  {
    id: 'p-trans-2', channelId: 'ch-transform', authorId: 'mem-5', authorName: 'Sunita Reddy',
    authorInitials: 'SR', authorColor: 'bg-rose-500', authorRole: 'Member',
    content: `Check out my results after using this external supplement I bought online! Not affiliated with Vitalé at all, just sharing... buy from this link for discount!! 💊💊`,
    reactions: [],
    comments: [],
    timestamp: '5h ago', status: 'Flagged', pinned: false, flagReason: 'User reported', flaggedBy: 'Priya Malhotra',
  },

  // ── Coach Q&A
  {
    id: 'p-qa-1', channelId: 'ch-coachqa', authorId: 'mem-coach', authorName: 'Dr. Radha Krishnan',
    authorInitials: 'RK', authorColor: 'bg-primary', authorRole: 'Coach',
    content: `📣 Q&A Thursday is LIVE!\n\nDrop your nutrition and wellness questions below and I\'ll answer each one throughout the day. No question is too small!\n\nTheme this week: Managing cravings and emotional eating 🧠💚`,
    reactions: [{ emoji: '🙌', count: 67 }, { emoji: '❤️', count: 43 }],
    comments: [
      makeComment('c-qa-1a', 0, 'How do I stop reaching for biscuits when I\'m stressed at work?', '2h ago'),
      makeComment('c-qa-1b', 1, 'Is dark chocolate actually okay or is that a myth?', '2h ago'),
      makeComment('c-qa-1c', 4, 'What\'s the difference between hunger and craving?', '1h ago'),
    ],
    timestamp: '2h ago', status: 'Published', pinned: true,
  },

  // ── Fitness Tips
  {
    id: 'p-fit-1', channelId: 'ch-fitness', authorId: 'mem-2', authorName: 'Aarav Gupta',
    authorInitials: 'AG', authorColor: 'bg-blue-500', authorRole: 'Member',
    content: `💪 5 exercises you can do in 10 minutes AT HOME, no equipment:\n\n1. 30s jumping jacks → 10s rest\n2. 15 squats → 10s rest\n3. 10 push-ups → 10s rest\n4. 20 mountain climbers → 10s rest\n5. 30s plank → done!\n\nDo 2 rounds. That\'s your metabolism kick for the day. No excuses! 🔥`,
    reactions: [{ emoji: '💪', count: 38 }, { emoji: '🔥', count: 29 }],
    comments: [makeComment('c-fit-1a', 3, 'Saved! Perfect for my work from home days 🙏', '1h ago')],
    timestamp: '3h ago', status: 'Published', pinned: false,
  },

  // ── Meal Prep
  {
    id: 'p-mp-1', channelId: 'ch-mealprep', authorId: 'mem-7', authorName: 'Deepa Rao',
    authorInitials: 'DR', authorColor: 'bg-orange-500', authorRole: 'Member',
    content: `🥗 Sunday Meal Prep — what I batch cooked today:\n\n✅ 2 cups rajma (cooked with onion-tomato base)\n✅ 500g chicken breast (marinated and grilled)\n✅ 1 big pot of brown rice + millets\n✅ Roasted veggies: broccoli, bell peppers, zucchini\n✅ 6 hard boiled eggs\n✅ Overnight oats for 3 days\n\nTotal time: 2 hours. Meals sorted for 4 days. THIS is how you stay consistent when weekdays get hectic 💪`,
    reactions: [{ emoji: '👏', count: 52 }, { emoji: '🙌', count: 38 }],
    comments: [
      makeComment('c-mp-1a', 4, 'This is inspiring! Could you share how you store everything?', '2h ago'),
      makeComment('c-mp-1b', 0, 'Your prep game is serious! I need to learn from you 🙏', '1h ago'),
    ],
    timestamp: '6h ago', status: 'Published', pinned: false,
  },
];

// ─── Moderation Queue ──────────────────────────────────────────────────────────

export const MODERATION_QUEUE: ModerationItem[] = [
  {
    id: 'mod-1', postId: 'p-gen-4', postContent: 'Buy my weight loss supplement now!!! 100% guaranteed results in 3 days!!! DM me for special price!!! 🔥🔥',
    authorName: 'Sunita Reddy', authorInitials: 'SR', authorColor: 'bg-rose-500', authorRole: 'Member',
    channelId: 'ch-general', channelName: 'General Discussion',
    flagReason: 'Auto-flagged: keyword', timestamp: '12h ago', status: 'Pending',
  },
  {
    id: 'mod-2', postId: 'p-pcos-3', postContent: 'Has anyone tried that keto supplement brand? They\'re claiming it cures PCOS completely in 30 days. Seems too good to be true...',
    authorName: 'Vikram Nair', authorInitials: 'VN', authorColor: 'bg-indigo-500', authorRole: 'Member',
    channelId: 'ch-pcos', channelName: 'PCOS Support Group',
    flagReason: 'Pending approval', timestamp: '3h ago', status: 'Pending',
  },
  {
    id: 'mod-3', postId: 'p-trans-2', postContent: 'Check out my results after using this external supplement I bought online! Not affiliated with Vitalé at all, just sharing... buy from this link for discount!! 💊💊',
    authorName: 'Sunita Reddy', authorInitials: 'SR', authorColor: 'bg-rose-500', authorRole: 'Member',
    channelId: 'ch-transform', channelName: 'Transformation Stories',
    flagReason: 'User reported', flaggedBy: 'Priya Malhotra', timestamp: '5h ago', status: 'Pending',
  },
];

// ─── Moderation Log ────────────────────────────────────────────────────────────

export const MODERATION_LOG: ModerationLogItem[] = [
  { id: 'log-1', date: '2026-04-20 14:32', moderator: 'Admin', action: 'Removed', target: 'Post by Arun Kumar', channel: 'General Discussion', reason: 'Spam' },
  { id: 'log-2', date: '2026-04-18 09:15', moderator: 'Dr. Radha Krishnan', action: 'Approved', target: 'Post by Meera Joshi', channel: 'PCOS Support Group', reason: 'Reviewed and approved' },
  { id: 'log-3', date: '2026-04-17 16:45', moderator: 'Admin', action: 'Muted', target: 'Sunita Reddy', channel: 'All Channels', reason: 'Repeated spam violations' },
  { id: 'log-4', date: '2026-04-15 11:20', moderator: 'Admin', action: 'Warned', target: 'Vikram Nair', channel: 'PCOS Support Group', reason: 'Sharing unverified health claims' },
  { id: 'log-5', date: '2026-04-12 08:55', moderator: 'Dr. Radha Krishnan', action: 'Removed', target: 'Post by Unknown User', channel: 'Weight Loss Warriors', reason: 'Inappropriate' },
  { id: 'log-6', date: '2026-04-10 17:30', moderator: 'Admin', action: 'Approved', target: 'Post by Anita Singh', channel: 'Transformation Stories', reason: 'Content review passed' },
  { id: 'log-7', date: '2026-04-08 10:12', moderator: 'Admin', action: 'Banned', target: 'Spam Account #45', channel: 'General Discussion', reason: 'Coordinated spam / bot account' },
];

// ─── Interest Tags ─────────────────────────────────────────────────────────────

export const INTEREST_TAGS: InterestTag[] = [
  { id: 'tag-1', name: '#fitness',   emoji: '💪', description: 'Workout, exercise, and fitness content', usageCount: 145 },
  { id: 'tag-2', name: '#mealprep',  emoji: '🥗', description: 'Batch cooking and meal preparation tips', usageCount: 198 },
  { id: 'tag-3', name: '#recipes',   emoji: '🍽️', description: 'Healthy recipe ideas and cooking', usageCount: 173 },
  { id: 'tag-4', name: '#pcos',      emoji: '💜', description: 'PCOS support and management', usageCount: 67 },
  { id: 'tag-5', name: '#weightloss',emoji: '⚖️', description: 'Weight loss journey and tips', usageCount: 112 },
  { id: 'tag-6', name: '#mindset',   emoji: '🧠', description: 'Mental wellness and mindset', usageCount: 89 },
  { id: 'tag-7', name: '#yoga',      emoji: '🧘', description: 'Yoga and breathwork practices', usageCount: 54 },
  { id: 'tag-8', name: '#diabetes',  emoji: '🩺', description: 'Diabetes and blood sugar management', usageCount: 43 },
];

// ─── Engagement data (30 days) ─────────────────────────────────────────────────

export const ENGAGEMENT_DATA: EngagementDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-03-26');
  d.setDate(d.getDate() + i);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return {
    date,
    posts: 15 + Math.floor(Math.sin(i / 4) * 10 + Math.random() * 12),
    comments: 38 + Math.floor(Math.cos(i / 3) * 15 + Math.random() * 20),
    newMembers: Math.max(0, 3 + Math.floor(Math.random() * 8 - 2)),
  };
});

export const COMMUNITY_STATS = {
  totalChannels: CHANNELS.length,
  activeChannels: CHANNELS.filter(c => c.status === 'Active').length,
  archivedChannels: CHANNELS.filter(c => c.status === 'Archived').length,
  totalMembers: 342,
  activeThisWeek: 187,
  postsToday: 23,
  postsTrend: +4,
  flaggedContent: MODERATION_QUEUE.filter(m => m.status === 'Pending').length,
  totalPosts: CHANNELS.reduce((a, c) => a + c.postCount, 0),
};
