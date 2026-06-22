import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchMealLogs,
  persistMealLog,
  useMyDietChartAssignments,
  useDietChart,
} from "@/lib/nutrition";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealLogType = "followed_plan" | "logged_alternative";

export type MealNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type MealIngredient = {
  name: string;
  quantity: string;
  unit: string;
};

export type MealPlan = {
  id: MealType;
  time: string;
  name: string;
  nutrition: MealNutrition;
  ingredients: MealIngredient[];
  steps: string[];
};

export type LoggedMeal = {
  mealId: MealType;
  type: MealLogType;
  loggedAt: number;
  alternativeName?: string;
  alternativeCalories?: number;
  alternativeProtein?: number;
  switchReason?: string;
};

export type DayData = {
  date: string;
  mealsLogged: number;
  completed: boolean;
  xpEarned: number;
};

export type WeekSummary = {
  weekStart: string;
  days: DayData[];
  adherencePct: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgFiber: number;
  streakAtEnd: number;
};

export type BadgeId =
  | "first_meal"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "perfect_week"
  | "recipe_chef"
  | "community_star"
  | "social_butterfly"
  | "league_climber";

export type Badge = {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt: number | null;
};

export const DAILY_TARGETS: MealNutrition = {
  calories: 1800,
  protein: 45,
  carbs: 225,
  fat: 60,
  fiber: 25,
};

export const TODAY_MEAL_PLAN: MealPlan[] = [
  {
    id: "breakfast",
    time: "8:00 AM",
    name: "Oats Porridge with Almonds & Banana",
    nutrition: { calories: 380, protein: 12, carbs: 58, fat: 10, fiber: 6 },
    ingredients: [
      { name: "Rolled oats", quantity: "1/2", unit: "cup" },
      { name: "Almond milk", quantity: "1", unit: "cup" },
      { name: "Almonds", quantity: "10", unit: "pieces" },
      { name: "Banana", quantity: "1", unit: "medium" },
      { name: "Honey", quantity: "1", unit: "tsp" },
      { name: "Cinnamon", quantity: "1/4", unit: "tsp" },
    ],
    steps: [
      "Bring almond milk to a gentle simmer in a small saucepan.",
      "Add rolled oats, stir continuously for 3-4 minutes until thickened.",
      "Remove from heat and transfer to a bowl.",
      "Slice banana and arrange on top with whole almonds.",
      "Drizzle with honey and a pinch of cinnamon.",
    ],
  },
  {
    id: "lunch",
    time: "1:00 PM",
    name: "Grilled Chicken & Brown Rice Bowl",
    nutrition: { calories: 490, protein: 42, carbs: 52, fat: 9, fiber: 4 },
    ingredients: [
      { name: "Chicken breast", quantity: "150", unit: "g" },
      { name: "Brown rice", quantity: "1/2", unit: "cup" },
      { name: "Baby spinach", quantity: "1", unit: "cup" },
      { name: "Cherry tomatoes", quantity: "6", unit: "pieces" },
      { name: "Olive oil", quantity: "1", unit: "tbsp" },
      { name: "Lemon juice", quantity: "1", unit: "tbsp" },
    ],
    steps: [
      "Cook brown rice per packet instructions (about 25 minutes).",
      "Season chicken with salt, pepper, and a squeeze of lemon.",
      "Grill chicken on medium-high heat for 6-7 minutes per side.",
      "Rest chicken 2 minutes, then slice.",
      "Assemble bowl: rice base, spinach, tomatoes, chicken. Drizzle with olive oil.",
    ],
  },
  {
    id: "dinner",
    time: "7:30 PM",
    name: "Baked Salmon with Roasted Vegetables",
    nutrition: { calories: 480, protein: 38, carbs: 22, fat: 24, fiber: 6 },
    ingredients: [
      { name: "Salmon fillet", quantity: "180", unit: "g" },
      { name: "Broccoli florets", quantity: "1", unit: "cup" },
      { name: "Sweet potato", quantity: "100", unit: "g" },
      { name: "Olive oil", quantity: "2", unit: "tbsp" },
      { name: "Garlic", quantity: "2", unit: "cloves" },
      { name: "Lemon", quantity: "1/2", unit: "whole" },
    ],
    steps: [
      "Preheat oven to 200°C (400°F).",
      "Cube sweet potato, toss with 1 tbsp olive oil, roast 20 minutes.",
      "Season salmon with salt, pepper, minced garlic, and lemon zest.",
      "Place salmon and broccoli on baking tray, drizzle with remaining oil.",
      "Bake 15 minutes until salmon is cooked through.",
    ],
  },
  {
    id: "snack",
    time: "4:00 PM",
    name: "Greek Yogurt with Mixed Berries",
    nutrition: { calories: 180, protein: 14, carbs: 22, fat: 3, fiber: 3 },
    ingredients: [
      { name: "Greek yogurt", quantity: "150", unit: "g" },
      { name: "Mixed berries", quantity: "1/2", unit: "cup" },
      { name: "Chia seeds", quantity: "1", unit: "tsp" },
      { name: "Honey", quantity: "1/2", unit: "tsp" },
    ],
    steps: [
      "Spoon yogurt into a bowl.",
      "Top with mixed berries and chia seeds.",
      "Drizzle with honey and serve immediately.",
    ],
  },
];

const SEED_BADGES: Badge[] = [
  { id: "first_meal", title: "First Meal", description: "Log your very first meal", icon: "leaf", color: "#22C55E", unlockedAt: Date.now() - 1000 * 60 * 60 * 24 * 10 },
  { id: "streak_3", title: "3-Day Streak", description: "Maintain a 3-day logging streak", icon: "flame", color: "#F59E0B", unlockedAt: Date.now() - 1000 * 60 * 60 * 24 * 4 },
  { id: "streak_7", title: "7-Day Streak", description: "Maintain a full week streak", icon: "star", color: "#F59E0B", unlockedAt: null },
  { id: "streak_30", title: "30-Day Streak", description: "Maintain a 30-day logging streak", icon: "award", color: "#8B5CF6", unlockedAt: null },
  { id: "perfect_week", title: "Perfect Week", description: "Log all meals for 7 consecutive days", icon: "check-circle", color: "#22C55E", unlockedAt: null },
  { id: "recipe_chef", title: "Recipe Chef", description: "Share your first recipe with the community", icon: "book-open", color: "#3B82F6", unlockedAt: null },
  { id: "community_star", title: "Community Star", description: "Get 10 likes on a community post", icon: "heart", color: "#EF4444", unlockedAt: null },
  { id: "social_butterfly", title: "Social Butterfly", description: "Add 5 friends to your network", icon: "users", color: "#8B5CF6", unlockedAt: null },
  { id: "league_climber", title: "League Climber", description: "Get promoted to a new league tier", icon: "trending-up", color: "#F59E0B", unlockedAt: null },
];

function pr(seed: number): number {
  return Math.abs(Math.sin(seed * 127.1 + 311.7)) % 1;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getMondayDate(weekOffset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff - weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function generateWeeklyHistory(): WeekSummary[] {
  const result: WeekSummary[] = [];
  const today = getTodayStr();

  const WEEK_DATA = [
    [3, 3, 2, 0, 0, 0, 0],
    [3, 3, 3, 2, 3, 3, 2],
    [2, 1, 3, 3, 0, 3, 3],
    [3, 2, 3, 1, 2, 3, 3],
    [2, 3, 0, 3, 2, 3, 1],
    [3, 3, 2, 3, 3, 2, 3],
    [1, 2, 3, 3, 2, 0, 3],
    [3, 2, 3, 3, 2, 3, 3],
  ];
  const WEEK_AVG = [
    [1740, 44, 218, 57, 22],
    [1820, 47, 230, 62, 26],
    [1680, 40, 210, 55, 20],
    [1800, 45, 225, 60, 25],
    [1760, 43, 220, 58, 24],
    [1830, 48, 232, 63, 27],
    [1700, 41, 212, 56, 21],
    [1850, 46, 228, 61, 26],
  ];
  const STREAK_ENDS = [5, 12, 5, 8, 5, 10, 4, 7];

  for (let w = 0; w < 8; w++) {
    const monday = getMondayDate(w);
    const days: DayData[] = [];
    let completedDays = 0;

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + d);
      const dateStr = dayDate.toISOString().split("T")[0];
      const isFuture = dateStr > today;
      const isToday = dateStr === today;

      let mealsLogged = WEEK_DATA[w][d];
      if (isFuture) mealsLogged = 0;
      if (isToday) mealsLogged = 0;

      const completed = mealsLogged >= 2;
      if (completed) completedDays++;

      const dayXp = mealsLogged * 10 + (mealsLogged === 3 ? 15 : 0);
      days.push({ date: dateStr, mealsLogged, completed, xpEarned: dayXp });
    }

    const avg = WEEK_AVG[w];
    result.push({
      weekStart: monday.toISOString().split("T")[0],
      days,
      adherencePct: Math.round((completedDays / 7) * 100),
      avgCalories: avg[0],
      avgProtein: avg[1],
      avgCarbs: avg[2],
      avgFat: avg[3],
      avgFiber: avg[4],
      streakAtEnd: STREAK_ENDS[w],
    });
  }

  return result;
}

type MealContextType = {
  todayMealPlan: MealPlan[];
  todayLog: LoggedMeal[];
  xp: number;
  streak: number;
  longestStreak: number;
  water: number;
  badges: Badge[];
  weeklyHistory: WeekSummary[];
  targets: MealNutrition;

  /** True when the user has an ACTIVE coach-assigned diet chart (vs. the sample plan). */
  isDietChartAssigned: boolean;

  getMealStatus: (mealType: MealType) => MealLogType | null;
  logMeal: (mealType: MealType) => { isPerfectDay: boolean };
  logAlternativeMeal: (
    mealType: MealType,
    data: { name: string; calories: number; protein: number; switchReason: string }
  ) => { isPerfectDay: boolean };
  addWater: () => void;
  getCaloriesToday: () => number;
  getProteinToday: () => number;
};

const MealContext = createContext<MealContextType | null>(null);

const STORAGE_KEY = "vitale_meals_v2";

export function MealProvider({ children }: { children: React.ReactNode }) {
  const [todayLog, setTodayLog] = useState<LoggedMeal[]>([]);
  const [xp, setXp] = useState(245);
  const [streak, setStreak] = useState(5);
  const [longestStreak, setLongestStreak] = useState(12);
  const [water, setWater] = useState(0);
  const [badges, setBadges] = useState<Badge[]>(SEED_BADGES);
  const [weeklyHistory] = useState<WeekSummary[]>(generateWeeklyHistory());

  // Coach-assigned diet chart (D4). Take the first ACTIVE assignment and resolve its
  // chart; map the meals into the MealPlan shape. Fall back to the sample plan ONLY
  // when there is no active assignment (no fabricated chart otherwise).
  const assignmentsQuery = useMyDietChartAssignments();
  const activeAssignment = useMemo(
    () => assignmentsQuery.data?.find((a) => a.status === "active"),
    [assignmentsQuery.data],
  );
  const chartQuery = useDietChart(activeAssignment?.dietChartId);
  const isDietChartAssigned = !!activeAssignment;

  const todayMealPlan = useMemo<MealPlan[]>(() => {
    if (!activeAssignment) return TODAY_MEAL_PLAN;
    const meals = chartQuery.data?.meals ?? [];
    // No macro data on the meal row yet → nutrition defaults to zeros (intentional).
    return meals.map((m) => ({
      id: m.mealType,
      name: m.name ?? m.mealType,
      time: m.timeOfDay ?? "",
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      ingredients: [],
      steps: [],
    }));
  }, [activeAssignment, chartQuery.data]);

  // Populate TODAY's meal log from D4 (backend is the source of truth for logged
  // meals; coach can see them too). Plan/XP/streak/badges below stay local.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetchMealLogs(today, today)
      .then((logs) => {
        if (logs.length === 0) return;
        const byMeal = new Map<MealType, LoggedMeal>();
        for (const l of logs) {
          byMeal.set(l.mealType, {
            mealId: l.mealType,
            type: "followed_plan",
            loggedAt: Date.parse(l.loggedAt),
            alternativeName: l.note ?? undefined,
            alternativeCalories: l.totalCalories != null ? Number(l.totalCalories) : undefined,
          });
        }
        setTodayLog(Array.from(byMeal.values()));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const savedDate = saved.date;
          const today = getTodayStr();
          if (savedDate === today) {
            setTodayLog(saved.todayLog ?? []);
            setWater(saved.water ?? 0);
          }
          setXp(saved.xp ?? 245);
          setStreak(saved.streak ?? 5);
          setLongestStreak(saved.longestStreak ?? 12);
          setBadges(saved.badges ?? SEED_BADGES);
        }
      } catch {}
    }
    load();
  }, []);

  const persist = useCallback(
    async (
      log: LoggedMeal[],
      newXp: number,
      newStreak: number,
      newLongest: number,
      newWater: number,
      newBadges: Badge[]
    ) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            date: getTodayStr(),
            todayLog: log,
            xp: newXp,
            streak: newStreak,
            longestStreak: newLongest,
            water: newWater,
            badges: newBadges,
          })
        );
      } catch {}
    },
    []
  );

  const getMealStatus = useCallback(
    (mealType: MealType): MealLogType | null => {
      const log = todayLog.find((l) => l.mealId === mealType);
      return log ? log.type : null;
    },
    [todayLog]
  );

  function checkBadges(
    log: LoggedMeal[],
    newStreak: number,
    currentBadges: Badge[]
  ): Badge[] {
    let updated = [...currentBadges];
    const now = Date.now();

    const unlock = (id: BadgeId) => {
      updated = updated.map((b) =>
        b.id === id && b.unlockedAt === null ? { ...b, unlockedAt: now } : b
      );
    };

    const mainLogged = log.filter((l) => l.mealId !== "snack").length;
    if (log.length >= 1) unlock("first_meal");
    if (newStreak >= 3) unlock("streak_3");
    if (newStreak >= 7) unlock("streak_7");
    if (newStreak >= 30) unlock("streak_30");
    if (mainLogged === 3) unlock("perfect_week");

    return updated;
  }

  const logMeal = useCallback(
    (mealType: MealType): { isPerfectDay: boolean } => {
      const plan = todayMealPlan.find((p) => p.id === mealType);
      const planCalories = plan?.nutrition.calories ?? 0;
      const planProtein = plan?.nutrition.protein ?? 0;
      const planName = plan?.name ?? mealType;
      const entry: LoggedMeal = {
        mealId: mealType,
        type: "followed_plan",
        loggedAt: Date.now(),
        alternativeCalories: planCalories,
        alternativeProtein: planProtein,
      };
      // Additively persist the meal to D4 (the client's coach can see it, consent-gated).
      // The streak/XP/badges/plan UX below stays local (D6 / planning not yet backed).
      void persistMealLog({ mealType, totalCalories: planCalories, note: planName }).catch(() => {});

      const newLog = [...todayLog.filter((l) => l.mealId !== mealType), entry];
      const newXp = xp + 10;
      const mainLogged = newLog.filter((l) => l.mealId !== "snack").length;
      const newStreak = mainLogged === 1 ? streak + 1 : streak;
      const newLongest = Math.max(newStreak, longestStreak);
      const newBadges = checkBadges(newLog, newStreak, badges);
      const isPerfectDay = mainLogged === 3;

      if (isPerfectDay) {
        const bonusXp = newXp + 15;
        setXp(bonusXp);
        setTodayLog(newLog);
        setStreak(newStreak);
        setLongestStreak(newLongest);
        setBadges(newBadges);
        persist(newLog, bonusXp, newStreak, newLongest, water, newBadges);
        return { isPerfectDay: true };
      }

      setXp(newXp);
      setTodayLog(newLog);
      setStreak(newStreak);
      setLongestStreak(newLongest);
      setBadges(newBadges);
      persist(newLog, newXp, newStreak, newLongest, water, newBadges);
      return { isPerfectDay };
    },
    [todayMealPlan, todayLog, xp, streak, longestStreak, water, badges, persist]
  );

  const logAlternativeMeal = useCallback(
    (
      mealType: MealType,
      data: { name: string; calories: number; protein: number; switchReason: string }
    ): { isPerfectDay: boolean } => {
      const entry: LoggedMeal = {
        mealId: mealType,
        type: "logged_alternative",
        loggedAt: Date.now(),
        alternativeName: data.name,
        alternativeCalories: data.calories,
        alternativeProtein: data.protein,
        switchReason: data.switchReason,
      };
      // Additively persist the logged alternative to D4 (consent-gated for the coach).
      void persistMealLog({ mealType, totalCalories: data.calories, note: data.name }).catch(() => {});

      const newLog = [...todayLog.filter((l) => l.mealId !== mealType), entry];
      const newXp = xp + 5;
      const mainLogged = newLog.filter((l) => l.mealId !== "snack").length;
      const newStreak = mainLogged === 1 ? streak + 1 : streak;
      const newLongest = Math.max(newStreak, longestStreak);
      const newBadges = checkBadges(newLog, newStreak, badges);
      const isPerfectDay = mainLogged === 3;

      setXp(isPerfectDay ? newXp + 15 : newXp);
      setTodayLog(newLog);
      setStreak(newStreak);
      setLongestStreak(newLongest);
      setBadges(newBadges);
      persist(newLog, isPerfectDay ? newXp + 15 : newXp, newStreak, newLongest, water, newBadges);
      return { isPerfectDay };
    },
    [todayLog, xp, streak, longestStreak, water, badges, persist]
  );

  const addWater = useCallback(() => {
    const newWater = water + 1;
    setWater(newWater);
    persist(todayLog, xp, streak, longestStreak, newWater, badges);
  }, [water, todayLog, xp, streak, longestStreak, badges, persist]);

  const getCaloriesToday = useCallback(() => {
    return todayLog.reduce((sum, l) => sum + (l.alternativeCalories ?? 0), 0);
  }, [todayLog]);

  const getProteinToday = useCallback(() => {
    return todayLog.reduce((sum, l) => sum + (l.alternativeProtein ?? 0), 0);
  }, [todayLog]);

  return (
    <MealContext.Provider
      value={{
        todayMealPlan,
        todayLog,
        xp,
        streak,
        longestStreak,
        water,
        badges,
        weeklyHistory,
        targets: DAILY_TARGETS,
        isDietChartAssigned,
        getMealStatus,
        logMeal,
        logAlternativeMeal,
        addWater,
        getCaloriesToday,
        getProteinToday,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMeal() {
  const ctx = useContext(MealContext);
  if (!ctx) throw new Error("useMeal must be used inside MealProvider");
  return ctx;
}
