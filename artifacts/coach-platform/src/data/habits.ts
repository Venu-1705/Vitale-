export type HabitCategory = 'Exercise' | 'Hydration' | 'Diet' | 'Mindfulness' | 'Sleep' | 'Custom';
export type HabitFrequency = 'Daily' | 'Weekdays only' | '3x per week' | 'Weekly';

export interface HabitClientStat {
  clientId: string;
  clientName: string;
  avatar: string;
  daysCompleted: number;
  totalDays: number;
  currentStreak: number;
  lastCompleted: string;
}

export interface HabitDayStat {
  date: string;
  pct: number;
}

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  description: string;
  frequency: HabitFrequency;
  suggestedTime: string;
  assignedTo: string[];         // program names
  assignedClients: string[];    // client IDs
  completionRate: number;       // aggregate %
  enabled: boolean;
  order: number;
  createdAt: string;
  clientStats: HabitClientStat[];
  dailyStats: HabitDayStat[];
}

// 30 day daily stats generator
function makeDailyStats(base: number, variance: number): HabitDayStat[] {
  const out: HabitDayStat[] = [];
  const now = new Date('2026-05-06');
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const pct = Math.min(100, Math.max(0, Math.round(base + (Math.random() * variance * 2 - variance))));
    out.push({ date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), pct });
  }
  return out;
}

export const HABITS: Habit[] = [
  {
    id: 'h1',
    name: 'Morning Walk (30 min)',
    category: 'Exercise',
    description: 'A brisk 30-minute walk first thing in the morning to boost metabolism and energy levels throughout the day.',
    frequency: 'Daily',
    suggestedTime: '7:00 AM',
    assignedTo: ['PCOS Reversal Program', 'Weight Management'],
    assignedClients: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    completionRate: 74,
    enabled: true,
    order: 1,
    createdAt: '2026-03-01',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 26, totalDays: 30, currentStreak: 12, lastCompleted: 'Today' },
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 28, totalDays: 30, currentStreak: 14, lastCompleted: 'Today' },
      { clientId: 'c3', clientName: 'Meera Nair',      avatar: 'MN', daysCompleted: 8,  totalDays: 30, currentStreak: 2,  lastCompleted: '3 days ago' },
      { clientId: 'c4', clientName: 'Rohit Verma',     avatar: 'RV', daysCompleted: 22, totalDays: 30, currentStreak: 9,  lastCompleted: 'Yesterday' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 29, totalDays: 30, currentStreak: 20, lastCompleted: 'Today' },
      { clientId: 'c6', clientName: 'Deepak Singh',    avatar: 'DS', daysCompleted: 7,  totalDays: 30, currentStreak: 1,  lastCompleted: '5 days ago' },
    ],
    dailyStats: makeDailyStats(72, 18),
  },
  {
    id: 'h2',
    name: 'Drink 8 Glasses of Water',
    category: 'Hydration',
    description: 'Track and drink at least 2 litres of water spread across the day. Use a marked bottle to stay on track.',
    frequency: 'Daily',
    suggestedTime: 'Throughout day',
    assignedTo: ['PCOS Reversal Program', 'Weight Management', 'Gut Health Reset'],
    assignedClients: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
    completionRate: 82,
    enabled: true,
    order: 2,
    createdAt: '2026-03-01',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 27, totalDays: 30, currentStreak: 15, lastCompleted: 'Today' },
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 30, totalDays: 30, currentStreak: 30, lastCompleted: 'Today' },
      { clientId: 'c3', clientName: 'Meera Nair',      avatar: 'MN', daysCompleted: 20, totalDays: 30, currentStreak: 5,  lastCompleted: 'Today' },
      { clientId: 'c4', clientName: 'Rohit Verma',     avatar: 'RV', daysCompleted: 25, totalDays: 30, currentStreak: 11, lastCompleted: 'Yesterday' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 28, totalDays: 30, currentStreak: 18, lastCompleted: 'Today' },
      { clientId: 'c6', clientName: 'Deepak Singh',    avatar: 'DS', daysCompleted: 9,  totalDays: 30, currentStreak: 2,  lastCompleted: '2 days ago' },
      { clientId: 'c7', clientName: 'Sunita Rao',      avatar: 'SR', daysCompleted: 26, totalDays: 30, currentStreak: 8,  lastCompleted: 'Today' },
    ],
    dailyStats: makeDailyStats(80, 12),
  },
  {
    id: 'h3',
    name: 'No Sugar After 6 PM',
    category: 'Diet',
    description: 'Avoid all refined sugars and sweets after 6 PM to improve insulin sensitivity and sleep quality.',
    frequency: 'Daily',
    suggestedTime: '6:00 PM',
    assignedTo: ['PCOS Reversal Program'],
    assignedClients: ['c1', 'c3', 'c5'],
    completionRate: 61,
    enabled: true,
    order: 3,
    createdAt: '2026-03-15',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 21, totalDays: 30, currentStreak: 7,  lastCompleted: 'Today' },
      { clientId: 'c3', clientName: 'Meera Nair',      avatar: 'MN', daysCompleted: 7,  totalDays: 30, currentStreak: 0,  lastCompleted: '8 days ago' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 26, totalDays: 30, currentStreak: 14, lastCompleted: 'Today' },
    ],
    dailyStats: makeDailyStats(60, 22),
  },
  {
    id: 'h4',
    name: '10-min Guided Meditation',
    category: 'Mindfulness',
    description: 'Use the Vitalé app guided meditation or any preferred app for 10 minutes of mindfulness practice.',
    frequency: 'Daily',
    suggestedTime: '9:00 PM',
    assignedTo: ['PCOS Reversal Program', 'Stress & Cortisol Balance'],
    assignedClients: ['c1', 'c2', 'c5', 'c7'],
    completionRate: 55,
    enabled: true,
    order: 4,
    createdAt: '2026-04-01',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 18, totalDays: 30, currentStreak: 5,  lastCompleted: 'Today' },
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 14, totalDays: 30, currentStreak: 3,  lastCompleted: '2 days ago' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 22, totalDays: 30, currentStreak: 10, lastCompleted: 'Today' },
      { clientId: 'c7', clientName: 'Sunita Rao',      avatar: 'SR', daysCompleted: 8,  totalDays: 30, currentStreak: 1,  lastCompleted: '4 days ago' },
    ],
    dailyStats: makeDailyStats(54, 20),
  },
  {
    id: 'h5',
    name: 'Sleep by 10:30 PM',
    category: 'Sleep',
    description: 'Wind down by 10 PM and aim to be asleep by 10:30 PM to support hormonal regulation and recovery.',
    frequency: 'Weekdays only',
    suggestedTime: '10:30 PM',
    assignedTo: ['PCOS Reversal Program', 'Stress & Cortisol Balance'],
    assignedClients: ['c1', 'c3', 'c5', 'c7'],
    completionRate: 49,
    enabled: true,
    order: 5,
    createdAt: '2026-04-01',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 16, totalDays: 22, currentStreak: 4,  lastCompleted: 'Today' },
      { clientId: 'c3', clientName: 'Meera Nair',      avatar: 'MN', daysCompleted: 6,  totalDays: 22, currentStreak: 0,  lastCompleted: '9 days ago' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 19, totalDays: 22, currentStreak: 12, lastCompleted: 'Today' },
      { clientId: 'c7', clientName: 'Sunita Rao',      avatar: 'SR', daysCompleted: 8,  totalDays: 22, currentStreak: 2,  lastCompleted: 'Yesterday' },
    ],
    dailyStats: makeDailyStats(48, 24),
  },
  {
    id: 'h6',
    name: 'Log Meals in App',
    category: 'Diet',
    description: 'Log all meals (breakfast, lunch, dinner, snacks) in the Vitalé app by end of day.',
    frequency: 'Daily',
    suggestedTime: '9:00 PM',
    assignedTo: ['Weight Management', 'Gut Health Reset'],
    assignedClients: ['c2', 'c4', 'c6'],
    completionRate: 77,
    enabled: true,
    order: 6,
    createdAt: '2026-02-15',
    clientStats: [
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 28, totalDays: 30, currentStreak: 16, lastCompleted: 'Today' },
      { clientId: 'c4', clientName: 'Rohit Verma',     avatar: 'RV', daysCompleted: 23, totalDays: 30, currentStreak: 8,  lastCompleted: 'Yesterday' },
      { clientId: 'c6', clientName: 'Deepak Singh',    avatar: 'DS', daysCompleted: 10, totalDays: 30, currentStreak: 2,  lastCompleted: '2 days ago' },
    ],
    dailyStats: makeDailyStats(76, 14),
  },
  {
    id: 'h7',
    name: 'Post-Meal Walk (10 min)',
    category: 'Exercise',
    description: 'Take a gentle 10-minute walk after lunch or dinner to aid digestion and blood sugar regulation.',
    frequency: '3x per week',
    suggestedTime: '1:00 PM',
    assignedTo: ['Weight Management'],
    assignedClients: ['c2', 'c4'],
    completionRate: 68,
    enabled: false,
    order: 7,
    createdAt: '2026-04-10',
    clientStats: [
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 11, totalDays: 13, currentStreak: 5,  lastCompleted: 'Today' },
      { clientId: 'c4', clientName: 'Rohit Verma',     avatar: 'RV', daysCompleted: 7,  totalDays: 13, currentStreak: 3,  lastCompleted: 'Yesterday' },
    ],
    dailyStats: makeDailyStats(67, 20),
  },
  {
    id: 'h8',
    name: 'Weekly Grocery Prep',
    category: 'Custom',
    description: 'Plan and shop for the week\'s meals every Sunday. Prepare ingredients for at least 3 days in advance.',
    frequency: 'Weekly',
    suggestedTime: '10:00 AM',
    assignedTo: ['PCOS Reversal Program', 'Weight Management'],
    assignedClients: ['c1', 'c2', 'c5'],
    completionRate: 83,
    enabled: true,
    order: 8,
    createdAt: '2026-03-10',
    clientStats: [
      { clientId: 'c1', clientName: 'Priya Sharma',    avatar: 'PS', daysCompleted: 7, totalDays: 8, currentStreak: 5,  lastCompleted: 'Today' },
      { clientId: 'c2', clientName: 'Arjun Mehta',     avatar: 'AM', daysCompleted: 8, totalDays: 8, currentStreak: 8,  lastCompleted: 'Today' },
      { clientId: 'c5', clientName: 'Kavita Patel',    avatar: 'KP', daysCompleted: 6, totalDays: 8, currentStreak: 4,  lastCompleted: 'Today' },
    ],
    dailyStats: makeDailyStats(82, 14),
  },
];

export const HABIT_PROGRAMS = [
  'PCOS Reversal Program',
  'Weight Management',
  'Gut Health Reset',
  'Stress & Cortisol Balance',
  'Thyroid Support Protocol',
];

export const HABIT_CLIENT_LIST = [
  { id: 'c1', name: 'Priya Sharma' },
  { id: 'c2', name: 'Arjun Mehta' },
  { id: 'c3', name: 'Meera Nair' },
  { id: 'c4', name: 'Rohit Verma' },
  { id: 'c5', name: 'Kavita Patel' },
  { id: 'c6', name: 'Deepak Singh' },
  { id: 'c7', name: 'Sunita Rao' },
];
