export type UserStatus = 'Active' | 'Inactive' | 'Suspended';
export type LeagueTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type HealthCondition = 'PCOS' | 'Diabetes Type 2' | 'Hypothyroidism' | 'Hypertension' | 'IBS' | 'Obesity' | 'Cardiac' | 'None';
export type DietaryRestriction = 'Vegetarian' | 'Vegan' | 'Gluten-Free' | 'Dairy-Free' | 'Jain' | 'None';

export interface UserProgram {
  id: string;
  name: string;
  coachName: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Dropped';
  completionPct: number;
}

export interface AccessGrant {
  id: string;
  coachName: string;
  dataCategories: string[];
  grantedAt: string;
  expiresAt?: string;
  active: boolean;
}

export interface ConsentRecord {
  id: string;
  type: 'Registration' | 'Program Enrollment' | 'Collaboration' | 'Data Sharing' | 'Marketing';
  description: string;
  grantedAt: string;
  ipAddress: string;
  version: string;
}

export interface DataAccessLog {
  id: string;
  coachName: string;
  dataCategory: string;
  accessedAt: string;
  purpose: string;
  ipAddress: string;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedDate: string;
  lastActive: string;
  status: UserStatus;
  programs: UserProgram[];
  activeProgram?: string;
  streak: number;
  league: LeagueTier;
  healthConditions: HealthCondition[];
  dietaryRestrictions: DietaryRestriction[];
  city: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  initials: string;
  accessGrants: AccessGrant[];
  consentRecords: ConsentRecord[];
  dataAccessLogs: DataAccessLog[];
  weightHistory: WeightEntry[];
  lastLoggedMeal: string;
  totalMealsLogged: number;
  symptomsThisWeek: number;
  avgSleepHours: number;
  bmi: number;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

const PROGRAMS_POOL: UserProgram[] = [
  { id: 'prog1', name: 'PCOS Reversal Program', coachName: 'Nutritionist Kavya', startDate: monthsAgo(3), status: 'Active', completionPct: 68 },
  { id: 'prog2', name: 'Transform 90', coachName: 'Dr. Arjun Mehta', startDate: monthsAgo(2), status: 'Active', completionPct: 45 },
  { id: 'prog3', name: 'Gut Reset 30-Day', coachName: 'Priya Sharma', startDate: monthsAgo(5), endDate: monthsAgo(4), status: 'Completed', completionPct: 100 },
  { id: 'prog4', name: 'Diabetic Wellness', coachName: 'Dr. Sunita Rao', startDate: monthsAgo(6), endDate: monthsAgo(3), status: 'Completed', completionPct: 100 },
  { id: 'prog5', name: 'Cardiac Wellness', coachName: 'Nutritionist Kavya', startDate: monthsAgo(4), status: 'Active', completionPct: 55 },
  { id: 'prog6', name: 'Weight Loss Journey', coachName: 'Dr. Arjun Mehta', startDate: monthsAgo(7), endDate: monthsAgo(5), status: 'Dropped', completionPct: 32 },
  { id: 'prog7', name: 'Thyroid Balance Program', coachName: 'Priya Sharma', startDate: monthsAgo(2), status: 'Active', completionPct: 30 },
];

function makeAccess(coachName: string, cats: string[], daysBack: number): AccessGrant {
  return {
    id: `ag-${Math.random().toString(36).slice(2)}`,
    coachName,
    dataCategories: cats,
    grantedAt: daysAgo(daysBack),
    expiresAt: daysAgo(-90),
    active: true,
  };
}

function makeConsent(type: ConsentRecord['type'], desc: string, daysBack: number): ConsentRecord {
  return {
    id: `cr-${Math.random().toString(36).slice(2)}`,
    type, description: desc,
    grantedAt: `${daysAgo(daysBack)}T${String(Math.floor(Math.random() * 22) + 1).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}:00Z`,
    ipAddress: `49.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    version: '2.1',
  };
}

function makeAuditLog(coachName: string, cat: string, daysBack: number, purpose: string): DataAccessLog {
  return {
    id: `al-${Math.random().toString(36).slice(2)}`,
    coachName, dataCategory: cat,
    accessedAt: `${daysAgo(daysBack)}T${String(Math.floor(Math.random() * 22) + 8).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}:00Z`,
    purpose, ipAddress: `103.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
}

function makeWeights(start: number, end: number, count: number): WeightEntry[] {
  const result: WeightEntry[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (count - i) * 7);
    const weight = start + (end - start) * (i / (count - 1)) + (Math.random() - 0.5) * 0.8;
    result.push({ date: d.toISOString().split('T')[0], weight: Math.round(weight * 10) / 10 });
  }
  return result;
}

export const USERS: User[] = [
  {
    id: 'u1', name: 'Ananya Sharma', email: 'ananya.sharma@gmail.com', phone: '+91 98765 43210',
    joinedDate: monthsAgo(4), lastActive: daysAgo(1), status: 'Active',
    programs: [PROGRAMS_POOL[0], PROGRAMS_POOL[2]], activeProgram: 'PCOS Reversal Program',
    streak: 21, league: 'Gold', age: 28, gender: 'Female', city: 'Mumbai',
    healthConditions: ['PCOS'], dietaryRestrictions: ['Vegetarian'],
    initials: 'AS',
    accessGrants: [makeAccess('Nutritionist Kavya', ['Health Data', 'Diet Logs', 'Symptom Logs'], 90)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 120),
      makeConsent('Program Enrollment', 'Consented to share health data for PCOS Reversal Program', 90),
    ],
    dataAccessLogs: [
      makeAuditLog('Nutritionist Kavya', 'Health Data', 2, 'Program progress review'),
      makeAuditLog('Nutritionist Kavya', 'Diet Logs', 5, 'Weekly check-in'),
      makeAuditLog('Nutritionist Kavya', 'Symptom Logs', 10, 'Symptom trend analysis'),
    ],
    weightHistory: makeWeights(68, 64.5, 12),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 187, symptomsThisWeek: 1, avgSleepHours: 7.2, bmi: 24.1,
  },
  {
    id: 'u2', name: 'Meera Patel', email: 'meera.patel@outlook.com', phone: '+91 87654 32109',
    joinedDate: monthsAgo(3), lastActive: daysAgo(0), status: 'Active',
    programs: [PROGRAMS_POOL[1]], activeProgram: 'Transform 90',
    streak: 14, league: 'Silver', age: 34, gender: 'Female', city: 'Ahmedabad',
    healthConditions: ['Obesity'], dietaryRestrictions: ['None'],
    initials: 'MP',
    accessGrants: [makeAccess('Dr. Arjun Mehta', ['Health Data', 'Workout Logs'], 60)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 90),
      makeConsent('Program Enrollment', 'Consented to share health data for Transform 90', 60),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Arjun Mehta', 'Health Data', 3, 'Initial assessment'),
      makeAuditLog('Dr. Arjun Mehta', 'Workout Logs', 7, 'Fitness tracking review'),
    ],
    weightHistory: makeWeights(82, 77.5, 10),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 134, symptomsThisWeek: 0, avgSleepHours: 6.8, bmi: 29.3,
  },
  {
    id: 'u3', name: 'Priya Singh', email: 'priya.singh@yahoo.in', phone: '+91 76543 21098',
    joinedDate: monthsAgo(6), lastActive: daysAgo(2), status: 'Active',
    programs: [PROGRAMS_POOL[0], PROGRAMS_POOL[2]], activeProgram: 'PCOS Reversal Program',
    streak: 7, league: 'Bronze', age: 25, gender: 'Female', city: 'Delhi',
    healthConditions: ['PCOS', 'Hypothyroidism'], dietaryRestrictions: ['Gluten-Free'],
    initials: 'PS',
    accessGrants: [makeAccess('Nutritionist Kavya', ['Health Data', 'Diet Logs', 'Lab Reports'], 120)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 180),
      makeConsent('Program Enrollment', 'Consented to share health data', 120),
      makeConsent('Data Sharing', 'Consented to share anonymised data for research', 90),
    ],
    dataAccessLogs: [
      makeAuditLog('Nutritionist Kavya', 'Lab Reports', 4, 'Thyroid panel review'),
      makeAuditLog('Nutritionist Kavya', 'Health Data', 8, 'Monthly review'),
    ],
    weightHistory: makeWeights(72, 69.2, 8),
    lastLoggedMeal: daysAgo(1), totalMealsLogged: 220, symptomsThisWeek: 3, avgSleepHours: 7.8, bmi: 26.4,
  },
  {
    id: 'u4', name: 'Lakshmi Rao', email: 'lakshmi.rao@gmail.com', phone: '+91 65432 10987',
    joinedDate: monthsAgo(5), lastActive: daysAgo(0), status: 'Active',
    programs: [PROGRAMS_POOL[2], PROGRAMS_POOL[3]], activeProgram: 'Gut Reset 30-Day',
    streak: 30, league: 'Platinum', age: 42, gender: 'Female', city: 'Hyderabad',
    healthConditions: ['IBS', 'Diabetes Type 2'], dietaryRestrictions: ['Dairy-Free'],
    initials: 'LR',
    accessGrants: [makeAccess('Priya Sharma', ['Health Data', 'Gut Symptoms', 'Diet Logs'], 150)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 160),
      makeConsent('Program Enrollment', 'Consented to share data for Gut Reset Program', 150),
    ],
    dataAccessLogs: [
      makeAuditLog('Priya Sharma', 'Gut Symptoms', 1, 'Daily symptom check'),
      makeAuditLog('Priya Sharma', 'Diet Logs', 3, 'Food sensitivity review'),
      makeAuditLog('Dr. Sunita Rao', 'Health Data', 6, 'Diabetes monitoring'),
    ],
    weightHistory: makeWeights(74, 71, 14),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 315, symptomsThisWeek: 2, avgSleepHours: 7.0, bmi: 27.8,
  },
  {
    id: 'u5', name: 'Divya Nair', email: 'divya.nair@gmail.com', phone: '+91 54321 09876',
    joinedDate: monthsAgo(2), lastActive: daysAgo(0), status: 'Active',
    programs: [PROGRAMS_POOL[1]], activeProgram: 'Transform 90',
    streak: 45, league: 'Diamond', age: 30, gender: 'Female', city: 'Bangalore',
    healthConditions: ['None'], dietaryRestrictions: ['Vegetarian'],
    initials: 'DN',
    accessGrants: [makeAccess('Dr. Arjun Mehta', ['Health Data', 'Workout Logs', 'Diet Logs'], 60)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 65),
      makeConsent('Program Enrollment', 'Consented to share health data for Transform 90', 60),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Arjun Mehta', 'Workout Logs', 1, 'Performance tracking'),
      makeAuditLog('Dr. Arjun Mehta', 'Health Data', 4, 'Progress review'),
    ],
    weightHistory: makeWeights(65, 61.5, 8),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 156, symptomsThisWeek: 0, avgSleepHours: 8.1, bmi: 22.8,
  },
  {
    id: 'u6', name: 'Ritu Gupta', email: 'ritu.gupta@rediffmail.com', phone: '+91 43210 98765',
    joinedDate: monthsAgo(8), lastActive: daysAgo(35), status: 'Inactive',
    programs: [PROGRAMS_POOL[5]], activeProgram: undefined,
    streak: 0, league: 'Bronze', age: 38, gender: 'Female', city: 'Pune',
    healthConditions: ['Hypertension'], dietaryRestrictions: ['None'],
    initials: 'RG',
    accessGrants: [],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 240),
      makeConsent('Program Enrollment', 'Consented to share health data for Weight Loss Journey', 210),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Arjun Mehta', 'Health Data', 40, 'Check-in after program drop'),
    ],
    weightHistory: makeWeights(88, 85.5, 6),
    lastLoggedMeal: daysAgo(35), totalMealsLogged: 78, symptomsThisWeek: 0, avgSleepHours: 6.2, bmi: 31.5,
  },
  {
    id: 'u7', name: 'Sunita Mehta', email: 'sunita.mehta@gmail.com', phone: '+91 32109 87654',
    joinedDate: monthsAgo(7), lastActive: daysAgo(3), status: 'Active',
    programs: [PROGRAMS_POOL[2], PROGRAMS_POOL[3]], activeProgram: 'Gut Reset 30-Day',
    streak: 9, league: 'Silver', age: 45, gender: 'Female', city: 'Kolkata',
    healthConditions: ['IBS'], dietaryRestrictions: ['Jain'],
    initials: 'SM',
    accessGrants: [makeAccess('Priya Sharma', ['Health Data', 'Diet Logs'], 200)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 210),
      makeConsent('Program Enrollment', 'Consented to share data for Gut Reset', 200),
    ],
    dataAccessLogs: [
      makeAuditLog('Priya Sharma', 'Diet Logs', 5, 'Jain meal plan compliance check'),
    ],
    weightHistory: makeWeights(69, 66.8, 8),
    lastLoggedMeal: daysAgo(2), totalMealsLogged: 189, symptomsThisWeek: 4, avgSleepHours: 7.4, bmi: 25.1,
  },
  {
    id: 'u8', name: 'Kavya Reddy', email: 'kavya.reddy@gmail.com', phone: '+91 21098 76543',
    joinedDate: monthsAgo(3), lastActive: daysAgo(1), status: 'Active',
    programs: [PROGRAMS_POOL[1]], activeProgram: 'Transform 90',
    streak: 6, league: 'Bronze', age: 27, gender: 'Female', city: 'Chennai',
    healthConditions: ['None'], dietaryRestrictions: ['Vegan'],
    initials: 'KR',
    accessGrants: [makeAccess('Dr. Arjun Mehta', ['Health Data', 'Diet Logs'], 90)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 95),
      makeConsent('Program Enrollment', 'Consented to share data for Transform 90', 90),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Arjun Mehta', 'Health Data', 6, 'Vegan nutrition review'),
    ],
    weightHistory: makeWeights(70, 67, 10),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 112, symptomsThisWeek: 1, avgSleepHours: 7.6, bmi: 25.8,
  },
  {
    id: 'u9', name: 'Rohit Verma', email: 'rohit.verma@gmail.com', phone: '+91 10987 65432',
    joinedDate: monthsAgo(3), lastActive: daysAgo(8), status: 'Suspended',
    programs: [PROGRAMS_POOL[1]], activeProgram: undefined,
    streak: 0, league: 'Bronze', age: 31, gender: 'Male', city: 'Delhi',
    healthConditions: ['Obesity'], dietaryRestrictions: ['None'],
    initials: 'RV',
    accessGrants: [],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 93),
      makeConsent('Program Enrollment', 'Consented to share data for Transform 90', 90),
    ],
    dataAccessLogs: [],
    weightHistory: makeWeights(95, 93.5, 4),
    lastLoggedMeal: daysAgo(8), totalMealsLogged: 67, symptomsThisWeek: 0, avgSleepHours: 5.8, bmi: 33.2,
  },
  {
    id: 'u10', name: 'Pooja Jain', email: 'pooja.jain@outlook.com', phone: '+91 98001 12345',
    joinedDate: monthsAgo(5), lastActive: daysAgo(1), status: 'Active',
    programs: [PROGRAMS_POOL[2]], activeProgram: 'Gut Reset 30-Day',
    streak: 18, league: 'Gold', age: 33, gender: 'Female', city: 'Jaipur',
    healthConditions: ['IBS'], dietaryRestrictions: ['Jain', 'Gluten-Free'],
    initials: 'PJ',
    accessGrants: [makeAccess('Priya Sharma', ['Health Data', 'Gut Symptoms', 'Diet Logs'], 150)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 155),
      makeConsent('Program Enrollment', 'Consented to share data for Gut Reset', 150),
    ],
    dataAccessLogs: [
      makeAuditLog('Priya Sharma', 'Health Data', 2, 'Weekly review'),
      makeAuditLog('Priya Sharma', 'Gut Symptoms', 7, 'Symptom pattern analysis'),
    ],
    weightHistory: makeWeights(66, 63.5, 9),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 200, symptomsThisWeek: 2, avgSleepHours: 7.3, bmi: 24.8,
  },
  {
    id: 'u11', name: 'Vikram Das', email: 'vikram.das@gmail.com', phone: '+91 77001 55443',
    joinedDate: monthsAgo(1), lastActive: daysAgo(10), status: 'Suspended',
    programs: [PROGRAMS_POOL[0]], activeProgram: undefined,
    streak: 0, league: 'Bronze', age: 29, gender: 'Male', city: 'Mumbai',
    healthConditions: ['None'], dietaryRestrictions: ['None'],
    initials: 'VD',
    accessGrants: [],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 32),
    ],
    dataAccessLogs: [],
    weightHistory: makeWeights(80, 80, 2),
    lastLoggedMeal: daysAgo(10), totalMealsLogged: 12, symptomsThisWeek: 0, avgSleepHours: 6.5, bmi: 27.1,
  },
  {
    id: 'u12', name: 'Neha Kapoor', email: 'neha.kapoor@gmail.com', phone: '+91 88776 54321',
    joinedDate: monthsAgo(9), lastActive: daysAgo(45), status: 'Inactive',
    programs: [PROGRAMS_POOL[3], PROGRAMS_POOL[5]], activeProgram: undefined,
    streak: 0, league: 'Silver', age: 50, gender: 'Female', city: 'Lucknow',
    healthConditions: ['Diabetes Type 2', 'Hypertension'], dietaryRestrictions: ['None'],
    initials: 'NK',
    accessGrants: [],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 275),
      makeConsent('Program Enrollment', 'Consented to share data for Diabetic Wellness', 270),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Sunita Rao', 'Health Data', 50, 'Quarterly review'),
    ],
    weightHistory: makeWeights(79, 76, 5),
    lastLoggedMeal: daysAgo(45), totalMealsLogged: 160, symptomsThisWeek: 0, avgSleepHours: 6.9, bmi: 28.7,
  },
  {
    id: 'u13', name: 'Arun Kumar', email: 'arun.kumar@gmail.com', phone: '+91 99887 76655',
    joinedDate: monthsAgo(1), lastActive: daysAgo(2), status: 'Active',
    programs: [PROGRAMS_POOL[4]], activeProgram: 'Cardiac Wellness',
    streak: 12, league: 'Silver', age: 55, gender: 'Male', city: 'Bangalore',
    healthConditions: ['Cardiac', 'Hypertension'], dietaryRestrictions: ['None'],
    initials: 'AK',
    accessGrants: [makeAccess('Nutritionist Kavya', ['Health Data', 'Diet Logs', 'Vitals'], 30)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 33),
      makeConsent('Program Enrollment', 'Consented to share health data for Cardiac Wellness', 30),
    ],
    dataAccessLogs: [
      makeAuditLog('Nutritionist Kavya', 'Vitals', 1, 'Blood pressure monitoring'),
      makeAuditLog('Nutritionist Kavya', 'Health Data', 3, 'Cardiac risk assessment'),
    ],
    weightHistory: makeWeights(84, 82, 5),
    lastLoggedMeal: daysAgo(1), totalMealsLogged: 88, symptomsThisWeek: 1, avgSleepHours: 7.0, bmi: 28.1,
  },
  {
    id: 'u14', name: 'Deepa Krishnan', email: 'deepa.k@gmail.com', phone: '+91 91234 56789',
    joinedDate: monthsAgo(2), lastActive: daysAgo(0), status: 'Active',
    programs: [PROGRAMS_POOL[6]], activeProgram: 'Thyroid Balance Program',
    streak: 22, league: 'Gold', age: 37, gender: 'Female', city: 'Chennai',
    healthConditions: ['Hypothyroidism'], dietaryRestrictions: ['Gluten-Free', 'Dairy-Free'],
    initials: 'DK',
    accessGrants: [makeAccess('Priya Sharma', ['Health Data', 'Lab Reports', 'Diet Logs'], 60)],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 65),
      makeConsent('Program Enrollment', 'Consented to share data for Thyroid Balance', 60),
      makeConsent('Data Sharing', 'Consented to anonymised research use', 55),
    ],
    dataAccessLogs: [
      makeAuditLog('Priya Sharma', 'Lab Reports', 2, 'TSH panel review'),
      makeAuditLog('Priya Sharma', 'Diet Logs', 5, 'Anti-inflammatory diet check'),
    ],
    weightHistory: makeWeights(71, 68.5, 9),
    lastLoggedMeal: daysAgo(0), totalMealsLogged: 143, symptomsThisWeek: 1, avgSleepHours: 8.0, bmi: 26.1,
  },
  {
    id: 'u15', name: 'Sanjay Iyer', email: 'sanjay.iyer@outlook.com', phone: '+91 82345 67890',
    joinedDate: monthsAgo(10), lastActive: daysAgo(60), status: 'Inactive',
    programs: [PROGRAMS_POOL[3]], activeProgram: undefined,
    streak: 0, league: 'Bronze', age: 48, gender: 'Male', city: 'Hyderabad',
    healthConditions: ['Diabetes Type 2'], dietaryRestrictions: ['None'],
    initials: 'SI',
    accessGrants: [],
    consentRecords: [
      makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', 300),
      makeConsent('Program Enrollment', 'Consented to share data for Diabetic Wellness', 295),
    ],
    dataAccessLogs: [
      makeAuditLog('Dr. Sunita Rao', 'Health Data', 65, 'Post-program follow-up'),
    ],
    weightHistory: makeWeights(85, 83.2, 5),
    lastLoggedMeal: daysAgo(60), totalMealsLogged: 145, symptomsThisWeek: 0, avgSleepHours: 6.5, bmi: 29.6,
  },
];

// Extend with generated users to hit 1450 total (show 25 per page + mock total stats)
const EXTRA_NAMES = [
  ['Radha','Venkat'],['Kamla','Tripathi'],['Girish','Nair'],['Sarita','Bhatt'],['Monica','Shah'],
  ['Alok','Mishra'],['Preeti','Thakur'],['Ramesh','Iyer'],['Geeta','Pillai'],['Vinay','Dubey'],
  ['Sneha','Kulkarni'],['Harish','Srivastava'],['Vandana','Yadav'],['Suresh','Rawat'],['Kiran','Hegde'],
  ['Archana','Deshpande'],['Manish','Chauhan'],['Usha','Patil'],['Rajesh','Aggarwal'],['Priyanka','Bose'],
  ['Amit','Chaudhary'],['Smita','Desai'],['Nikhil','Joshi'],['Vidya','Kumar'],['Reshma','Choudhary'],
];
const CITIES = ['Mumbai','Delhi','Bangalore','Hyderabad','Pune','Chennai','Kolkata','Jaipur','Ahmedabad','Lucknow'];
const CONDITIONS: HealthCondition[] = ['PCOS','Diabetes Type 2','Hypothyroidism','Hypertension','IBS','Obesity','Cardiac','None'];
const LEAGUES: LeagueTier[] = ['Bronze','Silver','Gold','Platinum','Diamond'];
const STATUSES: UserStatus[] = ['Active','Active','Active','Active','Inactive','Inactive','Suspended'];

for (let i = 0; i < EXTRA_NAMES.length; i++) {
  const [first, last] = EXTRA_NAMES[i];
  const daysJoined = Math.floor(Math.random() * 400) + 5;
  const daysLast = Math.floor(Math.random() * 90);
  const prog = PROGRAMS_POOL[Math.floor(Math.random() * PROGRAMS_POOL.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  USERS.push({
    id: `u${16 + i}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`,
    phone: `+91 ${String(70000 + Math.floor(Math.random() * 29999)).slice(0,5)} ${String(10000 + Math.floor(Math.random() * 89999))}`,
    joinedDate: daysAgo(daysJoined),
    lastActive: daysAgo(daysLast),
    status,
    programs: [prog],
    activeProgram: status === 'Active' ? prog.name : undefined,
    streak: status === 'Active' ? Math.floor(Math.random() * 40) : 0,
    league: LEAGUES[Math.floor(Math.random() * LEAGUES.length)],
    age: 22 + Math.floor(Math.random() * 35),
    gender: Math.random() > 0.3 ? 'Female' : 'Male',
    city: CITIES[Math.floor(Math.random() * CITIES.length)],
    healthConditions: [CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)]],
    dietaryRestrictions: ['None'],
    initials: `${first[0]}${last[0]}`,
    accessGrants: status === 'Active' ? [makeAccess('Nutritionist Kavya', ['Health Data'], 30)] : [],
    consentRecords: [makeConsent('Registration', 'Agreed to Terms of Service and Privacy Policy', daysJoined)],
    dataAccessLogs: status === 'Active' ? [makeAuditLog('Nutritionist Kavya', 'Health Data', daysLast + 2, 'Regular check-in')] : [],
    weightHistory: makeWeights(65 + Math.random() * 25, 63 + Math.random() * 20, 5),
    lastLoggedMeal: daysAgo(daysLast),
    totalMealsLogged: Math.floor(Math.random() * 250) + 20,
    symptomsThisWeek: Math.floor(Math.random() * 5),
    avgSleepHours: 5.5 + Math.random() * 3,
    bmi: 20 + Math.random() * 15,
  });
}

export const USER_STATS = {
  total: 1450,
  activeThisMonth: 892,
  newThisMonth: 67,
  churned: 134,
};

export const PROGRAM_LIST = [
  'PCOS Reversal Program',
  'Transform 90',
  'Gut Reset 30-Day',
  'Diabetic Wellness',
  'Cardiac Wellness',
  'Weight Loss Journey',
  'Thyroid Balance Program',
];
