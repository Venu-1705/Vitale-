export type MealType = 'Breakfast' | 'Mid-Morning' | 'Lunch' | 'Dinner';
export type LogType = 'planned' | 'alternative' | 'skipped' | 'not_logged';

export interface MealSlot {
  meal: MealType;
  plannedName: string;
  plannedCalories: number;
  plannedProtein: number;
  loggedName?: string;
  loggedCalories?: number;
  loggedProtein?: number;
  type: LogType;
  timeLogged?: string;
  alternativeReason?: string;
  pointsEarned: number;
}

export interface DayLog {
  date: string;
  dateDisplay: string;
  slots: MealSlot[];
}

export interface WeeklyAdherence {
  week: string;
  logged: number;
  total: number;
  pct: number;
}

export const TODAY_MEALS: MealSlot[] = [
  {
    meal: 'Breakfast',
    plannedName: 'Oats Porridge with Almonds',
    plannedCalories: 320, plannedProtein: 12,
    loggedName: 'Oats Porridge with Almonds',
    loggedCalories: 320, loggedProtein: 12,
    type: 'planned', timeLogged: '8:12 AM', pointsEarned: 10,
  },
  {
    meal: 'Mid-Morning',
    plannedName: 'Mixed Fruit Bowl',
    plannedCalories: 150, plannedProtein: 2,
    loggedName: 'Banana & Peanut Butter',
    loggedCalories: 210, loggedProtein: 5,
    type: 'alternative', timeLogged: '10:45 AM',
    alternativeReason: 'Eating out', pointsEarned: 5,
  },
  {
    meal: 'Lunch',
    plannedName: 'Multigrain Roti + Dal + Sabzi',
    plannedCalories: 520, plannedProtein: 22,
    type: 'skipped', pointsEarned: 0,
  },
  {
    meal: 'Dinner',
    plannedName: 'Grilled Chicken + Salad',
    plannedCalories: 345, plannedProtein: 38,
    type: 'not_logged', pointsEarned: 0,
  },
];

const MEAL_NAMES: Record<MealType, string[]> = {
  'Breakfast': ['Oats Porridge with Almonds', 'Besan Chilla', 'Poha with Veggies', 'Ragi Dosa', 'Upma'],
  'Mid-Morning': ['Mixed Fruit Bowl', 'Buttermilk', 'Walnuts & Dates', 'Banana & Peanut Butter', 'Green Smoothie'],
  'Lunch': ['Multigrain Roti + Dal + Sabzi', 'Brown Rice + Rajma', 'Khichdi', 'Curd Rice', 'Quinoa Salad'],
  'Dinner': ['Grilled Chicken + Salad', 'Paneer Tikka + Roti', 'Dal Soup + Rice', 'Tofu Stir Fry', 'Egg Curry + Millet'],
};

const MEAL_CALS: Record<MealType, number> = { 'Breakfast': 320, 'Mid-Morning': 150, 'Lunch': 520, 'Dinner': 345 };
const MEAL_PRO: Record<MealType, number> = { 'Breakfast': 12, 'Mid-Morning': 2, 'Lunch': 22, 'Dinner': 38 };
const MEAL_TIME: Record<MealType, string> = { 'Breakfast': '8:15 AM', 'Mid-Morning': '10:30 AM', 'Lunch': '1:10 PM', 'Dinner': '7:45 PM' };
const ALT_REASONS = ['Not available', 'Eating out', 'Preference', 'Family occasion', 'Forgot to prepare'];
const MEALS: MealType[] = ['Breakfast', 'Mid-Morning', 'Lunch', 'Dinner'];

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDayLogs(): DayLog[] {
  const logs: DayLog[] = [];
  const base = new Date(2026, 3, 29);
  for (let d = 1; d <= 28; d++) {
    const date = new Date(base);
    date.setDate(base.getDate() - d);
    const month = date.toLocaleString('en-IN', { month: 'short' });
    const dateDisplay = `${date.getDate()} ${month}`;
    const slots: MealSlot[] = MEALS.map((meal, mi) => {
      const seed = d * 10 + mi;
      const rand = seededRand(seed);
      const planned = MEAL_NAMES[meal][0];
      const plannedCalories = MEAL_CALS[meal];
      const plannedProtein = MEAL_PRO[meal];
      if (rand < 0.58) {
        return {
          meal, plannedName: planned, plannedCalories, plannedProtein,
          loggedName: planned, loggedCalories: plannedCalories, loggedProtein: plannedProtein,
          type: 'planned' as LogType, timeLogged: MEAL_TIME[meal], pointsEarned: 10,
        };
      } else if (rand < 0.80) {
        const altIdx = (Math.floor(seededRand(seed + 100) * 4) + 1);
        const altName = MEAL_NAMES[meal][altIdx] ?? MEAL_NAMES[meal][1];
        const altCal = Math.round(plannedCalories * (0.75 + seededRand(seed + 200) * 0.55));
        const altPro = Math.round(plannedProtein * (0.65 + seededRand(seed + 300) * 0.70));
        const reasonIdx = Math.floor(seededRand(seed + 400) * ALT_REASONS.length);
        return {
          meal, plannedName: planned, plannedCalories, plannedProtein,
          loggedName: altName, loggedCalories: altCal, loggedProtein: altPro,
          type: 'alternative' as LogType,
          timeLogged: MEAL_TIME[meal],
          alternativeReason: ALT_REASONS[reasonIdx],
          pointsEarned: 5,
        };
      } else {
        return {
          meal, plannedName: planned, plannedCalories, plannedProtein,
          type: 'skipped' as LogType, pointsEarned: 0,
        };
      }
    });
    logs.push({ date: date.toISOString().split('T')[0], dateDisplay, slots });
  }
  return logs;
}

export const HISTORY_LOGS: DayLog[] = generateDayLogs();

export const WEEKLY_ADHERENCE: WeeklyAdherence[] = [
  { week: 'Mar 3–9', logged: 18, total: 28, pct: 64 },
  { week: 'Mar 10–16', logged: 20, total: 28, pct: 71 },
  { week: 'Mar 17–23', logged: 22, total: 28, pct: 79 },
  { week: 'Mar 24–30', logged: 19, total: 28, pct: 68 },
  { week: 'Mar 31–Apr 6', logged: 23, total: 28, pct: 82 },
  { week: 'Apr 7–13', logged: 21, total: 28, pct: 75 },
  { week: 'Apr 14–20', logged: 24, total: 28, pct: 86 },
  { week: 'Apr 21–27', logged: 22, total: 28, pct: 79 },
];

export const ALT_INSIGHTS = {
  topMeal: 'Lunch',
  topCount: 8,
  reasons: [
    { label: 'Not available', count: 4 },
    { label: 'Eating out', count: 3 },
    { label: 'Preference', count: 1 },
  ],
};
