export type HealthGoal = 'Weight Loss' | 'Muscle Gain' | 'Diabetes Management' | 'PCOS Management' | 'Thyroid' | 'Heart Health' | 'Gut Health' | 'General Wellness';
export type DietChartStatus = 'Active' | 'Needs Update' | 'None';
export type ClientStatus = 'Active' | 'Inactive' | 'Completed';

export interface Measurement {
  date: string;
  weight: number;
  waist?: number;
  hip?: number;
  chest?: number;
  bmi?: number;
}

export interface ClientNote {
  id: string;
  text: string;
  author: string;
  authorRole: string;
  timestamp: string;
  pinned: boolean;
}

export interface ActivityEntry {
  id: string;
  type: 'enrollment' | 'diet_change' | 'message' | 'checkin' | 'recipe' | 'program_phase';
  description: string;
  timestamp: string;
  icon: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  initials: string;
  color: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  height: number;
  weight: number;
  targetWeight: number;
  bmi: number;
  healthGoal: HealthGoal;
  healthConditions: string[];
  allergies: string[];
  dietaryPreference: 'Vegetarian' | 'Non-Vegetarian' | 'Vegan' | 'Eggetarian';
  programs: string[];
  currentPhase: string;
  dietChartStatus: DietChartStatus;
  lastActive: string;
  enrolledSince: string;
  status: ClientStatus;
  completionPct: number;
  engagementScore: number;
  adherenceScore: number;
  measurements: Measurement[];
  notes: ClientNote[];
  activityLog: ActivityEntry[];
  goalTimeline: string;
  coach: string;
}

export const CLIENTS: Client[] = [
  {
    id: 'c-001', name: 'Arjun Mehta', email: 'arjun.mehta@gmail.com', phone: '+91 98765 43210',
    avatar: '', initials: 'AM', color: 'bg-blue-500',
    age: 34, gender: 'Male', height: 175, weight: 82, targetWeight: 72, bmi: 26.8,
    healthGoal: 'Weight Loss', healthConditions: ['Pre-diabetes', 'Hypertension'],
    allergies: ['Peanuts'], dietaryPreference: 'Non-Vegetarian',
    programs: ['Weight Loss Intensive', 'Diabetes Prevention'],
    currentPhase: 'Phase 2: Active Fat Burn', dietChartStatus: 'Active',
    lastActive: '2 hours ago', enrolledSince: 'Jan 15, 2026', status: 'Active',
    completionPct: 62, engagementScore: 87, adherenceScore: 78,
    goalTimeline: '6 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Jan 15', weight: 88, waist: 98, hip: 102, bmi: 28.7 },
      { date: 'Feb 1', weight: 86, waist: 96, hip: 100, bmi: 28.1 },
      { date: 'Feb 15', weight: 85, waist: 94, hip: 99, bmi: 27.8 },
      { date: 'Mar 1', weight: 84, waist: 92, hip: 98, bmi: 27.4 },
      { date: 'Mar 15', weight: 83, waist: 90, hip: 97, bmi: 27.1 },
      { date: 'Apr 1', weight: 82, waist: 89, hip: 96, bmi: 26.8 },
    ],
    notes: [
      { id: 'n-1', text: 'Arjun is very motivated. Needs reminders for evening workouts. Pre-diabetic markers improving.', author: 'Dr. Radha', authorRole: 'Coach', timestamp: 'Apr 20, 2026 at 3:14 PM', pinned: true },
      { id: 'n-2', text: 'Updated diet chart to reduce refined carbs. Discussed importance of fiber intake.', author: 'Neha Kapoor', authorRole: 'Nutritionist', timestamp: 'Apr 10, 2026 at 11:00 AM', pinned: false },
    ],
    activityLog: [
      { id: 'a-1', type: 'message', description: 'Sent message about supplement timing', timestamp: '2 hours ago', icon: 'message' },
      { id: 'a-2', type: 'checkin', description: 'Completed weekly check-in', timestamp: '1 day ago', icon: 'checkin' },
      { id: 'a-3', type: 'diet_change', description: 'Diet chart updated by Neha Kapoor', timestamp: 'Apr 10, 2026', icon: 'diet' },
      { id: 'a-4', type: 'program_phase', description: 'Moved to Phase 2: Active Fat Burn', timestamp: 'Mar 15, 2026', icon: 'program' },
      { id: 'a-5', type: 'enrollment', description: 'Enrolled in Weight Loss Intensive', timestamp: 'Jan 15, 2026', icon: 'enrollment' },
    ],
  },
  {
    id: 'c-002', name: 'Priya Sharma', email: 'priya.sharma@outlook.com', phone: '+91 87654 32109',
    avatar: '', initials: 'PS', color: 'bg-pink-500',
    age: 28, gender: 'Female', height: 162, weight: 68, targetWeight: 58, bmi: 25.9,
    healthGoal: 'PCOS Management', healthConditions: ['PCOS', 'Insulin Resistance'],
    allergies: ['Gluten'], dietaryPreference: 'Vegetarian',
    programs: ['PCOS Reversal Program'],
    currentPhase: 'Phase 1: Hormonal Reset', dietChartStatus: 'Active',
    lastActive: '30 min ago', enrolledSince: 'Feb 3, 2026', status: 'Active',
    completionPct: 45, engagementScore: 92, adherenceScore: 85,
    goalTimeline: '12 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Feb 3', weight: 72, waist: 86, hip: 96, bmi: 27.4 },
      { date: 'Feb 20', weight: 71, waist: 85, hip: 95, bmi: 27.1 },
      { date: 'Mar 5', weight: 70, waist: 84, hip: 94, bmi: 26.7 },
      { date: 'Mar 20', weight: 69, waist: 83, hip: 93, bmi: 26.3 },
      { date: 'Apr 5', weight: 68, waist: 82, hip: 92, bmi: 25.9 },
    ],
    notes: [
      { id: 'n-3', text: 'Excellent adherence. Periods regularizing. Continue current protocol.', author: 'Dr. Radha', authorRole: 'Coach', timestamp: 'Apr 18, 2026 at 10:00 AM', pinned: true },
    ],
    activityLog: [
      { id: 'a-6', type: 'checkin', description: 'Completed weekly check-in', timestamp: '30 min ago', icon: 'checkin' },
      { id: 'a-7', type: 'recipe', description: 'Tried Moong Dal Chilla recipe', timestamp: 'Yesterday', icon: 'recipe' },
      { id: 'a-8', type: 'enrollment', description: 'Enrolled in PCOS Reversal Program', timestamp: 'Feb 3, 2026', icon: 'enrollment' },
    ],
  },
  {
    id: 'c-003', name: 'Rahul Verma', email: 'rahul.v@gmail.com', phone: '+91 76543 21098',
    avatar: '', initials: 'RV', color: 'bg-green-500',
    age: 45, gender: 'Male', height: 170, weight: 90, targetWeight: 78, bmi: 31.1,
    healthGoal: 'Diabetes Management', healthConditions: ['Type 2 Diabetes', 'Fatty Liver'],
    allergies: [], dietaryPreference: 'Non-Vegetarian',
    programs: ['Diabetes Control Program'],
    currentPhase: 'Phase 3: Stabilization', dietChartStatus: 'Needs Update',
    lastActive: '1 day ago', enrolledSince: 'Oct 10, 2025', status: 'Active',
    completionPct: 80, engagementScore: 74, adherenceScore: 71,
    goalTimeline: '18 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Oct 10', weight: 98, waist: 108, bmi: 33.9 },
      { date: 'Nov 10', weight: 96, waist: 106, bmi: 33.2 },
      { date: 'Dec 10', weight: 94, waist: 104, bmi: 32.5 },
      { date: 'Jan 10', weight: 93, waist: 103, bmi: 32.2 },
      { date: 'Feb 10', weight: 91, waist: 101, bmi: 31.5 },
      { date: 'Mar 10', weight: 90, waist: 100, bmi: 31.1 },
    ],
    notes: [],
    activityLog: [
      { id: 'a-9', type: 'checkin', description: 'Weekly check-in submitted', timestamp: '1 day ago', icon: 'checkin' },
      { id: 'a-10', type: 'program_phase', description: 'Advanced to Phase 3: Stabilization', timestamp: 'Feb 10, 2026', icon: 'program' },
    ],
  },
  {
    id: 'c-004', name: 'Anjali Singh', email: 'anjali.singh@yahoo.com', phone: '+91 65432 10987',
    avatar: '', initials: 'AS', color: 'bg-purple-500',
    age: 32, gender: 'Female', height: 158, weight: 55, targetWeight: 62, bmi: 22.0,
    healthGoal: 'Muscle Gain', healthConditions: ['Anemia'], allergies: ['Dairy'],
    dietaryPreference: 'Eggetarian',
    programs: ['Strength & Lean Mass Program'],
    currentPhase: 'Phase 2: Progressive Overload', dietChartStatus: 'Active',
    lastActive: '3 hours ago', enrolledSince: 'Mar 1, 2026', status: 'Active',
    completionPct: 28, engagementScore: 95, adherenceScore: 91,
    goalTimeline: '8 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Mar 1', weight: 53, bmi: 21.2 },
      { date: 'Mar 15', weight: 54, bmi: 21.6 },
      { date: 'Apr 1', weight: 55, bmi: 22.0 },
    ],
    notes: [
      { id: 'n-4', text: 'Iron levels improving. Increase protein target to 100g/day.', author: 'Dr. Radha', authorRole: 'Coach', timestamp: 'Apr 15, 2026', pinned: false },
    ],
    activityLog: [
      { id: 'a-11', type: 'checkin', description: 'Check-in completed', timestamp: '3 hours ago', icon: 'checkin' },
    ],
  },
  {
    id: 'c-005', name: 'Vikram Nair', email: 'vikram.nair@gmail.com', phone: '+91 54321 09876',
    avatar: '', initials: 'VN', color: 'bg-orange-500',
    age: 52, gender: 'Male', height: 172, weight: 78, targetWeight: 70, bmi: 26.4,
    healthGoal: 'Heart Health', healthConditions: ['High Cholesterol', 'Hypertension'],
    allergies: ['Shellfish'], dietaryPreference: 'Non-Vegetarian',
    programs: ['Heart Health Protocol'],
    currentPhase: 'Phase 1: Foundation', dietChartStatus: 'Active',
    lastActive: '5 hours ago', enrolledSince: 'Apr 1, 2026', status: 'Active',
    completionPct: 15, engagementScore: 80, adherenceScore: 76,
    goalTimeline: '12 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Apr 1', weight: 80, bmi: 27.0 },
      { date: 'Apr 15', weight: 78, bmi: 26.4 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-006', name: 'Sunita Reddy', email: 'sunita.reddy@gmail.com', phone: '+91 43210 98765',
    avatar: '', initials: 'SR', color: 'bg-teal-500',
    age: 39, gender: 'Female', height: 160, weight: 72, targetWeight: 62, bmi: 28.1,
    healthGoal: 'Thyroid', healthConditions: ['Hypothyroidism'], allergies: [],
    dietaryPreference: 'Vegetarian',
    programs: ['Thyroid Balance Program'],
    currentPhase: 'Phase 2: Metabolism Boost', dietChartStatus: 'Needs Update',
    lastActive: '2 days ago', enrolledSince: 'Dec 5, 2025', status: 'Active',
    completionPct: 70, engagementScore: 68, adherenceScore: 65,
    goalTimeline: '12 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Dec 5', weight: 78, bmi: 30.5 },
      { date: 'Jan 5', weight: 76, bmi: 29.7 },
      { date: 'Feb 5', weight: 75, bmi: 29.3 },
      { date: 'Mar 5', weight: 73, bmi: 28.5 },
      { date: 'Apr 5', weight: 72, bmi: 28.1 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-007', name: 'Kartik Joshi', email: 'kartik.j@outlook.com', phone: '+91 32109 87654',
    avatar: '', initials: 'KJ', color: 'bg-red-500',
    age: 26, gender: 'Male', height: 178, weight: 65, targetWeight: 72, bmi: 20.5,
    healthGoal: 'Muscle Gain', healthConditions: [], allergies: [],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['Bulking Program'],
    currentPhase: 'Phase 1: Volume Building', dietChartStatus: 'Active',
    lastActive: '1 hour ago', enrolledSince: 'Mar 20, 2026', status: 'Active',
    completionPct: 22, engagementScore: 98, adherenceScore: 94,
    goalTimeline: '6 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Mar 20', weight: 63, bmi: 19.9 },
      { date: 'Apr 5', weight: 64, bmi: 20.2 },
      { date: 'Apr 15', weight: 65, bmi: 20.5 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-008', name: 'Meera Pillai', email: 'meera.pillai@gmail.com', phone: '+91 21098 76543',
    avatar: '', initials: 'MP', color: 'bg-indigo-500',
    age: 44, gender: 'Female', height: 155, weight: 80, targetWeight: 65, bmi: 33.3,
    healthGoal: 'Gut Health', healthConditions: ['IBS', 'Bloating'], allergies: ['Lactose'],
    dietaryPreference: 'Vegetarian',
    programs: ['Gut Reset Program'],
    currentPhase: 'Phase 1: Elimination', dietChartStatus: 'Active',
    lastActive: '4 hours ago', enrolledSince: 'Feb 20, 2026', status: 'Active',
    completionPct: 38, engagementScore: 82, adherenceScore: 79,
    goalTimeline: '9 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Feb 20', weight: 83, bmi: 34.6 },
      { date: 'Mar 5', weight: 82, bmi: 34.1 },
      { date: 'Mar 20', weight: 81, bmi: 33.7 },
      { date: 'Apr 5', weight: 80, bmi: 33.3 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-009', name: 'Deepak Agarwal', email: 'deepak.a@gmail.com', phone: '+91 10987 65432',
    avatar: '', initials: 'DA', color: 'bg-yellow-600',
    age: 38, gender: 'Male', height: 168, weight: 88, targetWeight: 76, bmi: 31.2,
    healthGoal: 'Weight Loss', healthConditions: ['Sleep Apnea'], allergies: [],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['Weight Loss Intensive'],
    currentPhase: 'Phase 1: Kickstart', dietChartStatus: 'Active',
    lastActive: '6 hours ago', enrolledSince: 'Apr 10, 2026', status: 'Active',
    completionPct: 12, engagementScore: 75, adherenceScore: 70,
    goalTimeline: '8 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Apr 10', weight: 90, bmi: 31.9 },
      { date: 'Apr 20', weight: 88, bmi: 31.2 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-010', name: 'Lakshmi Rao', email: 'lakshmi.rao@gmail.com', phone: '+91 98760 12345',
    avatar: '', initials: 'LR', color: 'bg-rose-500',
    age: 55, gender: 'Female', height: 152, weight: 66, targetWeight: 58, bmi: 28.6,
    healthGoal: 'General Wellness', healthConditions: ['Osteoporosis'], allergies: [],
    dietaryPreference: 'Vegetarian',
    programs: ['Senior Wellness Program'],
    currentPhase: 'Phase 2: Strength & Balance', dietChartStatus: 'Active',
    lastActive: '1 day ago', enrolledSince: 'Nov 1, 2025', status: 'Active',
    completionPct: 75, engagementScore: 85, adherenceScore: 83,
    goalTimeline: 'Ongoing',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Nov 1', weight: 70, bmi: 30.3 },
      { date: 'Dec 1', weight: 69, bmi: 29.9 },
      { date: 'Jan 1', weight: 68, bmi: 29.5 },
      { date: 'Feb 1', weight: 67, bmi: 29.0 },
      { date: 'Mar 1', weight: 66.5, bmi: 28.8 },
      { date: 'Apr 1', weight: 66, bmi: 28.6 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-011', name: 'Rohan Gupta', email: 'rohan.g@gmail.com', phone: '+91 87651 23456',
    avatar: '', initials: 'RG', color: 'bg-cyan-500',
    age: 30, gender: 'Male', height: 180, weight: 76, targetWeight: 80, bmi: 23.5,
    healthGoal: 'Muscle Gain', healthConditions: [], allergies: [],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['Athletic Performance'],
    currentPhase: 'Phase 3: Peak Performance', dietChartStatus: 'Active',
    lastActive: '20 min ago', enrolledSince: 'Sep 1, 2025', status: 'Active',
    completionPct: 88, engagementScore: 96, adherenceScore: 92,
    goalTimeline: '12 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Sep 1', weight: 70, bmi: 21.6 },
      { date: 'Oct 1', weight: 72, bmi: 22.2 },
      { date: 'Nov 1', weight: 73, bmi: 22.5 },
      { date: 'Dec 1', weight: 74, bmi: 22.8 },
      { date: 'Jan 1', weight: 75, bmi: 23.1 },
      { date: 'Feb 1', weight: 76, bmi: 23.5 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-012', name: 'Kavitha Nambiar', email: 'kavitha.n@gmail.com', phone: '+91 76542 34567',
    avatar: '', initials: 'KN', color: 'bg-fuchsia-500',
    age: 35, gender: 'Female', height: 163, weight: 74, targetWeight: 64, bmi: 27.8,
    healthGoal: 'PCOS Management', healthConditions: ['PCOS', 'Acne'], allergies: ['Soy'],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['PCOS Reversal Program'],
    currentPhase: 'Phase 2: Anti-Inflammatory', dietChartStatus: 'Active',
    lastActive: '3 hours ago', enrolledSince: 'Jan 5, 2026', status: 'Active',
    completionPct: 55, engagementScore: 88, adherenceScore: 82,
    goalTimeline: '10 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Jan 5', weight: 79, bmi: 29.7 },
      { date: 'Feb 5', weight: 77, bmi: 29.0 },
      { date: 'Mar 5', weight: 76, bmi: 28.6 },
      { date: 'Apr 5', weight: 74, bmi: 27.8 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-013', name: 'Suresh Kumar', email: 'suresh.k@gmail.com', phone: '+91 65431 45678',
    avatar: '', initials: 'SK', color: 'bg-lime-600',
    age: 48, gender: 'Male', height: 165, weight: 84, targetWeight: 74, bmi: 30.9,
    healthGoal: 'Diabetes Management', healthConditions: ['Type 2 Diabetes', 'Hypertension'],
    allergies: [], dietaryPreference: 'Vegetarian',
    programs: ['Diabetes Control Program'],
    currentPhase: 'Phase 2: Medication Reduction', dietChartStatus: 'Needs Update',
    lastActive: '3 days ago', enrolledSince: 'Aug 15, 2025', status: 'Inactive',
    completionPct: 65, engagementScore: 55, adherenceScore: 60,
    goalTimeline: '18 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Aug 15', weight: 92, bmi: 33.8 },
      { date: 'Oct 15', weight: 89, bmi: 32.7 },
      { date: 'Dec 15', weight: 87, bmi: 32.0 },
      { date: 'Feb 15', weight: 85, bmi: 31.2 },
      { date: 'Apr 15', weight: 84, bmi: 30.9 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-014', name: 'Ananya Chatterjee', email: 'ananya.c@gmail.com', phone: '+91 54320 56789',
    avatar: '', initials: 'AC', color: 'bg-violet-500',
    age: 22, gender: 'Female', height: 160, weight: 48, targetWeight: 52, bmi: 18.8,
    healthGoal: 'General Wellness', healthConditions: ['Underweight'], allergies: [],
    dietaryPreference: 'Vegetarian',
    programs: ['Healthy Weight Gain'],
    currentPhase: 'Phase 1: Caloric Surplus', dietChartStatus: 'Active',
    lastActive: '12 hours ago', enrolledSince: 'Mar 10, 2026', status: 'Active',
    completionPct: 25, engagementScore: 90, adherenceScore: 88,
    goalTimeline: '6 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Mar 10', weight: 47, bmi: 18.4 },
      { date: 'Mar 25', weight: 47.5, bmi: 18.6 },
      { date: 'Apr 10', weight: 48, bmi: 18.8 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-015', name: 'Mohan Iyer', email: 'mohan.iyer@gmail.com', phone: '+91 43219 67890',
    avatar: '', initials: 'MI', color: 'bg-amber-600',
    age: 61, gender: 'Male', height: 167, weight: 75, targetWeight: 70, bmi: 26.9,
    healthGoal: 'Heart Health', healthConditions: ['Post-bypass surgery'], allergies: ['Nuts'],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['Cardiac Recovery Program'],
    currentPhase: 'Phase 3: Long-term Maintenance', dietChartStatus: 'Active',
    lastActive: '1 day ago', enrolledSince: 'Jul 1, 2025', status: 'Completed',
    completionPct: 100, engagementScore: 78, adherenceScore: 80,
    goalTimeline: '12 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Jul 1', weight: 80, bmi: 28.7 },
      { date: 'Sep 1', weight: 78, bmi: 28.0 },
      { date: 'Nov 1', weight: 77, bmi: 27.6 },
      { date: 'Jan 1', weight: 76, bmi: 27.3 },
      { date: 'Mar 1', weight: 75, bmi: 26.9 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-016', name: 'Pooja Menon', email: 'pooja.menon@gmail.com', phone: '+91 32108 78901',
    avatar: '', initials: 'PM', color: 'bg-emerald-500',
    age: 29, gender: 'Female', height: 165, weight: 62, targetWeight: 58, bmi: 22.8,
    healthGoal: 'Weight Loss', healthConditions: [], allergies: [],
    dietaryPreference: 'Vegetarian',
    programs: ['Lean & Toned Program'],
    currentPhase: 'Phase 2: Toning', dietChartStatus: 'Active',
    lastActive: '45 min ago', enrolledSince: 'Feb 15, 2026', status: 'Active',
    completionPct: 42, engagementScore: 91, adherenceScore: 89,
    goalTimeline: '5 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Feb 15', weight: 65, bmi: 23.9 },
      { date: 'Mar 1', weight: 64, bmi: 23.5 },
      { date: 'Mar 20', weight: 63, bmi: 23.1 },
      { date: 'Apr 5', weight: 62, bmi: 22.8 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-017', name: 'Aarav Desai', email: 'aarav.desai@gmail.com', phone: '+91 21097 89012',
    avatar: '', initials: 'AD', color: 'bg-sky-500',
    age: 42, gender: 'Male', height: 173, weight: 95, targetWeight: 80, bmi: 31.7,
    healthGoal: 'Weight Loss', healthConditions: ['Fatty Liver', 'High Cholesterol'],
    allergies: [], dietaryPreference: 'Non-Vegetarian',
    programs: ['Weight Loss Intensive', 'Liver Detox Program'],
    currentPhase: 'Phase 1: Detox', dietChartStatus: 'Active',
    lastActive: '2 hours ago', enrolledSince: 'Apr 5, 2026', status: 'Active',
    completionPct: 14, engagementScore: 77, adherenceScore: 73,
    goalTimeline: '10 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Apr 5', weight: 97, bmi: 32.4 },
      { date: 'Apr 15', weight: 95, bmi: 31.7 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-018', name: 'Ritu Bhatia', email: 'ritu.bhatia@gmail.com', phone: '+91 10986 90123',
    avatar: '', initials: 'RB', color: 'bg-pink-600',
    age: 36, gender: 'Female', height: 157, weight: 78, targetWeight: 62, bmi: 31.6,
    healthGoal: 'PCOS Management', healthConditions: ['PCOS', 'Thyroid'],
    allergies: ['Gluten', 'Dairy'], dietaryPreference: 'Vegan',
    programs: ['PCOS Reversal Program', 'Thyroid Balance Program'],
    currentPhase: 'Phase 1: Foundation', dietChartStatus: 'None',
    lastActive: '5 days ago', enrolledSince: 'Jan 20, 2026', status: 'Inactive',
    completionPct: 30, engagementScore: 45, adherenceScore: 40,
    goalTimeline: '14 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Jan 20', weight: 82, bmi: 33.2 },
      { date: 'Feb 20', weight: 80, bmi: 32.4 },
      { date: 'Mar 20', weight: 78, bmi: 31.6 },
    ],
    notes: [
      { id: 'n-5', text: 'Client disengaged. Follow up needed. No diet chart assigned yet.', author: 'Dr. Radha', authorRole: 'Coach', timestamp: 'Apr 18, 2026', pinned: true },
    ],
    activityLog: [],
  },
  {
    id: 'c-019', name: 'Nikhil Sharma', email: 'nikhil.s@gmail.com', phone: '+91 98761 01234',
    avatar: '', initials: 'NS', color: 'bg-blue-600',
    age: 27, gender: 'Male', height: 176, weight: 70, targetWeight: 78, bmi: 22.6,
    healthGoal: 'Muscle Gain', healthConditions: [], allergies: [],
    dietaryPreference: 'Non-Vegetarian',
    programs: ['Athletic Performance'],
    currentPhase: 'Phase 2: Strength Foundation', dietChartStatus: 'Active',
    lastActive: '1 hour ago', enrolledSince: 'Feb 1, 2026', status: 'Active',
    completionPct: 48, engagementScore: 93, adherenceScore: 90,
    goalTimeline: '8 months',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Feb 1', weight: 68, bmi: 21.9 },
      { date: 'Mar 1', weight: 69, bmi: 22.2 },
      { date: 'Apr 1', weight: 70, bmi: 22.6 },
    ],
    notes: [],
    activityLog: [],
  },
  {
    id: 'c-020', name: 'Geeta Krishnamurthy', email: 'geeta.k@gmail.com', phone: '+91 87650 12345',
    avatar: '', initials: 'GK', color: 'bg-teal-600',
    age: 50, gender: 'Female', height: 158, weight: 72, targetWeight: 65, bmi: 28.8,
    healthGoal: 'General Wellness', healthConditions: ['Menopause', 'Joint Pain'],
    allergies: [], dietaryPreference: 'Vegetarian',
    programs: ['Senior Wellness Program'],
    currentPhase: 'Phase 1: Foundation', dietChartStatus: 'Active',
    lastActive: '2 days ago', enrolledSince: 'Mar 5, 2026', status: 'Active',
    completionPct: 30, engagementScore: 72, adherenceScore: 68,
    goalTimeline: 'Ongoing',
    coach: 'Dr. Radha Krishnan',
    measurements: [
      { date: 'Mar 5', weight: 74, bmi: 29.7 },
      { date: 'Mar 20', weight: 73, bmi: 29.2 },
      { date: 'Apr 5', weight: 72, bmi: 28.8 },
    ],
    notes: [],
    activityLog: [],
  },
];
