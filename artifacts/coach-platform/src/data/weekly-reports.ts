export interface DayAdherence {
  day: string;
  short: string;
  logged: number;
  total: number;
  pct: number;
  status: 'full' | 'partial' | 'none';
}

export interface NutritionAvg {
  label: string;
  avg: number;
  target: number;
  unit: string;
}

export interface CoachInsight {
  id: string;
  text: string;
  published: boolean;
  auto?: boolean;
}

export interface WeekReport {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  days: DayAdherence[];
  adherencePct: number;
  mealsLogged: number;
  mealsTotal: number;
  xpEarned: number;
  streakDays: number;
  rankInProgram: number;
  totalInProgram: number;
  leagueMovement: 'promoted' | 'stayed' | 'demoted';
  league: string;
  nutrition: NutritionAvg[];
  insights: CoachInsight[];
}

function makeWeek(
  weekLabel: string,
  weekStart: string,
  weekEnd: string,
  dayPcts: number[],
  xp: number,
  rank: number,
  total: number,
  league: string,
  leagueMovement: 'promoted' | 'stayed' | 'demoted',
  streak: number,
  nutrition: NutritionAvg[],
  insights: CoachInsight[],
): WeekReport {
  const days: DayAdherence[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const shorts = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const pct = dayPcts[i];
    const logged = pct === 100 ? 4 : pct === 75 ? 3 : pct === 50 ? 2 : pct === 25 ? 1 : 0;
    return {
      day,
      short: shorts[i],
      logged,
      total: 4,
      pct,
      status: pct >= 75 ? 'full' : pct >= 25 ? 'partial' : 'none',
    };
  });
  const mealsLogged = days.reduce((s, d) => s + d.logged, 0);
  const mealsTotal = 28;
  const adherencePct = Math.round((mealsLogged / mealsTotal) * 100);
  return { weekLabel, weekStart, weekEnd, days, adherencePct, mealsLogged, mealsTotal, xpEarned: xp, streakDays: streak, rankInProgram: rank, totalInProgram: total, leagueMovement, league, nutrition, insights };
}

const DEFAULT_TARGETS: NutritionAvg[] = [
  { label: 'Calories', avg: 0, target: 1650, unit: 'kcal' },
  { label: 'Protein',  avg: 0, target: 65,   unit: 'g'    },
  { label: 'Carbs',    avg: 0, target: 200,   unit: 'g'    },
  { label: 'Fat',      avg: 0, target: 50,    unit: 'g'    },
  { label: 'Fibre',    avg: 0, target: 25,    unit: 'g'    },
];

function makeNutrition(cals: number, pro: number, carbs: number, fat: number, fibre: number): NutritionAvg[] {
  return DEFAULT_TARGETS.map(t => ({
    ...t,
    avg: t.label === 'Calories' ? cals : t.label === 'Protein' ? pro : t.label === 'Carbs' ? carbs : t.label === 'Fat' ? fat : fibre,
  }));
}

export const WEEKLY_REPORTS: WeekReport[] = [
  makeWeek(
    'Apr 21 – Apr 27, 2026', 'Apr 21', 'Apr 27',
    [100, 75, 100, 50, 75, 100, 25], 340, 12, 48, 'Silver', 'stayed', 9,
    makeNutrition(1420, 58, 172, 44, 19),
    [
      { id: 'i-1', text: 'Great consistency on weekdays! Try to maintain the same routine on weekends.', published: true, auto: false },
      { id: 'i-2', text: 'Fibre intake is below target. Add more dal, sabzi, or salad at lunch.', published: true, auto: true },
    ]
  ),
  makeWeek(
    'Apr 14 – Apr 20, 2026', 'Apr 14', 'Apr 20',
    [100, 100, 75, 75, 100, 75, 50], 410, 9, 48, 'Silver', 'promoted', 14,
    makeNutrition(1560, 63, 185, 47, 22),
    [
      { id: 'i-3', text: 'Excellent week — promoted to Silver! Keep this energy going.', published: true, auto: false },
    ]
  ),
  makeWeek(
    'Apr 7 – Apr 13, 2026', 'Apr 7', 'Apr 13',
    [75, 50, 75, 100, 50, 25, 50], 270, 18, 48, 'Bronze', 'stayed', 7,
    makeNutrition(1380, 54, 165, 41, 17),
    [
      { id: 'i-4', text: 'Adherence dipped mid-week. Were there external stressors? Let\'s discuss in our next session.', published: true, auto: false },
      { id: 'i-5', text: 'Average calorie intake is below your target. Make sure you\'re not skipping main meals.', published: false, auto: true },
    ]
  ),
  makeWeek(
    'Mar 31 – Apr 6, 2026', 'Mar 31', 'Apr 6',
    [100, 100, 100, 75, 100, 50, 75], 380, 7, 48, 'Bronze', 'stayed', 12,
    makeNutrition(1510, 61, 180, 46, 21),
    [{ id: 'i-6', text: 'Strong start to April. Protein is on target this week — excellent work.', published: true, auto: false }]
  ),
  makeWeek(
    'Mar 24 – Mar 30, 2026', 'Mar 24', 'Mar 30',
    [50, 75, 100, 100, 75, 25, 0], 290, 22, 48, 'Bronze', 'demoted', 5,
    makeNutrition(1310, 50, 158, 39, 15),
    [{ id: 'i-7', text: 'Weekend adherence needs attention. Consider prepping meals on Friday evening.', published: true, auto: false }]
  ),
  makeWeek(
    'Mar 17 – Mar 23, 2026', 'Mar 17', 'Mar 23',
    [100, 75, 75, 100, 100, 50, 75], 360, 11, 48, 'Silver', 'stayed', 10,
    makeNutrition(1490, 60, 177, 45, 20),
    [{ id: 'i-8', text: 'Consistent week across weekdays. Great job keeping up with the plan.', published: true, auto: false }]
  ),
  makeWeek(
    'Mar 10 – Mar 16, 2026', 'Mar 10', 'Mar 16',
    [75, 100, 100, 75, 50, 75, 100], 350, 14, 48, 'Bronze', 'stayed', 8,
    makeNutrition(1530, 62, 183, 48, 23),
    []
  ),
  makeWeek(
    'Mar 3 – Mar 9, 2026', 'Mar 3', 'Mar 9',
    [50, 75, 100, 75, 75, 100, 50], 320, 16, 48, 'Bronze', 'stayed', 6,
    makeNutrition(1460, 57, 174, 43, 18),
    []
  ),
];

// Auto-suggestion rules for new weeks
export function generateAutoSuggestions(report: WeekReport): string[] {
  const suggestions: string[] = [];
  if (report.adherencePct < 70) {
    suggestions.push('Adherence was lower this week. Try setting a meal reminder to stay on track.');
  }
  const cals = report.nutrition.find(n => n.label === 'Calories');
  if (cals && cals.avg < cals.target * 0.85) {
    suggestions.push("Average calorie intake is below your target. Make sure you're not skipping main meals.");
  }
  const fibre = report.nutrition.find(n => n.label === 'Fibre');
  if (fibre && fibre.avg < fibre.target * 0.8) {
    suggestions.push('Boost your fibre with more vegetables, dal, and whole grains at each meal.');
  }
  const protein = report.nutrition.find(n => n.label === 'Protein');
  if (protein && protein.avg > protein.target * 1.1) {
    suggestions.push('Great protein intake this week — keep it up and distribute it evenly across meals.');
  }
  const weekendDays = report.days.slice(5);
  const weekendPct = weekendDays.reduce((s, d) => s + d.pct, 0) / 2;
  if (weekendPct < 50) {
    suggestions.push('Weekend adherence needs attention. Consider prepping meals on Friday evening.');
  }
  return suggestions;
}
