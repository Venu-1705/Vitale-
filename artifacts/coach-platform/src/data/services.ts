export type ServiceStatus = 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'ARCHIVED';
export type PricingType = 'free' | 'onetime' | 'recurring';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percent' | 'flat';
  value: number;
  maxUses: number;
  usedCount: number;
  expiry: string;
  status: 'Active' | 'Expired' | 'Paused';
}

export interface ServiceUser {
  id: string;
  name: string;
  email: string;
  purchaseDate: string;
  status: 'Active' | 'Expired' | 'Pending';
  amount: number;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  users: number;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  pricingType: PricingType;
  price: number;
  compareAtPrice?: number;
  billingCycle?: BillingCycle;
  trialDays?: number;
  currency: string;
  activeUsers: number;
  totalRevenue: number;
  startDate: string;
  status: ServiceStatus;
  visibility: 'public' | 'private';
  enrollmentLimit?: number;
  accessDuration: 'lifetime' | 'limited';
  accessDays?: number;
  linkedPrograms: string[];
  linkedCourses: string[];
  linkedWorkshops: string[];
  consultationsEnabled: boolean;
  consultationSessions: number;
  conversionRate: number;
  avgRating: number;
  checkoutSlug: string;
  coverImage?: string;
  gstEnabled: boolean;
  gstPercent: number;
  couponsEnabled: boolean;
  coupons: Coupon[];
  users: ServiceUser[];
  revenue: RevenuePoint[];
  checkoutHeadline?: string;
  checkoutDescription?: string;
  autoRenew: boolean;
  welcomeMessageEnabled: boolean;
  enrollmentConfirmation: boolean;
  paymentReceipt: boolean;
  renewalReminder: boolean;
}

const indianNames = [
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
  { name: 'Karan Malhotra', email: 'karan.m@outlook.com' },
  { name: 'Pooja Rao', email: 'pooja.rao@yahoo.com' },
];

function makeUsers(count: number, price: number): ServiceUser[] {
  return indianNames.slice(0, Math.min(count, indianNames.length)).map((p, i) => ({
    id: `u${i + 1}`,
    name: p.name,
    email: p.email,
    purchaseDate: `2026-0${Math.max(1, 4 - (i % 3))}-${String(5 + i * 3).padStart(2, '0')}`,
    status: i % 5 === 3 ? 'Expired' : i % 7 === 6 ? 'Pending' : 'Active',
    amount: price,
  }));
}

function makeRevenue(base: number): RevenuePoint[] {
  return [
    { month: 'Nov', revenue: Math.round(base * 0.6), users: Math.round(base * 0.6 / 5000) + 2 },
    { month: 'Dec', revenue: Math.round(base * 0.85), users: Math.round(base * 0.85 / 5000) + 3 },
    { month: 'Jan', revenue: Math.round(base * 1.1), users: Math.round(base * 1.1 / 5000) + 4 },
    { month: 'Feb', revenue: Math.round(base * 0.95), users: Math.round(base * 0.95 / 5000) + 3 },
    { month: 'Mar', revenue: Math.round(base * 1.3), users: Math.round(base * 1.3 / 5000) + 5 },
    { month: 'Apr', revenue: Math.round(base * 1.0), users: Math.round(base * 1.0 / 5000) + 4 },
  ];
}

export const MOCK_SERVICES: Service[] = [
  {
    id: '69d20c8db8c265852a7d4f57',
    title: 'Transform 90 — Complete Weight Loss Program',
    description: 'A comprehensive 90-day weight loss program combining diet, exercise, and mindset coaching. Includes daily check-ins, weekly group calls, and personalised meal plans crafted by certified nutritionists.',
    category: 'Weight Loss',
    tags: ['beginner', 'intermediate', 'weight-loss', 'diet'],
    pricingType: 'onetime',
    price: 4999,
    compareAtPrice: 7999,
    currency: '₹',
    activeUsers: 156,
    totalRevenue: 779844,
    startDate: '2025-10-01',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'limited',
    accessDays: 90,
    linkedPrograms: ['Weight Loss Bootcamp', '7-Day Detox Plan'],
    linkedCourses: ['Nutrition Fundamentals'],
    linkedWorkshops: [],
    consultationsEnabled: true,
    consultationSessions: 2,
    conversionRate: 4.2,
    avgRating: 4.8,
    checkoutSlug: 'transform-90',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: true,
    coupons: [
      { id: 'c1', code: 'WELCOME20', discountType: 'percent', value: 20, maxUses: 100, usedCount: 34, expiry: '2026-06-30', status: 'Active' },
      { id: 'c2', code: 'FLAT500', discountType: 'flat', value: 500, maxUses: 50, usedCount: 12, expiry: '2026-05-31', status: 'Active' },
    ],
    users: makeUsers(12, 4999),
    revenue: makeRevenue(130000),
    checkoutHeadline: 'Lose weight. Keep it off. Transform your life.',
    checkoutDescription: 'Join 156+ people who have transformed their bodies with our proven 90-day system.',
    autoRenew: false,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: false,
  },
  {
    id: 'a1b2c3d4e5f6789012345678',
    title: 'PCOS Wellness Monthly',
    description: 'Monthly subscription for PCOS management with hormone-balancing diet plans, weekly coaching calls, and symptom tracking tools personalised to your cycle.',
    category: 'Wellness',
    tags: ['PCOS', 'women-only', 'hormones', 'recurring'],
    pricingType: 'recurring',
    price: 1499,
    billingCycle: 'monthly',
    trialDays: 7,
    currency: '₹',
    activeUsers: 89,
    totalRevenue: 534644,
    startDate: '2025-08-15',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'lifetime',
    linkedPrograms: ['PCOS Reversal Program', 'Hormone Balance Diet'],
    linkedCourses: [],
    linkedWorkshops: ['PCOS Awareness Webinar'],
    consultationsEnabled: false,
    consultationSessions: 0,
    conversionRate: 6.1,
    avgRating: 4.9,
    checkoutSlug: 'pcos-wellness-monthly',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: false,
    coupons: [],
    users: makeUsers(12, 1499),
    revenue: makeRevenue(89000),
    checkoutHeadline: 'Balance your hormones. Reclaim your health.',
    checkoutDescription: '89 women are already managing PCOS naturally with our monthly wellness program.',
    autoRenew: true,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: true,
  },
  {
    id: 'b2c3d4e5f67890123456789a',
    title: 'Diabetic Diet Masterclass',
    description: 'Structured 8-week program for managing diabetes through evidence-based nutrition. Includes glycaemic index food guide, recipe library, and blood sugar tracking templates.',
    category: 'Disease Management',
    tags: ['diabetes', 'diet', 'disease-management', 'intermediate'],
    pricingType: 'onetime',
    price: 2999,
    currency: '₹',
    activeUsers: 67,
    totalRevenue: 200933,
    startDate: '2025-11-01',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'limited',
    accessDays: 56,
    linkedPrograms: ['Diabetic Diet Plan', 'Low-GI Recipe Collection'],
    linkedCourses: ['Understanding Diabetes'],
    linkedWorkshops: [],
    consultationsEnabled: true,
    consultationSessions: 1,
    conversionRate: 3.8,
    avgRating: 4.7,
    checkoutSlug: 'diabetic-diet-masterclass',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: true,
    coupons: [
      { id: 'c3', code: 'SUMMER30', discountType: 'percent', value: 30, maxUses: 25, usedCount: 8, expiry: '2026-05-15', status: 'Active' },
    ],
    users: makeUsers(10, 2999),
    revenue: makeRevenue(67000),
    autoRenew: false,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: false,
  },
  {
    id: 'c3d4e5f678901234567890ab',
    title: 'Prenatal Nutrition Bundle',
    description: 'Complete prenatal nutrition guidance for all three trimesters. Includes trimester-specific meal plans, supplement guide, safe exercise routines, and postpartum recovery programme.',
    category: 'Prenatal',
    tags: ['prenatal', 'pregnancy', 'women-only', 'advanced'],
    pricingType: 'onetime',
    price: 6999,
    compareAtPrice: 9999,
    currency: '₹',
    activeUsers: 34,
    totalRevenue: 237966,
    startDate: '2025-12-01',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'limited',
    accessDays: 365,
    linkedPrograms: ['Prenatal Wellness Plan', 'Postpartum Recovery'],
    linkedCourses: [],
    linkedWorkshops: ['Prenatal Nutrition Q&A'],
    consultationsEnabled: true,
    consultationSessions: 3,
    conversionRate: 2.9,
    avgRating: 4.9,
    checkoutSlug: 'prenatal-nutrition-bundle',
    gstEnabled: false,
    gstPercent: 0,
    couponsEnabled: false,
    coupons: [],
    users: makeUsers(8, 6999),
    revenue: makeRevenue(40000),
    autoRenew: false,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: false,
  },
  {
    id: 'd4e5f6789012345678901abc',
    title: 'Free Wellness Assessment',
    description: 'Complimentary 45-minute wellness assessment with a certified nutritionist. Get a personalised health report and tailored program recommendations.',
    category: 'Wellness',
    tags: ['free', 'beginner', 'assessment', 'consultation'],
    pricingType: 'free',
    price: 0,
    currency: '₹',
    activeUsers: 342,
    totalRevenue: 0,
    startDate: '2025-06-01',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'limited',
    accessDays: 30,
    linkedPrograms: [],
    linkedCourses: [],
    linkedWorkshops: [],
    consultationsEnabled: true,
    consultationSessions: 1,
    conversionRate: 18.4,
    avgRating: 4.6,
    checkoutSlug: 'free-wellness-assessment',
    gstEnabled: false,
    gstPercent: 0,
    couponsEnabled: false,
    coupons: [],
    users: makeUsers(12, 0),
    revenue: makeRevenue(0),
    autoRenew: false,
    welcomeMessageEnabled: false,
    enrollmentConfirmation: true,
    paymentReceipt: false,
    renewalReminder: false,
  },
  {
    id: 'e5f678901234567890123abc',
    title: '1-on-1 Coaching (4 Sessions)',
    description: 'Four personalised 45-minute coaching sessions with a senior Vitalé coach. Customised nutrition and fitness plan, progress tracking, and unlimited WhatsApp support between sessions.',
    category: 'Wellness',
    tags: ['consultation', '1-on-1', 'advanced', 'personalised'],
    pricingType: 'onetime',
    price: 3999,
    currency: '₹',
    activeUsers: 28,
    totalRevenue: 111972,
    startDate: '2026-01-15',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'limited',
    accessDays: 60,
    linkedPrograms: [],
    linkedCourses: [],
    linkedWorkshops: [],
    consultationsEnabled: true,
    consultationSessions: 4,
    conversionRate: 5.3,
    avgRating: 5.0,
    checkoutSlug: '1-on-1-coaching-4-sessions',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: true,
    coupons: [
      { id: 'c4', code: 'COACH10', discountType: 'percent', value: 10, maxUses: 20, usedCount: 5, expiry: '2026-07-31', status: 'Active' },
    ],
    users: makeUsers(8, 3999),
    revenue: makeRevenue(28000),
    autoRenew: false,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: false,
  },
  {
    id: 'f6789012345678901234abcd',
    title: 'Muscle Building Quarterly',
    description: 'Three-month muscle building program with progressive overload training plans, high-protein meal plans, supplement recommendations, and bi-weekly coach reviews.',
    category: 'Muscle Gain',
    tags: ['muscle-gain', 'advanced', 'strength', 'nutrition'],
    pricingType: 'recurring',
    price: 3499,
    billingCycle: 'quarterly',
    trialDays: 14,
    currency: '₹',
    activeUsers: 45,
    totalRevenue: 472365,
    startDate: '2025-09-01',
    status: 'ACTIVE',
    visibility: 'public',
    accessDuration: 'lifetime',
    linkedPrograms: ['Muscle Gain Meal Plan', 'Strength Training Guide'],
    linkedCourses: ['Macronutrient Mastery'],
    linkedWorkshops: [],
    consultationsEnabled: false,
    consultationSessions: 0,
    conversionRate: 3.2,
    avgRating: 4.7,
    checkoutSlug: 'muscle-building-quarterly',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: true,
    coupons: [
      { id: 'c5', code: 'GAINS15', discountType: 'percent', value: 15, maxUses: 30, usedCount: 11, expiry: '2026-08-31', status: 'Active' },
    ],
    users: makeUsers(12, 3499),
    revenue: makeRevenue(78000),
    autoRenew: true,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: true,
  },
  {
    id: 'a789012345678901234abcde',
    title: 'Corporate Wellness Package',
    description: 'Enterprise-grade wellness program for corporate teams. Includes group nutrition workshops, individual assessments for up to 50 employees, monthly health reports, and a dedicated account manager.',
    category: 'Wellness',
    tags: ['corporate', 'group', 'enterprise', 'advanced'],
    pricingType: 'onetime',
    price: 49999,
    currency: '₹',
    activeUsers: 3,
    totalRevenue: 149997,
    startDate: '2026-04-05',
    status: 'DRAFT',
    visibility: 'private',
    accessDuration: 'limited',
    accessDays: 365,
    linkedPrograms: ['Corporate Wellness Plan', 'Group Coaching Sessions'],
    linkedCourses: ['Workplace Nutrition'],
    linkedWorkshops: ['Corporate Health Summit'],
    consultationsEnabled: true,
    consultationSessions: 10,
    conversionRate: 1.1,
    avgRating: 0,
    checkoutSlug: 'corporate-wellness-package',
    gstEnabled: true,
    gstPercent: 18,
    couponsEnabled: false,
    coupons: [],
    users: makeUsers(3, 49999),
    revenue: makeRevenue(50000),
    autoRenew: false,
    welcomeMessageEnabled: true,
    enrollmentConfirmation: true,
    paymentReceipt: true,
    renewalReminder: false,
  },
];

export function formatPrice(service: Service): string {
  if (service.pricingType === 'free') return 'Free';
  const fmt = `₹${service.price.toLocaleString('en-IN')}`;
  if (service.pricingType === 'recurring') {
    const cycle = service.billingCycle === 'monthly' ? 'mo' : service.billingCycle === 'quarterly' ? 'qtr' : 'yr';
    return `${fmt}/${cycle}`;
  }
  return fmt;
}

export function formatPricingType(service: Service): string {
  if (service.pricingType === 'free') return 'free';
  if (service.pricingType === 'onetime') return 'onetime';
  return `recurring/${service.billingCycle}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
