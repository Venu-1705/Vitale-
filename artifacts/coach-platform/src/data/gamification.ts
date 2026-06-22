export type XPActionStatus = 'Active' | 'Inactive';
export type BadgeStatus = 'Active' | 'Inactive';
export type BadgeTrigger =
  | 'First meal logged'
  | 'Streak reached'
  | 'All meals logged for N days'
  | 'Recipe shared'
  | 'Post likes received'
  | 'Friends added'
  | 'League promoted'
  | 'Habit completed'
  | 'Health metric logged'
  | 'Week completed';

export interface XPAction {
  id: string;
  action: string;
  xp: number;
  isBonus: boolean;
  status: XPActionStatus;
  category: 'Nutrition' | 'Habit' | 'Social' | 'Health' | 'Streak';
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  criteria: string;
  trigger: BadgeTrigger;
  threshold: number;
  earnedBy: number;
  status: BadgeStatus;
  xpReward: number;
  color: string;
}

export interface LeagueTier {
  id: string;
  rank: number;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  promotionThreshold: string;
  demotionThreshold: string;
  userCount: number;
  userPct: number;
}

export interface StreakConfig {
  mealsRequired: number;
  mealsTotal: number;
  skipDayInterval: number;
  maxSkipTokens: number;
  resetHour: string;
}

export const XP_ACTIONS: XPAction[] = [
  { id: 'xp1',  action: 'Followed planned meal',        xp: 10, isBonus: false, status: 'Active',   category: 'Nutrition' },
  { id: 'xp2',  action: 'Logged alternative meal',      xp: 5,  isBonus: false, status: 'Active',   category: 'Nutrition' },
  { id: 'xp3',  action: 'Logged all meals in a day',    xp: 15, isBonus: true,  status: 'Active',   category: 'Nutrition' },
  { id: 'xp4',  action: 'Completed a habit',            xp: 3,  isBonus: false, status: 'Active',   category: 'Habit'     },
  { id: 'xp5',  action: 'Shared a recipe',              xp: 10, isBonus: false, status: 'Active',   category: 'Social'    },
  { id: 'xp6',  action: 'Liked or commented on a post', xp: 2,  isBonus: false, status: 'Active',   category: 'Social'    },
  { id: 'xp7',  action: 'Completed a week of logging',  xp: 50, isBonus: true,  status: 'Active',   category: 'Streak'    },
  { id: 'xp8',  action: 'Logged any health metric',     xp: 3,  isBonus: false, status: 'Active',   category: 'Health'    },
  { id: 'xp9',  action: 'Joined a community post',      xp: 2,  isBonus: false, status: 'Inactive', category: 'Social'    },
  { id: 'xp10', action: 'Completed a program module',   xp: 25, isBonus: true,  status: 'Active',   category: 'Habit'     },
  { id: 'xp11', action: 'Logged water intake goal',     xp: 2,  isBonus: false, status: 'Active',   category: 'Health'    },
  { id: 'xp12', action: 'Completed symptom log',        xp: 3,  isBonus: false, status: 'Active',   category: 'Health'    },
];

export const BADGES: Badge[] = [
  { id: 'b1',  emoji: '🍽️', name: 'First Meal',       description: 'Logged your very first meal on Vitalé', criteria: 'Log your first meal',            trigger: 'First meal logged',          threshold: 1,  earnedBy: 1287, status: 'Active',   xpReward: 20,  color: 'text-green-600'  },
  { id: 'b2',  emoji: '🔥', name: '3-Day Streak',     description: 'Maintained a 3-day logging streak',    criteria: 'Maintain a 3-day streak',         trigger: 'Streak reached',             threshold: 3,  earnedBy: 678,  status: 'Active',   xpReward: 15,  color: 'text-orange-500' },
  { id: 'b3',  emoji: '⚡', name: '7-Day Streak',     description: 'One full week of consistent logging',  criteria: 'Maintain a 7-day streak',         trigger: 'Streak reached',             threshold: 7,  earnedBy: 312,  status: 'Active',   xpReward: 30,  color: 'text-yellow-500' },
  { id: 'b4',  emoji: '💫', name: '30-Day Streak',    description: 'A full month of dedication',           criteria: 'Maintain a 30-day streak',        trigger: 'Streak reached',             threshold: 30, earnedBy: 67,   status: 'Active',   xpReward: 100, color: 'text-purple-600' },
  { id: 'b5',  emoji: '✨', name: 'Perfect Week',     description: 'Logged all meals for 7 consecutive days', criteria: 'Log all meals for 7 days',    trigger: 'All meals logged for N days', threshold: 7,  earnedBy: 134,  status: 'Active',   xpReward: 50,  color: 'text-primary'    },
  { id: 'b6',  emoji: '👨‍🍳', name: 'Recipe Chef',    description: 'Shared your first recipe with the community', criteria: 'Share your first recipe',   trigger: 'Recipe shared',              threshold: 1,  earnedBy: 234,  status: 'Active',   xpReward: 25,  color: 'text-amber-600'  },
  { id: 'b7',  emoji: '⭐', name: 'Community Star',  description: 'Received 10 likes on a single post',   criteria: 'Get 10 likes on a post',          trigger: 'Post likes received',        threshold: 10, earnedBy: 89,   status: 'Active',   xpReward: 20,  color: 'text-yellow-600' },
  { id: 'b8',  emoji: '🦋', name: 'Social Butterfly', description: 'Connected with 5 friends on the platform', criteria: 'Add 5 friends',             trigger: 'Friends added',              threshold: 5,  earnedBy: 145,  status: 'Active',   xpReward: 15,  color: 'text-pink-600'   },
  { id: 'b9',  emoji: '🏆', name: 'League Climber',  description: 'Got promoted to a higher league tier', criteria: 'Get promoted to a new tier',      trigger: 'League promoted',            threshold: 1,  earnedBy: 287,  status: 'Active',   xpReward: 40,  color: 'text-blue-600'   },
  { id: 'b10', emoji: '🎯', name: 'Habit Hero',      description: 'Completed 30 habits in a single month', criteria: 'Complete 30 habits',            trigger: 'Habit completed',            threshold: 30, earnedBy: 56,   status: 'Active',   xpReward: 35,  color: 'text-teal-600'   },
  { id: 'b11', emoji: '💧', name: 'Hydration King',  description: 'Hit your water goal 7 days in a row',  criteria: 'Log water goal for 7 days',       trigger: 'Health metric logged',       threshold: 7,  earnedBy: 112,  status: 'Active',   xpReward: 20,  color: 'text-cyan-600'   },
  { id: 'b12', emoji: '🌟', name: 'Century Logger',  description: 'Logged 100 meals on the platform',     criteria: 'Log 100 total meals',             trigger: 'First meal logged',          threshold: 100, earnedBy: 198, status: 'Inactive', xpReward: 75,  color: 'text-indigo-600' },
];

export const LEAGUE_TIERS: LeagueTier[] = [
  { id: 'l1', rank: 1, name: 'Bronze',   icon: '🥉', color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200', promotionThreshold: '—',     demotionThreshold: '—',      userCount: 623, userPct: 43 },
  { id: 'l2', rank: 2, name: 'Silver',   icon: '🥈', color: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200', promotionThreshold: 'Top 20%', demotionThreshold: 'Bottom 20%', userCount: 418, userPct: 29 },
  { id: 'l3', rank: 3, name: 'Gold',     icon: '🥇', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', promotionThreshold: 'Top 20%', demotionThreshold: 'Bottom 20%', userCount: 231, userPct: 16 },
  { id: 'l4', rank: 4, name: 'Platinum', icon: '💠', color: 'text-cyan-600',   bgColor: 'bg-cyan-50',   borderColor: 'border-cyan-200',  promotionThreshold: 'Top 10%', demotionThreshold: 'Bottom 10%', userCount: 120, userPct: 8  },
  { id: 'l5', rank: 5, name: 'Diamond',  icon: '💎', color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200',  promotionThreshold: 'Top 5%',  demotionThreshold: 'Bottom 10%', userCount: 58,  userPct: 4  },
];

export const DEFAULT_STREAK_CONFIG: StreakConfig = {
  mealsRequired: 2,
  mealsTotal: 3,
  skipDayInterval: 7,
  maxSkipTokens: 1,
  resetHour: '00:00',
};

export const STREAK_DISTRIBUTION = [
  { range: '0 days',    count: 234, pct: 16 },
  { range: '1–3 days',  count: 312, pct: 22 },
  { range: '4–7 days',  count: 287, pct: 20 },
  { range: '8–14 days', count: 198, pct: 14 },
  { range: '15–30 days',count: 167, pct: 12 },
  { range: '31–60 days',count: 134, pct: 9  },
  { range: '60+ days',  count: 118, pct: 8  },
];

export const CATEGORY_CONFIG: Record<XPAction['category'], { color: string; bg: string }> = {
  Nutrition: { color: 'text-green-700',  bg: 'bg-green-100'  },
  Habit:     { color: 'text-purple-700', bg: 'bg-purple-100' },
  Social:    { color: 'text-blue-700',   bg: 'bg-blue-100'   },
  Health:    { color: 'text-red-700',    bg: 'bg-red-100'    },
  Streak:    { color: 'text-orange-700', bg: 'bg-orange-100' },
};

export const TRIGGER_OPTIONS: BadgeTrigger[] = [
  'First meal logged',
  'Streak reached',
  'All meals logged for N days',
  'Recipe shared',
  'Post likes received',
  'Friends added',
  'League promoted',
  'Habit completed',
  'Health metric logged',
  'Week completed',
];
