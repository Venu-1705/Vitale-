export const USER_GROWTH_DATA = [
  { month: 'Nov 25', users: 142, coaches: 4, programs: 8 },
  { month: 'Dec 25', users: 168, coaches: 5, programs: 10 },
  { month: 'Jan 26', users: 205, coaches: 6, programs: 12 },
  { month: 'Feb 26', users: 248, coaches: 6, programs: 14 },
  { month: 'Mar 26', users: 290, coaches: 7, programs: 16 },
  { month: 'Apr 26', users: 342, coaches: 8, programs: 18 },
];

export const REVENUE_DATA = [
  { month: 'Nov 25', revenue: 312000, commissions: 31200, net: 280800 },
  { month: 'Dec 25', revenue: 285000, commissions: 28500, net: 256500 },
  { month: 'Jan 26', revenue: 428000, commissions: 42800, net: 385200 },
  { month: 'Feb 26', revenue: 512000, commissions: 51200, net: 460800 },
  { month: 'Mar 26', revenue: 598000, commissions: 59800, net: 538200 },
  { month: 'Apr 26', revenue: 645000, commissions: 64500, net: 580500 },
];

export const PROGRAM_POPULARITY = [
  { name: 'Weight Loss Intensive', enrollments: 89, revenue: 445000, completion: 72 },
  { name: 'PCOS Reversal Program', enrollments: 67, revenue: 335000, completion: 65 },
  { name: 'Diabetes Control', enrollments: 52, revenue: 260000, completion: 78 },
  { name: 'Athletic Performance', enrollments: 44, revenue: 352000, completion: 85 },
  { name: 'Thyroid Balance', enrollments: 38, revenue: 190000, completion: 70 },
  { name: 'Gut Reset Program', enrollments: 31, revenue: 155000, completion: 68 },
  { name: 'Heart Health Protocol', enrollments: 28, revenue: 196000, completion: 82 },
  { name: 'Senior Wellness', enrollments: 24, revenue: 120000, completion: 88 },
];

export const COACH_PERFORMANCE = [
  { name: 'Dr. Radha Krishnan', clients: 145, revenue: 1250000, rating: 4.9, programs: 12, retention: 92 },
  { name: 'Dr. Anita Bose', clients: 98, revenue: 820000, rating: 4.8, programs: 8, retention: 88 },
  { name: 'Dr. Sunita Jha', clients: 112, revenue: 960000, rating: 4.7, programs: 6, retention: 85 },
];

export const ENGAGEMENT_METRICS = [
  { week: 'W1 Apr', active: 285, messagesSent: 1240, checkIns: 892, dietAdherence: 76 },
  { week: 'W2 Apr', active: 302, messagesSent: 1380, checkIns: 945, dietAdherence: 78 },
  { week: 'W3 Apr', active: 318, messagesSent: 1420, checkIns: 988, dietAdherence: 79 },
  { week: 'W4 Apr', active: 342, messagesSent: 1510, checkIns: 1020, dietAdherence: 81 },
];

export const DIET_CHART_ANALYTICS = [
  { month: 'Nov 25', created: 28, updated: 14, adherence: 72 },
  { month: 'Dec 25', created: 22, updated: 18, adherence: 74 },
  { month: 'Jan 26', created: 35, updated: 22, adherence: 76 },
  { month: 'Feb 26', created: 42, updated: 28, adherence: 77 },
  { month: 'Mar 26', created: 48, updated: 32, adherence: 79 },
  { month: 'Apr 26', created: 55, updated: 38, adherence: 81 },
];

export const REVENUE_BY_COACH = [
  { name: 'Dr. Radha Krishnan', amount: 1250000, pct: 52 },
  { name: 'Dr. Anita Bose', amount: 820000, pct: 34 },
  { name: 'Dr. Sunita Jha', amount: 310000, pct: 14 },
];

export const REVENUE_BY_PAYMENT = [
  { method: 'UPI', amount: 960000, pct: 40 },
  { method: 'Credit Card', amount: 720000, pct: 30 },
  { method: 'Net Banking', amount: 480000, pct: 20 },
  { method: 'Debit Card', amount: 192000, pct: 8 },
  { method: 'Wallets', amount: 48000, pct: 2 },
];

export const PHASE_COMPLETION_DATA = [
  { phase: 'Phase 1', completed: 89, inProgress: 45, notStarted: 8 },
  { phase: 'Phase 2', completed: 72, inProgress: 38, notStarted: 32 },
  { phase: 'Phase 3', completed: 45, inProgress: 28, notStarted: 68 },
  { phase: 'Phase 4', completed: 22, inProgress: 18, notStarted: 102 },
];

export const COLLAB_ANALYTICS = [
  { month: 'Jan 26', collabRevenue: 24500, referralRevenue: 8200 },
  { month: 'Feb 26', collabRevenue: 49200, referralRevenue: 12400 },
  { month: 'Mar 26', collabRevenue: 66800, referralRevenue: 15600 },
  { month: 'Apr 26', collabRevenue: 60000, referralRevenue: 18000 },
];

export const PLATFORM_STATS = {
  totalUsers: 342, usersGrowth: 17.9,
  totalCoaches: 8, coachesGrowth: 14.3,
  totalPrograms: 18, programsGrowth: 12.5,
  totalRevenue: 2780000, revenueGrowth: 8.0,
  activeClients: 285, retentionRate: 91.2,
  avgSessionRating: 4.8, totalSessions: 1240,
};

export const MY_STATS = {
  totalClients: 145, clientsGrowth: 12,
  monthlyRevenue: 285000, revenueGrowth: 8,
  activePrograms: 12, programsGrowth: 2,
  avgEngagement: 82, engagementGrowth: 3,
  messageResponseRate: 94, dietCompliance: 79,
  newClientsThisMonth: 14, churnRate: 3.2,
};
