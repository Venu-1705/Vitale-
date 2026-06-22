export interface Badge {
  id: string;
  name: string;
  icon: string;
  criteria: string;
  points: number;
  earnedCount: number;
  autoAward: boolean;
  locked?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  clientId: string;
  name: string;
  initials: string;
  color: string;
  points: number;
  streak: number;
  badges: string[];
  trend: 'up' | 'down' | 'same';
  dietAdherence: number;
  courseCompletion: number;
  recipiesTried: number;
  challenges: number;
  streakBonus: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  duration: 7 | 14 | 21 | 30;
  type: 'habit' | 'submission';
  pointMultiplier: number;
  participants: number;
  daysRemaining: number;
  prize: string;
  requirements: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Upcoming' | 'Ended';
  participantProgress: { name: string; initials: string; color: string; progress: number }[];
}

export const ALL_BADGES: Badge[] = [
  { id: 'b-1', name: '7-Day Streak', icon: '🔥', criteria: 'Complete 7 consecutive daily check-ins', points: 50, earnedCount: 38, autoAward: true },
  { id: 'b-2', name: '30-Day Warrior', icon: '⚔️', criteria: 'Complete 30 consecutive daily check-ins', points: 200, earnedCount: 12, autoAward: true },
  { id: 'b-3', name: 'Recipe Explorer', icon: '🍳', criteria: 'Try 10 different recipes from the library', points: 75, earnedCount: 24, autoAward: true },
  { id: 'b-4', name: 'Perfect Week', icon: '⭐', criteria: '100% diet adherence for 7 days straight', points: 100, earnedCount: 18, autoAward: true },
  { id: 'b-5', name: 'Transformation Star', icon: '🌟', criteria: 'Achieve 50% of target weight goal', points: 300, earnedCount: 8, autoAward: true },
  { id: 'b-6', name: 'Community Champion', icon: '🏆', criteria: 'Post 20 helpful replies in the community', points: 150, earnedCount: 5, autoAward: false },
  { id: 'b-7', name: 'Early Bird', icon: '🌅', criteria: 'Log breakfast before 8 AM for 7 days', points: 60, earnedCount: 22, autoAward: true },
  { id: 'b-8', name: 'Hydration Hero', icon: '💧', criteria: 'Log 3L water daily for 14 days', points: 80, earnedCount: 15, autoAward: true },
  { id: 'b-9', name: 'Goal Crusher', icon: '💪', criteria: 'Complete all weekly goals for 4 weeks', points: 250, earnedCount: 6, autoAward: true },
  { id: 'b-10', name: 'First Steps', icon: '👟', criteria: 'Complete first week of any program', points: 25, earnedCount: 120, autoAward: true },
  { id: 'b-11', name: 'Recipe Creator', icon: '👨‍🍳', criteria: 'Submit a custom recipe that gets approved', points: 100, earnedCount: 3, autoAward: false },
  { id: 'b-12', name: 'Mindful Eater', icon: '🧘', criteria: 'Complete 21 days of mindful eating journal', points: 175, earnedCount: 4, autoAward: true, locked: true },
];

export const LEADERBOARD_WEEKLY: LeaderboardEntry[] = [
  { rank: 1, clientId: 'c-011', name: 'Rohan Gupta', initials: 'RG', color: 'bg-cyan-500', points: 850, streak: 22, badges: ['b-1', 'b-4', 'b-10'], trend: 'up', dietAdherence: 350, courseCompletion: 200, recipiesTried: 100, challenges: 150, streakBonus: 50 },
  { rank: 2, clientId: 'c-002', name: 'Priya Sharma', initials: 'PS', color: 'bg-pink-500', points: 820, streak: 18, badges: ['b-1', 'b-3', 'b-10'], trend: 'up', dietAdherence: 320, courseCompletion: 200, recipiesTried: 150, challenges: 100, streakBonus: 50 },
  { rank: 3, clientId: 'c-007', name: 'Kartik Joshi', initials: 'KJ', color: 'bg-red-500', points: 780, streak: 15, badges: ['b-1', 'b-10'], trend: 'same', dietAdherence: 300, courseCompletion: 180, recipiesTried: 100, challenges: 150, streakBonus: 50 },
  { rank: 4, clientId: 'c-019', name: 'Nikhil Sharma', initials: 'NS', color: 'bg-blue-600', points: 745, streak: 14, badges: ['b-1', 'b-8'], trend: 'up', dietAdherence: 280, courseCompletion: 200, recipiesTried: 80, challenges: 135, streakBonus: 50 },
  { rank: 5, clientId: 'c-016', name: 'Pooja Menon', initials: 'PM', color: 'bg-emerald-500', points: 710, streak: 12, badges: ['b-4', 'b-10'], trend: 'up', dietAdherence: 310, courseCompletion: 150, recipiesTried: 120, challenges: 80, streakBonus: 50 },
  { rank: 6, clientId: 'c-001', name: 'Arjun Mehta', initials: 'AM', color: 'bg-blue-500', points: 680, streak: 10, badges: ['b-1'], trend: 'down', dietAdherence: 260, courseCompletion: 200, recipiesTried: 80, challenges: 100, streakBonus: 40 },
  { rank: 7, clientId: 'c-004', name: 'Anjali Singh', initials: 'AS', color: 'bg-purple-500', points: 655, streak: 9, badges: ['b-3', 'b-10'], trend: 'up', dietAdherence: 280, courseCompletion: 150, recipiesTried: 100, challenges: 85, streakBonus: 40 },
  { rank: 8, clientId: 'c-008', name: 'Meera Pillai', initials: 'MP', color: 'bg-indigo-500', points: 620, streak: 8, badges: ['b-10'], trend: 'same', dietAdherence: 250, courseCompletion: 180, recipiesTried: 80, challenges: 70, streakBonus: 40 },
  { rank: 9, clientId: 'c-012', name: 'Kavitha Nambiar', initials: 'KN', color: 'bg-fuchsia-500', points: 595, streak: 7, badges: ['b-1', 'b-10'], trend: 'up', dietAdherence: 245, courseCompletion: 160, recipiesTried: 90, challenges: 60, streakBonus: 40 },
  { rank: 10, clientId: 'c-014', name: 'Ananya Chatterjee', initials: 'AC', color: 'bg-violet-500', points: 570, streak: 7, badges: ['b-10'], trend: 'up', dietAdherence: 240, courseCompletion: 150, recipiesTried: 80, challenges: 60, streakBonus: 40 },
  { rank: 11, clientId: 'c-005', name: 'Vikram Nair', initials: 'VN', color: 'bg-orange-500', points: 540, streak: 6, badges: ['b-10'], trend: 'down', dietAdherence: 220, courseCompletion: 160, recipiesTried: 60, challenges: 60, streakBonus: 40 },
  { rank: 12, clientId: 'c-017', name: 'Aarav Desai', initials: 'AD', color: 'bg-sky-500', points: 510, streak: 5, badges: ['b-10'], trend: 'up', dietAdherence: 200, courseCompletion: 150, recipiesTried: 60, challenges: 60, streakBonus: 40 },
  { rank: 13, clientId: 'c-020', name: 'Geeta Krishnamurthy', initials: 'GK', color: 'bg-teal-600', points: 480, streak: 5, badges: ['b-10'], trend: 'same', dietAdherence: 190, courseCompletion: 140, recipiesTried: 60, challenges: 50, streakBonus: 40 },
  { rank: 14, clientId: 'c-003', name: 'Rahul Verma', initials: 'RV', color: 'bg-green-500', points: 450, streak: 4, badges: ['b-10'], trend: 'down', dietAdherence: 180, courseCompletion: 150, recipiesTried: 60, challenges: 40, streakBonus: 20 },
  { rank: 15, clientId: 'c-009', name: 'Deepak Agarwal', initials: 'DA', color: 'bg-yellow-600', points: 380, streak: 3, badges: ['b-10'], trend: 'up', dietAdherence: 160, courseCompletion: 100, recipiesTried: 40, challenges: 60, streakBonus: 20 },
  { rank: 16, clientId: 'c-006', name: 'Sunita Reddy', initials: 'SR', color: 'bg-teal-500', points: 340, streak: 2, badges: [], trend: 'down', dietAdherence: 150, courseCompletion: 80, recipiesTried: 60, challenges: 30, streakBonus: 20 },
  { rank: 17, clientId: 'c-010', name: 'Lakshmi Rao', initials: 'LR', color: 'bg-rose-500', points: 310, streak: 2, badges: ['b-10'], trend: 'same', dietAdherence: 140, courseCompletion: 80, recipiesTried: 50, challenges: 20, streakBonus: 20 },
];

export const CHALLENGES: Challenge[] = [
  {
    id: 'ch-1', title: '7-Day Sugar Detox Challenge', description: 'Eliminate all refined sugar for 7 days. Log your meals daily and share your experience in the community.',
    duration: 7, type: 'submission', pointMultiplier: 2, participants: 45, daysRemaining: 3,
    prize: '500 bonus points + Transformation Star badge', requirements: 'Submit daily meal photos or logs',
    startDate: 'Apr 18, 2026', endDate: 'Apr 24, 2026', status: 'Active',
    participantProgress: [
      { name: 'Rohan Gupta', initials: 'RG', color: 'bg-cyan-500', progress: 85 },
      { name: 'Priya Sharma', initials: 'PS', color: 'bg-pink-500', progress: 100 },
      { name: 'Anjali Singh', initials: 'AS', color: 'bg-purple-500', progress: 71 },
      { name: 'Pooja Menon', initials: 'PM', color: 'bg-emerald-500', progress: 100 },
    ],
  },
  {
    id: 'ch-2', title: '30-Day Movement Challenge', description: 'Move your body for at least 30 minutes every day for 30 days. Any activity counts — walking, yoga, dance, gym!',
    duration: 30, type: 'habit', pointMultiplier: 1.5, participants: 78, daysRemaining: 18,
    prize: '1000 bonus points + 30-Day Warrior badge', requirements: 'Log daily activity type and duration',
    startDate: 'Apr 7, 2026', endDate: 'May 6, 2026', status: 'Active',
    participantProgress: [
      { name: 'Kartik Joshi', initials: 'KJ', color: 'bg-red-500', progress: 40 },
      { name: 'Nikhil Sharma', initials: 'NS', color: 'bg-blue-600', progress: 40 },
      { name: 'Arjun Mehta', initials: 'AM', color: 'bg-blue-500', progress: 40 },
    ],
  },
  {
    id: 'ch-3', title: 'Hydration Hero Challenge', description: 'Drink 3 liters of water every day for 14 days. Log your water intake using the tracker.',
    duration: 14, type: 'habit', pointMultiplier: 1.5, participants: 62, daysRemaining: 8,
    prize: '400 bonus points + Hydration Hero badge', requirements: 'Log daily water intake (minimum 3L)',
    startDate: 'Apr 10, 2026', endDate: 'Apr 23, 2026', status: 'Active',
    participantProgress: [
      { name: 'Kavitha Nambiar', initials: 'KN', color: 'bg-fuchsia-500', progress: 42 },
      { name: 'Meera Pillai', initials: 'MP', color: 'bg-indigo-500', progress: 42 },
    ],
  },
];
