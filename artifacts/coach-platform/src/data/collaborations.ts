export type CollabStatus = 'Active' | 'Pending Sent' | 'Pending Received' | 'Expired' | 'Ended';
export type CollabRole = 'Contributing Coach' | 'Referring Coach';
export type AccessScope = 'Full program data' | 'Diet charts only' | 'Recipes only';

export interface RevenueEntry {
  month: string;
  total: number;
  myShare: number;
  partnerShare: number;
  status: 'Paid' | 'Pending' | 'Processing';
}

export interface SharedClient {
  id: string;
  name: string;
  initials: string;
  color: string;
  program: string;
  enrolledDate: string;
  status: 'Active' | 'Completed';
}

export interface CollabActivity {
  id: string;
  action: string;
  timestamp: string;
}

export interface Collaboration {
  id: string;
  partnerName: string;
  partnerInitials: string;
  partnerColor: string;
  partnerSpecialization: string;
  partnerPrograms: number;
  partnerClients: number;
  partnerRating: number;
  sharedPrograms: string[];
  myRole: CollabRole;
  revenueMyPct: number;
  revenuePartnerPct: number;
  status: CollabStatus;
  startDate: string;
  endDate?: string;
  duration: 'Ongoing' | 'Fixed';
  accessScope: AccessScope;
  clientsServed: number;
  totalRevenue: number;
  message: string;
  revenueHistory: RevenueEntry[];
  sharedClients: SharedClient[];
  activityLog: CollabActivity[];
}

export const FIND_COACHES = [
  { id: 'fc-1', name: 'Dr. Anita Bose', initials: 'AB', color: 'bg-purple-500', specialization: ['Ayurveda', 'Weight Loss', 'Gut Health'], programs: 8, clients: 142, rating: 4.9, location: 'Mumbai' },
  { id: 'fc-2', name: 'Dr. Rajesh Menon', initials: 'RM', color: 'bg-blue-500', specialization: ['Sports Nutrition', 'Muscle Gain', 'Performance'], programs: 5, clients: 98, rating: 4.7, location: 'Bangalore' },
  { id: 'fc-3', name: 'Dr. Sunita Jha', initials: 'SJ', color: 'bg-rose-500', specialization: ['Hormonal Health', 'PCOS', 'Thyroid'], programs: 6, clients: 215, rating: 4.8, location: 'Delhi' },
  { id: 'fc-4', name: 'Dr. Vikram Sehgal', initials: 'VS', color: 'bg-amber-600', specialization: ['Diabetes', 'Heart Health', 'Senior Wellness'], programs: 7, clients: 178, rating: 4.6, location: 'Hyderabad' },
  { id: 'fc-5', name: 'Dr. Preethi Nair', initials: 'PN', color: 'bg-emerald-600', specialization: ['Pediatric Nutrition', 'Family Wellness'], programs: 4, clients: 124, rating: 4.9, location: 'Chennai' },
  { id: 'fc-6', name: 'Dr. Arun Sharma', initials: 'AS', color: 'bg-cyan-600', specialization: ['Oncology Nutrition', 'Recovery', 'Immunity'], programs: 3, clients: 67, rating: 4.8, location: 'Pune' },
];

export const COLLABORATIONS: Collaboration[] = [
  {
    id: 'col-1', partnerName: 'Dr. Anita Bose', partnerInitials: 'AB', partnerColor: 'bg-purple-500',
    partnerSpecialization: 'Ayurveda & Gut Health', partnerPrograms: 8, partnerClients: 142, partnerRating: 4.9,
    sharedPrograms: ['Gut Reset Program', 'Weight Loss Intensive'],
    myRole: 'Contributing Coach', revenueMyPct: 70, revenuePartnerPct: 30,
    status: 'Active', startDate: 'Jan 1, 2026', duration: 'Ongoing',
    accessScope: 'Full program data', clientsServed: 34, totalRevenue: 128500,
    message: 'Looking forward to combining our expertise for holistic wellness outcomes.',
    revenueHistory: [
      { month: 'Jan 2026', total: 24500, myShare: 17150, partnerShare: 7350, status: 'Paid' },
      { month: 'Feb 2026', total: 31200, myShare: 21840, partnerShare: 9360, status: 'Paid' },
      { month: 'Mar 2026', total: 38800, myShare: 27160, partnerShare: 11640, status: 'Paid' },
      { month: 'Apr 2026', total: 34000, myShare: 23800, partnerShare: 10200, status: 'Processing' },
    ],
    sharedClients: [
      { id: 'sc-1', name: 'Meera Pillai', initials: 'MP', color: 'bg-indigo-500', program: 'Gut Reset Program', enrolledDate: 'Feb 20, 2026', status: 'Active' },
      { id: 'sc-2', name: 'Suresh Kumar', initials: 'SK', color: 'bg-lime-600', program: 'Weight Loss Intensive', enrolledDate: 'Jan 15, 2026', status: 'Active' },
    ],
    activityLog: [
      { id: 'ca-1', action: 'Revenue for Apr 2026 calculated — ₹34,000 total', timestamp: 'Apr 30, 2026' },
      { id: 'ca-2', action: 'New client Meera Pillai added to shared program', timestamp: 'Feb 20, 2026' },
      { id: 'ca-3', action: 'Collaboration agreement signed', timestamp: 'Jan 1, 2026' },
    ],
  },
  {
    id: 'col-2', partnerName: 'Dr. Sunita Jha', partnerInitials: 'SJ', partnerColor: 'bg-rose-500',
    partnerSpecialization: 'Hormonal Health & PCOS', partnerPrograms: 6, partnerClients: 215, partnerRating: 4.8,
    sharedPrograms: ['PCOS Reversal Program', 'Thyroid Balance Program'],
    myRole: 'Contributing Coach', revenueMyPct: 60, revenuePartnerPct: 40,
    status: 'Active', startDate: 'Feb 15, 2026', duration: 'Ongoing',
    accessScope: 'Full program data', clientsServed: 18, totalRevenue: 72000,
    message: 'Excited to combine hormonal expertise with nutrition science.',
    revenueHistory: [
      { month: 'Feb 2026', total: 18000, myShare: 10800, partnerShare: 7200, status: 'Paid' },
      { month: 'Mar 2026', total: 28000, myShare: 16800, partnerShare: 11200, status: 'Paid' },
      { month: 'Apr 2026', total: 26000, myShare: 15600, partnerShare: 10400, status: 'Pending' },
    ],
    sharedClients: [
      { id: 'sc-3', name: 'Priya Sharma', initials: 'PS', color: 'bg-pink-500', program: 'PCOS Reversal Program', enrolledDate: 'Feb 20, 2026', status: 'Active' },
      { id: 'sc-4', name: 'Kavitha Nambiar', initials: 'KN', color: 'bg-fuchsia-500', program: 'PCOS Reversal Program', enrolledDate: 'Feb 28, 2026', status: 'Active' },
    ],
    activityLog: [
      { id: 'ca-4', action: 'Collaboration started', timestamp: 'Feb 15, 2026' },
    ],
  },
  {
    id: 'col-3', partnerName: 'Dr. Rajesh Menon', partnerInitials: 'RM', partnerColor: 'bg-blue-500',
    partnerSpecialization: 'Sports Nutrition', partnerPrograms: 5, partnerClients: 98, partnerRating: 4.7,
    sharedPrograms: ['Athletic Performance'],
    myRole: 'Referring Coach', revenueMyPct: 20, revenuePartnerPct: 80,
    status: 'Pending Sent', startDate: 'Apr 22, 2026', duration: 'Fixed',
    endDate: 'Oct 22, 2026', accessScope: 'Diet charts only', clientsServed: 0, totalRevenue: 0,
    message: 'I have several clients who would benefit from specialized sports nutrition guidance.',
    revenueHistory: [],
    sharedClients: [],
    activityLog: [
      { id: 'ca-5', action: 'Collaboration request sent', timestamp: 'Apr 22, 2026' },
    ],
  },
  {
    id: 'col-4', partnerName: 'Dr. Preethi Nair', partnerInitials: 'PN', partnerColor: 'bg-emerald-600',
    partnerSpecialization: 'Pediatric Nutrition', partnerPrograms: 4, partnerClients: 124, partnerRating: 4.9,
    sharedPrograms: ['Family Wellness Bundle'],
    myRole: 'Contributing Coach', revenueMyPct: 50, revenuePartnerPct: 50,
    status: 'Pending Received', startDate: 'Apr 20, 2026', duration: 'Ongoing',
    accessScope: 'Full program data', clientsServed: 0, totalRevenue: 0,
    message: 'Would love to partner for a combined family health program covering both adult and child nutrition.',
    revenueHistory: [],
    sharedClients: [],
    activityLog: [
      { id: 'ca-6', action: 'Received collaboration request from Dr. Preethi Nair', timestamp: 'Apr 20, 2026' },
    ],
  },
  {
    id: 'col-5', partnerName: 'Dr. Vikram Sehgal', partnerInitials: 'VS', partnerColor: 'bg-amber-600',
    partnerSpecialization: 'Diabetes & Heart Health', partnerPrograms: 7, partnerClients: 178, partnerRating: 4.6,
    sharedPrograms: ['Diabetes Control Program', 'Heart Health Protocol'],
    myRole: 'Contributing Coach', revenueMyPct: 65, revenuePartnerPct: 35,
    status: 'Ended', startDate: 'Jun 1, 2025', endDate: 'Dec 31, 2025', duration: 'Fixed',
    accessScope: 'Full program data', clientsServed: 52, totalRevenue: 312000,
    message: '',
    revenueHistory: [
      { month: 'Jun 2025', total: 42000, myShare: 27300, partnerShare: 14700, status: 'Paid' },
      { month: 'Jul 2025', total: 48000, myShare: 31200, partnerShare: 16800, status: 'Paid' },
      { month: 'Aug 2025', total: 55000, myShare: 35750, partnerShare: 19250, status: 'Paid' },
      { month: 'Sep 2025', total: 58000, myShare: 37700, partnerShare: 20300, status: 'Paid' },
      { month: 'Oct 2025', total: 52000, myShare: 33800, partnerShare: 18200, status: 'Paid' },
      { month: 'Nov 2025', total: 34000, myShare: 22100, partnerShare: 11900, status: 'Paid' },
      { month: 'Dec 2025', total: 23000, myShare: 14950, partnerShare: 8050, status: 'Paid' },
    ],
    sharedClients: [],
    activityLog: [
      { id: 'ca-7', action: 'Collaboration ended as per fixed term', timestamp: 'Dec 31, 2025' },
    ],
  },
];
