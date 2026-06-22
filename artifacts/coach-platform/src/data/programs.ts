export type ProgramStatus = 'Active' | 'Draft' | 'Archived';
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type ContentType = 'lesson' | 'assignment' | 'quiz' | 'resource';
export type EnrollmentType = 'open' | 'invite' | 'prerequisite' | 'service-linked';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  duration?: number;
  contentFormat?: 'video' | 'text' | 'pdf';
  questionCount?: number;
  url?: string;
  dueOffset?: number;
}

export interface Phase {
  id: string;
  name: string;
  startWeek: number;
  endWeek: number;
  description: string;
  objectives: string[];
  content: ContentItem[];
}

export interface ProgramClient {
  id: string;
  name: string;
  email: string;
  enrolledDate: string;
  currentPhase: number;
  progress: number;
  lastActive: string;
  dietChartStatus: 'Created' | 'Pending' | 'Not Required';
  status: 'active' | 'inactive' | 'completed';
}

export interface Collaborator {
  id: string;
  name: string;
  initials: string;
  role: string;
  accessLevel: 'View Only' | 'Can Add Content' | 'Full Edit';
  addedDate: string;
  lastActivity: string;
}

export interface DietChartEntry {
  id: string;
  clientName: string;
  title: string;
  status: 'Active' | 'Draft' | 'Needs Review';
  createdAt: string;
  createdBy: string;
}

export interface RecipeEntry {
  id: string;
  name: string;
  category: string;
  calories: number;
  prepTime: number;
  tags: string[];
}

export interface RevenuePoint { month: string; count: number; }
export interface FunnelStage { stage: string; count: number; }
export interface PhaseDropoff { phase: string; retention: number; }
export interface WeeklyEngagement { week: string; activity: number; }

export interface Program {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  categoryColor: string;
  gradientFrom: string;
  gradientTo: string;
  categoryEmoji: string;
  durationValue: number;
  durationUnit: 'weeks' | 'months' | 'days' | 'ongoing';
  price: number;
  isFree: boolean;
  difficulty: DifficultyLevel;
  status: ProgramStatus;
  enrolledCount: number;
  avgCompletion: number;
  rating: number;
  revenue: number;
  coachName: string;
  coachInitials: string;
  createdAt: string;
  updatedAt: string;
  phases: Phase[];
  clients: ProgramClient[];
  collaborators: Collaborator[];
  dietCharts: DietChartEntry[];
  recipes: RecipeEntry[];
  featDietCharts: boolean;
  featRecipeLibrary: boolean;
  featLeaderboard: boolean;
  featClientMessaging: boolean;
  featProgressTracking: boolean;
  featCertificates: boolean;
  featCommunityChannel: boolean;
  enrollmentType: EnrollmentType;
  enrollmentLimit?: number;
  checkInFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  completionThreshold: number;
  enrollmentTrend: RevenuePoint[];
  completionFunnel: FunnelStage[];
  phaseDropoff: PhaseDropoff[];
  weeklyEngagement: WeeklyEngagement[];
}

function makeClients(count: number, phases: number): ProgramClient[] {
  const names = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@gmail.com' },
    { name: 'Priya Mehta', email: 'priya.mehta@yahoo.com' },
    { name: 'Rahul Gupta', email: 'rahul.gupta@gmail.com' },
    { name: 'Sneha Patel', email: 'sneha.patel@gmail.com' },
    { name: 'Vikram Singh', email: 'vikram.singh@outlook.com' },
    { name: 'Kavya Nair', email: 'kavya.nair@gmail.com' },
    { name: 'Arjun Kumar', email: 'arjun.kumar@gmail.com' },
    { name: 'Diya Joshi', email: 'diya.joshi@hotmail.com' },
    { name: 'Rohan Verma', email: 'rohan.verma@gmail.com' },
    { name: 'Ananya Iyer', email: 'ananya.iyer@gmail.com' },
  ];
  return names.slice(0, Math.min(count, 10)).map((p, i) => ({
    id: `cl${i}`,
    name: p.name,
    email: p.email,
    enrolledDate: `2026-0${Math.max(1, 4 - (i % 3))}-${String(5 + i * 2).padStart(2, '0')}`,
    currentPhase: (i % phases) + 1,
    progress: Math.max(10, 95 - i * 9),
    lastActive: i === 0 ? '2 hours ago' : i === 1 ? '1 day ago' : `${i + 1} days ago`,
    dietChartStatus: i % 3 === 0 ? 'Created' : i % 3 === 1 ? 'Pending' : 'Not Required',
    status: i % 7 === 6 ? 'inactive' : i % 9 === 8 ? 'completed' : 'active',
  }));
}

function makeTrend(base: number): RevenuePoint[] {
  return ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((month, i) => ({
    month,
    count: Math.round(base * (0.6 + i * 0.1 + Math.random() * 0.1)),
  }));
}

function makeFunnel(total: number): FunnelStage[] {
  return [
    { stage: 'Enrolled', count: total },
    { stage: 'Started', count: Math.round(total * 0.92) },
    { stage: '25% Done', count: Math.round(total * 0.78) },
    { stage: '50% Done', count: Math.round(total * 0.61) },
    { stage: '75% Done', count: Math.round(total * 0.44) },
    { stage: 'Completed', count: Math.round(total * 0.72) },
  ];
}

const DIET_CHARTS: DietChartEntry[] = [
  { id: 'dc1', clientName: 'Aarav Sharma', title: 'Week 1–2 Detox Plan', status: 'Active', createdAt: '2026-03-15', createdBy: 'Dr. Priya Sharma' },
  { id: 'dc2', clientName: 'Priya Mehta', title: 'PCOS Anti-Inflammatory Diet', status: 'Active', createdAt: '2026-03-20', createdBy: 'Dr. Priya Sharma' },
  { id: 'dc3', clientName: 'Rahul Gupta', title: 'High Protein Muscle Plan', status: 'Draft', createdAt: '2026-04-01', createdBy: 'Neha Kapoor' },
  { id: 'dc4', clientName: 'Sneha Patel', title: 'Diabetic-Friendly Meal Plan', status: 'Needs Review', createdAt: '2026-04-05', createdBy: 'Dr. Priya Sharma' },
];

const RECIPES: RecipeEntry[] = [
  { id: 'r1', name: 'Moong Dal Khichdi', category: 'Lunch', calories: 280, prepTime: 25, tags: ['diabetic-friendly', 'high-protein'] },
  { id: 'r2', name: 'Turmeric Oat Porridge', category: 'Breakfast', calories: 210, prepTime: 10, tags: ['anti-inflammatory', 'PCOS'] },
  { id: 'r3', name: 'Grilled Tandoori Chicken', category: 'Dinner', calories: 320, prepTime: 40, tags: ['high-protein', 'muscle-gain'] },
  { id: 'r4', name: 'Methi Thepla', category: 'Breakfast', calories: 150, prepTime: 20, tags: ['weight-loss', 'diabetic-friendly'] },
  { id: 'r5', name: 'Amla Green Smoothie', category: 'Snack', calories: 95, prepTime: 5, tags: ['detox', 'vitamin-c'] },
];

const COLLABS: Collaborator[] = [
  { id: 'col1', name: 'Neha Kapoor', initials: 'NK', role: 'Nutritionist', accessLevel: 'Can Add Content', addedDate: '2026-02-10', lastActivity: '2 days ago' },
  { id: 'col2', name: 'Dr. Rohan Verma', initials: 'RV', role: 'Coach', accessLevel: 'View Only', addedDate: '2026-03-01', lastActivity: '1 week ago' },
];

function phases4(): Phase[] {
  return [
    {
      id: 'ph1', name: 'Foundation — Weeks 1–3', startWeek: 1, endWeek: 3,
      description: 'Build healthy habits, establish baseline, and set client goals.',
      objectives: ['Assess current diet and lifestyle', 'Eliminate processed foods', 'Establish meal timing'],
      content: [
        { id: 'c1', type: 'lesson', title: 'Introduction to the Program', contentFormat: 'video', duration: 20 },
        { id: 'c2', type: 'lesson', title: 'Understanding Macronutrients', contentFormat: 'video', duration: 35 },
        { id: 'c3', type: 'assignment', title: '3-Day Food Diary', description: 'Log all meals for 3 days', dueOffset: 3 },
        { id: 'c4', type: 'resource', title: 'Indian Food Calorie Guide', url: '#' },
      ],
    },
    {
      id: 'ph2', name: 'Momentum — Weeks 4–6', startWeek: 4, endWeek: 6,
      description: 'Introduce structured meal plans and light exercise protocols.',
      objectives: ['Follow personalised meal plan', 'Add 20 min daily walk', 'Weekly weigh-in and measurements'],
      content: [
        { id: 'c5', type: 'lesson', title: 'Your Personalised Meal Plan', contentFormat: 'pdf', duration: 15 },
        { id: 'c6', type: 'quiz', title: 'Week 4 Nutrition Check', questionCount: 10 },
        { id: 'c7', type: 'assignment', title: 'Progress Photos', description: 'Front, side, and back photos', dueOffset: 14 },
      ],
    },
    {
      id: 'ph3', name: 'Transformation — Weeks 7–9', startWeek: 7, endWeek: 9,
      description: 'Intensify efforts with advanced nutrition strategies and habit stacking.',
      objectives: ['Introduce intermittent fasting window', 'Track hydration daily', 'Explore mindful eating practices'],
      content: [
        { id: 'c8', type: 'lesson', title: 'Intermittent Fasting Basics', contentFormat: 'video', duration: 30 },
        { id: 'c9', type: 'lesson', title: 'Mindful Eating Practices', contentFormat: 'text', duration: 20 },
        { id: 'c10', type: 'assignment', title: 'Mid-Program Body Measurements', dueOffset: 0 },
      ],
    },
    {
      id: 'ph4', name: 'Mastery — Weeks 10–12', startWeek: 10, endWeek: 12,
      description: 'Consolidate results and build long-term sustainable habits.',
      objectives: ['Design your maintenance plan', 'Understand metabolic flexibility', 'Plan for social eating situations'],
      content: [
        { id: 'c11', type: 'lesson', title: 'Maintaining Results Long-Term', contentFormat: 'video', duration: 45 },
        { id: 'c12', type: 'quiz', title: 'Final Knowledge Assessment', questionCount: 20 },
        { id: 'c13', type: 'assignment', title: 'Final Progress Report & Photos', dueOffset: 0 },
        { id: 'c14', type: 'resource', title: 'Maintenance Meal Plan Templates', url: '#' },
      ],
    },
  ];
}

function phases3(): Phase[] {
  return [
    {
      id: 'ph1', name: 'Build — Weeks 1–3', startWeek: 1, endWeek: 3,
      description: 'Establish training baselines and nutrition protocols.',
      objectives: ['Assess strength levels', 'Introduce progressive overload', 'Set protein intake targets'],
      content: [
        { id: 'c1', type: 'lesson', title: 'Principles of Muscle Growth', contentFormat: 'video', duration: 40 },
        { id: 'c2', type: 'lesson', title: 'Calculating Your TDEE', contentFormat: 'text', duration: 15 },
        { id: 'c3', type: 'assignment', title: 'Baseline Strength Test', dueOffset: 3 },
      ],
    },
    {
      id: 'ph2', name: 'Grow — Weeks 4–6', startWeek: 4, endWeek: 6,
      description: 'Peak muscle-building phase with optimised nutrition timing.',
      objectives: ['Increase training volume by 20%', 'Master pre/post workout nutrition', 'Track sleep and recovery'],
      content: [
        { id: 'c4', type: 'lesson', title: 'Nutrient Timing for Hypertrophy', contentFormat: 'video', duration: 35 },
        { id: 'c5', type: 'quiz', title: 'Mid-Program Knowledge Check', questionCount: 12 },
        { id: 'c6', type: 'resource', title: 'High-Protein Indian Recipe Pack', url: '#' },
      ],
    },
    {
      id: 'ph3', name: 'Peak — Weeks 7–8', startWeek: 7, endWeek: 8,
      description: 'Peak phase and body recomposition consolidation.',
      objectives: ['Achieve body composition goals', 'Transition to maintenance', 'Plan future training cycles'],
      content: [
        { id: 'c7', type: 'lesson', title: 'Transitioning to Maintenance', contentFormat: 'video', duration: 25 },
        { id: 'c8', type: 'assignment', title: 'Final Body Composition Measurements', dueOffset: 0 },
        { id: 'c9', type: 'quiz', title: 'Final Assessment', questionCount: 15 },
      ],
    },
  ];
}

function phases2(): Phase[] {
  return [
    {
      id: 'ph1', name: 'Awareness — Week 1–2', startWeek: 1, endWeek: 2,
      description: 'Understand corporate wellness principles and personal health baselines.',
      objectives: ['Complete personal health assessment', 'Identify key health risks', 'Set SMART wellness goals'],
      content: [
        { id: 'c1', type: 'lesson', title: 'Corporate Wellness Introduction', contentFormat: 'video', duration: 20 },
        { id: 'c2', type: 'assignment', title: 'Personal Health Assessment', dueOffset: 5 },
      ],
    },
    {
      id: 'ph2', name: 'Action — Weeks 3–4', startWeek: 3, endWeek: 4,
      description: 'Implement practical wellness strategies in daily work life.',
      objectives: ['Establish desk-friendly exercise routine', 'Improve lunch choices', 'Reduce screen time and stress'],
      content: [
        { id: 'c3', type: 'lesson', title: 'Healthy Eating at Work', contentFormat: 'text', duration: 15 },
        { id: 'c4', type: 'quiz', title: 'Wellness Knowledge Quiz', questionCount: 8 },
        { id: 'c5', type: 'resource', title: 'Office Meal Prep Guide', url: '#' },
      ],
    },
  ];
}

export const MOCK_PROGRAMS: Program[] = [
  {
    id: 'prog-001',
    name: 'Transform 90',
    shortDescription: 'A science-backed 90-day weight loss programme combining personalised nutrition, mindset coaching, and daily accountability check-ins.',
    fullDescription: 'Transform 90 is our flagship weight loss programme trusted by 156 clients. Across 12 weeks and 4 progressive phases, you\'ll receive personalised meal plans, weekly group coaching calls, daily check-ins, and evidence-based nutrition education. Designed by Dr. Priya Sharma with 10+ years of clinical nutrition expertise.',
    category: 'Weight Loss',
    categoryColor: 'bg-blue-100 text-blue-700',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-400',
    categoryEmoji: '🏃',
    durationValue: 12,
    durationUnit: 'weeks',
    price: 4999,
    isFree: false,
    difficulty: 'Intermediate',
    status: 'Active',
    enrolledCount: 156,
    avgCompletion: 72,
    rating: 4.8,
    revenue: 779844,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2025-10-01',
    updatedAt: '2026-04-10',
    phases: phases4(),
    clients: makeClients(10, 4),
    collaborators: COLLABS,
    dietCharts: DIET_CHARTS,
    recipes: RECIPES,
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: true,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: true,
    featCommunityChannel: true,
    enrollmentType: 'service-linked',
    checkInFrequency: 'daily',
    completionThreshold: 90,
    enrollmentTrend: makeTrend(25),
    completionFunnel: makeFunnel(156),
    phaseDropoff: [
      { phase: 'Foundation', retention: 100 },
      { phase: 'Momentum', retention: 84 },
      { phase: 'Transformation', retention: 71 },
      { phase: 'Mastery', retention: 72 },
    ],
    weeklyEngagement: Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, activity: 60 + Math.round(Math.sin(i) * 20 + Math.random() * 15) })),
  },
  {
    id: 'prog-002',
    name: 'PCOS Wellness Journey',
    shortDescription: 'A holistic 16-week programme targeting hormonal balance, inflammation, and sustainable lifestyle change for women with PCOS.',
    fullDescription: 'A comprehensive programme designed specifically for women managing PCOS. Covers anti-inflammatory nutrition, hormone-balancing meal timing, stress management, and symptom tracking across 5 carefully structured phases.',
    category: 'Disease Management',
    categoryColor: 'bg-purple-100 text-purple-700',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-400',
    categoryEmoji: '🌸',
    durationValue: 16,
    durationUnit: 'weeks',
    price: 6999,
    isFree: false,
    difficulty: 'Beginner',
    status: 'Active',
    enrolledCount: 89,
    avgCompletion: 68,
    rating: 4.9,
    revenue: 623111,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2025-08-15',
    updatedAt: '2026-04-05',
    phases: [
      ...phases4().map((p, i) => ({ ...p, id: `pcos-ph${i + 1}` })),
      {
        id: 'pcos-ph5', name: 'Sustain — Weeks 13–16', startWeek: 13, endWeek: 16,
        description: 'Long-term hormonal health and lifestyle integration.',
        objectives: ['Manage symptoms independently', 'Plan long-term nutrition strategy', 'Build support community connections'],
        content: [
          { id: 'pcos-c1', type: 'lesson', title: 'Long-Term Hormonal Health', contentFormat: 'video', duration: 40 },
          { id: 'pcos-c2', type: 'assignment', title: 'Create Your Wellness Blueprint', dueOffset: 7 },
        ],
      },
    ],
    clients: makeClients(9, 5),
    collaborators: [COLLABS[0]],
    dietCharts: DIET_CHARTS.slice(0, 2),
    recipes: RECIPES.slice(0, 3),
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: true,
    featCommunityChannel: true,
    enrollmentType: 'service-linked',
    checkInFrequency: 'weekly',
    completionThreshold: 85,
    enrollmentTrend: makeTrend(14),
    completionFunnel: makeFunnel(89),
    phaseDropoff: [
      { phase: 'Foundation', retention: 100 },
      { phase: 'Awareness', retention: 90 },
      { phase: 'Balance', retention: 77 },
      { phase: 'Restore', retention: 69 },
      { phase: 'Sustain', retention: 68 },
    ],
    weeklyEngagement: Array.from({ length: 16 }, (_, i) => ({ week: `W${i + 1}`, activity: 55 + Math.round(Math.sin(i * 0.8) * 18 + Math.random() * 12) })),
  },
  {
    id: 'prog-003',
    name: 'Muscle Building Pro',
    shortDescription: 'An 8-week progressive overload programme with high-protein Indian meal plans, strength tracking, and bi-weekly coach reviews.',
    fullDescription: 'Transform your physique in 8 weeks with our science-driven muscle building programme. Includes structured progressive overload training plans, macronutrient optimisation, supplement guidance, and regular coach check-ins.',
    category: 'Muscle Gain',
    categoryColor: 'bg-orange-100 text-orange-700',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-amber-400',
    categoryEmoji: '💪',
    durationValue: 8,
    durationUnit: 'weeks',
    price: 3499,
    isFree: false,
    difficulty: 'Advanced',
    status: 'Active',
    enrolledCount: 67,
    avgCompletion: 81,
    rating: 4.7,
    revenue: 234433,
    coachName: 'Arjun Mehta',
    coachInitials: 'AM',
    createdAt: '2025-09-01',
    updatedAt: '2026-03-28',
    phases: phases3(),
    clients: makeClients(8, 3),
    collaborators: [],
    dietCharts: DIET_CHARTS.slice(2, 4),
    recipes: RECIPES.slice(2, 5),
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: true,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: false,
    featCommunityChannel: false,
    enrollmentType: 'open',
    checkInFrequency: 'weekly',
    completionThreshold: 80,
    enrollmentTrend: makeTrend(10),
    completionFunnel: makeFunnel(67),
    phaseDropoff: [
      { phase: 'Build', retention: 100 },
      { phase: 'Grow', retention: 88 },
      { phase: 'Peak', retention: 81 },
    ],
    weeklyEngagement: Array.from({ length: 8 }, (_, i) => ({ week: `W${i + 1}`, activity: 70 + Math.round(Math.sin(i) * 15 + Math.random() * 10) })),
  },
  {
    id: 'prog-004',
    name: 'Mindful Eating Mastery',
    shortDescription: 'A 6-week wellness programme that helps you break emotional eating patterns and build a healthier relationship with food.',
    fullDescription: 'Mindful Eating Mastery uses evidence-based mindfulness techniques, cognitive reframing, and nutritional psychology to help clients overcome emotional and stress-related eating. Suitable for all fitness levels.',
    category: 'Wellness',
    categoryColor: 'bg-green-100 text-green-700',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-teal-400',
    categoryEmoji: '🧘',
    durationValue: 6,
    durationUnit: 'weeks',
    price: 1999,
    isFree: false,
    difficulty: 'Beginner',
    status: 'Active',
    enrolledCount: 45,
    avgCompletion: 76,
    rating: 4.6,
    revenue: 89955,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2025-11-01',
    updatedAt: '2026-04-01',
    phases: phases3().slice(0, 3).map((p, i) => ({ ...p, id: `mind-ph${i + 1}`, endWeek: i * 2 + 2, startWeek: i * 2 + 1 })),
    clients: makeClients(7, 3),
    collaborators: [COLLABS[1]],
    dietCharts: DIET_CHARTS.slice(0, 2),
    recipes: RECIPES.slice(0, 3),
    featDietCharts: false,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: true,
    featCommunityChannel: true,
    enrollmentType: 'open',
    checkInFrequency: 'weekly',
    completionThreshold: 80,
    enrollmentTrend: makeTrend(8),
    completionFunnel: makeFunnel(45),
    phaseDropoff: [
      { phase: 'Awareness', retention: 100 },
      { phase: 'Practice', retention: 84 },
      { phase: 'Mastery', retention: 76 },
    ],
    weeklyEngagement: Array.from({ length: 6 }, (_, i) => ({ week: `W${i + 1}`, activity: 65 + Math.round(Math.sin(i) * 12 + Math.random() * 8) })),
  },
  {
    id: 'prog-005',
    name: 'Diabetic Diet Control',
    shortDescription: 'An ongoing evidence-based programme for managing blood sugar through precision nutrition, portion control, and glycaemic monitoring.',
    fullDescription: 'Designed for Type 2 diabetics, pre-diabetics, and those with insulin resistance. This ongoing programme provides monthly structured modules, a curated low-GI recipe library, and personalised diet charts based on regular blood sugar readings.',
    category: 'Disease Management',
    categoryColor: 'bg-red-100 text-red-700',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-rose-400',
    categoryEmoji: '🩺',
    durationValue: 0,
    durationUnit: 'ongoing',
    price: 2999,
    isFree: false,
    difficulty: 'Intermediate',
    status: 'Active',
    enrolledCount: 34,
    avgCompletion: 55,
    rating: 4.7,
    revenue: 101966,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2025-11-15',
    updatedAt: '2026-04-08',
    phases: phases4().map((p, i) => ({ ...p, id: `diab-ph${i + 1}` })),
    clients: makeClients(6, 4),
    collaborators: COLLABS,
    dietCharts: DIET_CHARTS,
    recipes: RECIPES,
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: false,
    featCommunityChannel: false,
    enrollmentType: 'invite',
    checkInFrequency: 'weekly',
    completionThreshold: 75,
    enrollmentTrend: makeTrend(5),
    completionFunnel: makeFunnel(34),
    phaseDropoff: [
      { phase: 'Foundation', retention: 100 },
      { phase: 'Control', retention: 79 },
      { phase: 'Optimise', retention: 62 },
      { phase: 'Sustain', retention: 55 },
    ],
    weeklyEngagement: Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, activity: 50 + Math.round(Math.sin(i * 0.6) * 15 + Math.random() * 10) })),
  },
  {
    id: 'prog-006',
    name: 'Pre-Pregnancy Prep',
    shortDescription: 'A 12-week programme to optimise nutritional status, hormonal balance, and overall health before conception.',
    fullDescription: 'Designed for women planning pregnancy within 3–12 months, this programme covers preconception nutrition, folate-rich meal planning, supplement guidance, stress management, and fertility-supporting lifestyle habits.',
    category: 'Prenatal',
    categoryColor: 'bg-pink-100 text-pink-700',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-rose-300',
    categoryEmoji: '🤰',
    durationValue: 12,
    durationUnit: 'weeks',
    price: 5999,
    isFree: false,
    difficulty: 'Beginner',
    status: 'Active',
    enrolledCount: 28,
    avgCompletion: 83,
    rating: 4.9,
    revenue: 167972,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2025-12-01',
    updatedAt: '2026-04-02',
    phases: phases4().map((p, i) => ({ ...p, id: `preg-ph${i + 1}` })),
    clients: makeClients(6, 4),
    collaborators: [COLLABS[0]],
    dietCharts: DIET_CHARTS.slice(0, 2),
    recipes: RECIPES.slice(1, 4),
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: true,
    featCommunityChannel: true,
    enrollmentType: 'invite',
    checkInFrequency: 'weekly',
    completionThreshold: 90,
    enrollmentTrend: makeTrend(4),
    completionFunnel: makeFunnel(28),
    phaseDropoff: [
      { phase: 'Foundation', retention: 100 },
      { phase: 'Nourish', retention: 93 },
      { phase: 'Optimise', retention: 87 },
      { phase: 'Prepare', retention: 83 },
    ],
    weeklyEngagement: Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, activity: 72 + Math.round(Math.sin(i * 0.7) * 12 + Math.random() * 8) })),
  },
  {
    id: 'prog-007',
    name: 'Corporate Wellness 101',
    shortDescription: 'A 4-week introductory wellness programme designed for busy professionals — healthy eating, stress management, and energy optimisation.',
    fullDescription: 'Built for corporates and their teams, this 4-week programme delivers practical, achievable wellness improvements for busy professionals. Covers desk-friendly nutrition, energy management, sleep hygiene, and stress reduction techniques.',
    category: 'Wellness',
    categoryColor: 'bg-green-100 text-green-700',
    gradientFrom: 'from-slate-500',
    gradientTo: 'to-gray-400',
    categoryEmoji: '🏢',
    durationValue: 4,
    durationUnit: 'weeks',
    price: 0,
    isFree: true,
    difficulty: 'Beginner',
    status: 'Draft',
    enrolledCount: 12,
    avgCompletion: 40,
    rating: 0,
    revenue: 0,
    coachName: 'Neha Kapoor',
    coachInitials: 'NK',
    createdAt: '2026-03-15',
    updatedAt: '2026-04-20',
    phases: phases2(),
    clients: makeClients(3, 2),
    collaborators: [],
    dietCharts: [],
    recipes: RECIPES.slice(0, 2),
    featDietCharts: false,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: false,
    featCertificates: false,
    featCommunityChannel: false,
    enrollmentType: 'open',
    checkInFrequency: 'weekly',
    completionThreshold: 80,
    enrollmentTrend: makeTrend(2),
    completionFunnel: makeFunnel(12),
    phaseDropoff: [
      { phase: 'Awareness', retention: 100 },
      { phase: 'Action', retention: 40 },
    ],
    weeklyEngagement: Array.from({ length: 4 }, (_, i) => ({ week: `W${i + 1}`, activity: 40 + Math.round(Math.random() * 20) })),
  },
  {
    id: 'prog-008',
    name: 'Yoga & Nutrition Fusion',
    shortDescription: 'An 8-week programme blending yoga philosophy, Ayurvedic nutrition principles, and modern dietetics for holistic wellness.',
    fullDescription: 'Yoga & Nutrition Fusion combines ancient Indian wellness wisdom with modern nutritional science. Clients will explore Ayurvedic body types, seasonal eating, yoga-supportive foods, and stress-reducing breathwork practices.',
    category: 'Wellness',
    categoryColor: 'bg-green-100 text-green-700',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-indigo-400',
    categoryEmoji: '🧘‍♀️',
    durationValue: 8,
    durationUnit: 'weeks',
    price: 2499,
    isFree: false,
    difficulty: 'Beginner',
    status: 'Draft',
    enrolledCount: 0,
    avgCompletion: 0,
    rating: 0,
    revenue: 0,
    coachName: 'Dr. Priya Sharma',
    coachInitials: 'PS',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-22',
    phases: phases3(),
    clients: [],
    collaborators: [],
    dietCharts: [],
    recipes: RECIPES.slice(1, 3),
    featDietCharts: true,
    featRecipeLibrary: true,
    featLeaderboard: false,
    featClientMessaging: true,
    featProgressTracking: true,
    featCertificates: true,
    featCommunityChannel: true,
    enrollmentType: 'open',
    checkInFrequency: 'weekly',
    completionThreshold: 80,
    enrollmentTrend: makeTrend(0),
    completionFunnel: makeFunnel(0),
    phaseDropoff: [
      { phase: 'Foundation', retention: 0 },
      { phase: 'Deepen', retention: 0 },
      { phase: 'Integrate', retention: 0 },
    ],
    weeklyEngagement: Array.from({ length: 8 }, (_, i) => ({ week: `W${i + 1}`, activity: 0 })),
  },
];

export function getDurationLabel(p: Program): string {
  if (p.durationUnit === 'ongoing') return 'Ongoing';
  return `${p.durationValue} ${p.durationUnit}`;
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
