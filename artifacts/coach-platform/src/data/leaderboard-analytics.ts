export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  program: string;
  adherence: number;
  streak: number;
  league: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  xpThisWeek: number;
  daysActive: number;
}

export interface LeagueMovement {
  id: string;
  user: string;
  program: string;
  prevLeague: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  newLeague: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  direction: 'Promoted' | 'Demoted' | 'Stayed';
  week: string;
}

export interface AnomalyFlag {
  id: string;
  user: string;
  userId: string;
  program: string;
  type: 'Perfect adherence' | 'Impossible timeframe' | 'Bulk logging' | 'Pattern anomaly';
  detail: string;
  flaggedOn: string;
  adherencePct: number;
  daysInRow: number;
  status: 'Open' | 'Dismissed' | 'Disabled';
}

export interface CorrelationPoint {
  rank: number;
  daysActive: number;
  user: string;
  league: string;
}

const NAMES = [
  'Priya Sharma', 'Ananya Mehta', 'Kavya Reddy', 'Sunita Patel', 'Deepa Nair',
  'Meena Iyer', 'Ritu Agarwal', 'Pooja Singh', 'Divya Joshi', 'Lakshmi Rao',
  'Neha Gupta', 'Shreya Bose', 'Anjali Verma', 'Swati Kumar', 'Rekha Pillai',
  'Sonal Desai', 'Preethi Nair', 'Asha Krishnan', 'Kavitha Menon', 'Usha Sharma',
  'Vinita Chopra', 'Bhavna Tiwari', 'Manisha Dubey', 'Rashmi Jain', 'Pallavi Shah',
];

const LEAGUES: LeaderboardUser['league'][] = ['Diamond', 'Diamond', 'Platinum', 'Platinum', 'Gold', 'Gold', 'Gold', 'Silver', 'Silver', 'Silver', 'Silver', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze', 'Bronze'];

function makeLeaderboard(program: string, seed: number): LeaderboardUser[] {
  return NAMES.map((name, i) => {
    const rank = i + 1;
    const adherence = Math.max(62, Math.round(99 - rank * 1.3 + (seed % 7) - (i % 3)));
    const streak = Math.max(0, Math.round(45 - rank * 1.6 + (seed % 5)));
    const xp = Math.max(20, Math.round(380 - rank * 13 + (seed % 30)));
    const daysActive = Math.max(14, Math.round(180 - rank * 5 + (seed % 10)));
    return { rank, name, avatar: name.split(' ').map(n => n[0]).join(''), program, adherence, streak, league: LEAGUES[i], xpThisWeek: xp, daysActive };
  });
}

export const PROGRAMS_WITH_LEADERBOARDS = [
  'PCOS Reversal Program',
  'Transform 90',
  'Gut Reset 30-Day',
  'Diabetic Wellness',
  'Cardiac Wellness',
  'Weight Loss Journey',
];

export const LEADERBOARDS: Record<string, LeaderboardUser[]> = {
  'PCOS Reversal Program': makeLeaderboard('PCOS Reversal Program', 7),
  'Transform 90':          makeLeaderboard('Transform 90', 13),
  'Gut Reset 30-Day':      makeLeaderboard('Gut Reset 30-Day', 3),
  'Diabetic Wellness':     makeLeaderboard('Diabetic Wellness', 19),
  'Cardiac Wellness':      makeLeaderboard('Cardiac Wellness', 11),
  'Weight Loss Journey':   makeLeaderboard('Weight Loss Journey', 5),
};

const WEEKS = ['Week 18 (Apr 28)', 'Week 17 (Apr 21)', 'Week 16 (Apr 14)', 'Week 15 (Apr 7)'];

export const LEAGUE_MOVEMENTS: LeagueMovement[] = [
  { id: 'm1',  user: 'Priya Sharma',   program: 'PCOS Reversal Program', prevLeague: 'Silver',   newLeague: 'Gold',     direction: 'Promoted', week: WEEKS[0] },
  { id: 'm2',  user: 'Kavya Reddy',    program: 'Transform 90',          prevLeague: 'Gold',     newLeague: 'Platinum', direction: 'Promoted', week: WEEKS[0] },
  { id: 'm3',  user: 'Neha Gupta',     program: 'Transform 90',          prevLeague: 'Bronze',   newLeague: 'Silver',   direction: 'Promoted', week: WEEKS[0] },
  { id: 'm4',  user: 'Sunita Patel',   program: 'Gut Reset 30-Day',      prevLeague: 'Gold',     newLeague: 'Silver',   direction: 'Demoted',  week: WEEKS[0] },
  { id: 'm5',  user: 'Deepa Nair',     program: 'Diabetic Wellness',     prevLeague: 'Silver',   newLeague: 'Silver',   direction: 'Stayed',   week: WEEKS[0] },
  { id: 'm6',  user: 'Meena Iyer',     program: 'PCOS Reversal Program', prevLeague: 'Platinum', newLeague: 'Diamond',  direction: 'Promoted', week: WEEKS[0] },
  { id: 'm7',  user: 'Ritu Agarwal',   program: 'Cardiac Wellness',      prevLeague: 'Silver',   newLeague: 'Bronze',   direction: 'Demoted',  week: WEEKS[0] },
  { id: 'm8',  user: 'Pooja Singh',    program: 'Weight Loss Journey',   prevLeague: 'Bronze',   newLeague: 'Silver',   direction: 'Promoted', week: WEEKS[0] },
  { id: 'm9',  user: 'Divya Joshi',    program: 'Transform 90',          prevLeague: 'Gold',     newLeague: 'Gold',     direction: 'Stayed',   week: WEEKS[0] },
  { id: 'm10', user: 'Lakshmi Rao',    program: 'PCOS Reversal Program', prevLeague: 'Bronze',   newLeague: 'Silver',   direction: 'Promoted', week: WEEKS[0] },
  { id: 'm11', user: 'Shreya Bose',    program: 'Gut Reset 30-Day',      prevLeague: 'Platinum', newLeague: 'Gold',     direction: 'Demoted',  week: WEEKS[1] },
  { id: 'm12', user: 'Anjali Verma',   program: 'Diabetic Wellness',     prevLeague: 'Bronze',   newLeague: 'Bronze',   direction: 'Stayed',   week: WEEKS[1] },
  { id: 'm13', user: 'Swati Kumar',    program: 'Weight Loss Journey',   prevLeague: 'Silver',   newLeague: 'Gold',     direction: 'Promoted', week: WEEKS[1] },
  { id: 'm14', user: 'Rekha Pillai',   program: 'Cardiac Wellness',      prevLeague: 'Gold',     newLeague: 'Platinum', direction: 'Promoted', week: WEEKS[1] },
  { id: 'm15', user: 'Sonal Desai',    program: 'Transform 90',          prevLeague: 'Diamond',  newLeague: 'Platinum', direction: 'Demoted',  week: WEEKS[1] },
  { id: 'm16', user: 'Preethi Nair',   program: 'PCOS Reversal Program', prevLeague: 'Silver',   newLeague: 'Silver',   direction: 'Stayed',   week: WEEKS[1] },
  { id: 'm17', user: 'Asha Krishnan',  program: 'Gut Reset 30-Day',      prevLeague: 'Bronze',   newLeague: 'Silver',   direction: 'Promoted', week: WEEKS[2] },
  { id: 'm18', user: 'Kavitha Menon',  program: 'Diabetic Wellness',     prevLeague: 'Gold',     newLeague: 'Gold',     direction: 'Stayed',   week: WEEKS[2] },
  { id: 'm19', user: 'Usha Sharma',    program: 'Weight Loss Journey',   prevLeague: 'Silver',   newLeague: 'Bronze',   direction: 'Demoted',  week: WEEKS[2] },
  { id: 'm20', user: 'Vinita Chopra',  program: 'PCOS Reversal Program', prevLeague: 'Platinum', newLeague: 'Diamond',  direction: 'Promoted', week: WEEKS[2] },
  { id: 'm21', user: 'Bhavna Tiwari',  program: 'Transform 90',          prevLeague: 'Bronze',   newLeague: 'Silver',   direction: 'Promoted', week: WEEKS[2] },
  { id: 'm22', user: 'Manisha Dubey',  program: 'Cardiac Wellness',      prevLeague: 'Silver',   newLeague: 'Gold',     direction: 'Promoted', week: WEEKS[2] },
  { id: 'm23', user: 'Rashmi Jain',    program: 'Gut Reset 30-Day',      prevLeague: 'Gold',     newLeague: 'Silver',   direction: 'Demoted',  week: WEEKS[3] },
  { id: 'm24', user: 'Pallavi Shah',   program: 'Diabetic Wellness',     prevLeague: 'Silver',   newLeague: 'Gold',     direction: 'Promoted', week: WEEKS[3] },
  { id: 'm25', user: 'Priya Sharma',   program: 'Transform 90',          prevLeague: 'Bronze',   newLeague: 'Bronze',   direction: 'Stayed',   week: WEEKS[3] },
];

export const ANOMALY_FLAGS: AnomalyFlag[] = [
  { id: 'af1', user: 'Rekha Pillai',   userId: 'u-011', program: 'Cardiac Wellness',      type: 'Perfect adherence',    detail: '100% adherence for 34 consecutive days — may be pre-logging meals', flaggedOn: '2026-05-06', adherencePct: 100, daysInRow: 34, status: 'Open'      },
  { id: 'af2', user: 'Swati Kumar',    userId: 'u-014', program: 'Weight Loss Journey',   type: 'Impossible timeframe',  detail: '3 meals logged within 45 seconds on May 3rd at 11:42 PM',          flaggedOn: '2026-05-04', adherencePct: 97,  daysInRow: 21, status: 'Open'      },
  { id: 'af3', user: 'Asha Krishnan',  userId: 'u-017', program: 'Gut Reset 30-Day',      type: 'Bulk logging',          detail: '7 days of meals logged in a single session on Apr 30th',            flaggedOn: '2026-05-01', adherencePct: 98,  daysInRow: 28, status: 'Open'      },
  { id: 'af4', user: 'Manisha Dubey',  userId: 'u-022', program: 'Cardiac Wellness',      type: 'Perfect adherence',    detail: '100% adherence for 31 consecutive days',                             flaggedOn: '2026-05-05', adherencePct: 100, daysInRow: 31, status: 'Dismissed' },
  { id: 'af5', user: 'Kavitha Menon',  userId: 'u-018', program: 'Diabetic Wellness',     type: 'Pattern anomaly',       detail: 'Meals always logged at exactly :00 minutes (top of the hour)',      flaggedOn: '2026-04-28', adherencePct: 95,  daysInRow: 18, status: 'Dismissed' },
  { id: 'af6', user: 'Bhavna Tiwari',  userId: 'u-021', program: 'Transform 90',          type: 'Impossible timeframe',  detail: '4 meals logged within 2 minutes on Apr 25th',                       flaggedOn: '2026-04-26', adherencePct: 94,  daysInRow: 15, status: 'Disabled'  },
  { id: 'af7', user: 'Sonal Desai',    userId: 'u-016', program: 'Transform 90',          type: 'Bulk logging',          detail: '5 days of meals logged retroactively in one session',               flaggedOn: '2026-05-02', adherencePct: 91,  daysInRow: 12, status: 'Open'      },
];

export const PLATFORM_LEADERBOARD_STATS = {
  totalParticipants: 1287,
  avgAdherence: 78.4,
  longestStreak: 67,
  longestStreakUser: 'Meena Iyer',
  mostCompetitiveProgram: 'PCOS Reversal Program',
  mostCompetitiveAdherence: 84.2,
};

export const CORRELATION_DATA: CorrelationPoint[] = NAMES.map((name, i) => ({
  rank: i + 1,
  daysActive: Math.max(14, Math.round(175 - i * 6 + (i % 4) * 8)),
  user: name,
  league: LEAGUES[i],
}));

export const LEAGUE_COLORS: Record<string, string> = {
  Bronze:   '#b45309',
  Silver:   '#64748b',
  Gold:     '#ca8a04',
  Platinum: '#0891b2',
  Diamond:  '#1d4ed8',
};

export const WEEKS_LIST = WEEKS;
