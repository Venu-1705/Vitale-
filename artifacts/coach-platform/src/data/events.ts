// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType = 'Meeting' | 'Workshop' | 'Webinar' | 'In-Person';
export type EventStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';
export type RegistrationStatus = 'Open' | 'Closed' | 'Full';

export interface EventParticipant {
  id: string;
  name: string;
  email: string;
  registrationDate: string;
  status: 'registered' | 'attended' | 'no-show';
  initials: string;
  color: string;
  joinTime?: string;
  duration?: number;
}

export interface VitaleEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  program?: string;
  host: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: EventStatus;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    currentOccurrence: number;
    totalOccurrences: number;
  };
  capacity?: number;
  registeredCount: number;
  attendedCount?: number;
  price: number | 'free' | 'included';
  registrationStatus: RegistrationStatus;
  joinUrl?: string;
  recordingUrl?: string;
  coverColor: string;    // tailwind bg class for stripe
  venue?: string;
  address?: string;
  participants: EventParticipant[];
  materials?: string[];
  feedbackEnabled?: boolean;
  waitlistEnabled?: boolean;
  tags?: string[];
  specialInstructions?: string;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<EventType, { stripe: string; badge: string; badgeText: string; label: string }> = {
  Meeting:    { stripe: 'bg-blue-500',   badge: 'bg-blue-100 border-blue-200',   badgeText: 'text-blue-700',   label: 'Custom meeting' },
  Workshop:   { stripe: 'bg-green-500',  badge: 'bg-green-100 border-green-200', badgeText: 'text-green-700',  label: 'Workshop' },
  Webinar:    { stripe: 'bg-purple-500', badge: 'bg-purple-100 border-purple-200',badgeText: 'text-purple-700', label: 'Webinar' },
  'In-Person':{ stripe: 'bg-orange-500', badge: 'bg-orange-100 border-orange-200',badgeText: 'text-orange-700', label: 'In-Person' },
};

// ─── Participants helper ───────────────────────────────────────────────────────

const COLORS = ['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500','bg-red-500','bg-teal-500','bg-pink-500','bg-indigo-500','bg-amber-500','bg-emerald-500'];

function mkP(id: string, name: string, email: string, reg: string, status: EventParticipant['status'], color: string, join?: string, dur?: number): EventParticipant {
  return { id, name, email, registrationDate: reg, status, initials: name.split(' ').map(n=>n[0]).join(''), color, joinTime: join, duration: dur };
}

// ─── Upcoming Events ──────────────────────────────────────────────────────────

export const UPCOMING_EVENTS: VitaleEvent[] = [
  {
    id: 'ev001',
    type: 'Meeting',
    title: 'Hive Connect',
    description: 'Weekly group meeting for all program participants. Share progress, ask questions, and celebrate wins together.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-25',
    startTime: '16:00',
    endTime: '18:00',
    durationMinutes: 120,
    status: 'Upcoming',
    recurring: { frequency: 'weekly', currentOccurrence: 2, totalOccurrences: 14 },
    capacity: 30,
    registeredCount: 14,
    price: 'included',
    registrationStatus: 'Open',
    coverColor: 'bg-blue-500',
    joinUrl: 'https://zoom.us/j/11111',
    participants: [
      mkP('p1','Priya Malhotra','priya@email.com','2026-04-10','registered',COLORS[0]),
      mkP('p2','Aarav Gupta','aarav@email.com','2026-04-11','registered',COLORS[1]),
      mkP('p3','Meera Joshi','meera@email.com','2026-04-11','registered',COLORS[2]),
      mkP('p4','Anita Singh','anita@email.com','2026-04-12','registered',COLORS[3]),
      mkP('p5','Rahul Mehta','rahul@email.com','2026-04-12','registered',COLORS[4]),
    ],
    tags: ['community', 'weekly', 'open'],
  },
  {
    id: 'ev002',
    type: 'Workshop',
    title: 'Inner Circle Recharge',
    description: 'Weekly recharge session for Inner Circle members. Focused on mindset, habit tracking, and accountability.',
    program: 'Inner Circle Premium',
    host: 'Dr. Priya Sharma',
    date: '2026-04-26',
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    status: 'Upcoming',
    recurring: { frequency: 'weekly', currentOccurrence: 14, totalOccurrences: 52 },
    capacity: 20,
    registeredCount: 18,
    price: 'included',
    registrationStatus: 'Open',
    coverColor: 'bg-green-500',
    joinUrl: 'https://zoom.us/j/22222',
    feedbackEnabled: true,
    participants: [
      mkP('p6','Kavita Nair','kavita@email.com','2026-01-05','registered',COLORS[5]),
      mkP('p7','Sunita Verma','sunita@email.com','2026-01-05','registered',COLORS[6]),
      mkP('p8','Deepa Rao','deepa@email.com','2026-01-06','registered',COLORS[7]),
      mkP('p9','Rekha Gupta','rekha@email.com','2026-01-06','registered',COLORS[8]),
      mkP('p10','Seema Jain','seema@email.com','2026-01-07','registered',COLORS[9]),
    ],
    materials: ['Week 14 Habit Tracker.pdf', 'Mindset Journal Template.pdf'],
    tags: ['inner-circle', 'premium', 'weekly'],
  },
  {
    id: 'ev003',
    type: 'Workshop',
    title: 'Lakshmi Kataksh — Prosperity & Wellness',
    description: 'Integrating ancient wisdom with modern nutrition science for holistic well-being.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-27',
    startTime: '07:00',
    endTime: '08:30',
    durationMinutes: 90,
    status: 'Upcoming',
    recurring: { frequency: 'monthly', currentOccurrence: 4, totalOccurrences: 4 },
    capacity: 50,
    registeredCount: 42,
    price: 499,
    registrationStatus: 'Open',
    coverColor: 'bg-amber-500',
    joinUrl: 'https://zoom.us/j/33333',
    feedbackEnabled: true,
    participants: [
      mkP('p11','Nalini Krishnan','nalini@email.com','2026-01-15','registered',COLORS[0]),
      mkP('p12','Sharmila Rao','sharmila@email.com','2026-01-15','registered',COLORS[1]),
      mkP('p13','Vaishali Mehta','vaishali@email.com','2026-01-16','registered',COLORS[2]),
      mkP('p14','Radha Pilani','radha@email.com','2026-01-16','registered',COLORS[3]),
      mkP('p15','Sarita Bhat','sarita@email.com','2026-01-17','registered',COLORS[4]),
    ],
    tags: ['wellness', 'holistic'],
  },
  {
    id: 'ev004',
    type: 'Workshop',
    title: 'PCOS Diet Q&A',
    description: 'Live Q&A session focused on diet and lifestyle strategies for managing PCOS. Bring your questions!',
    program: 'PCOS Management',
    host: 'Dr. Priya Sharma',
    date: '2026-04-28',
    startTime: '18:00',
    endTime: '19:30',
    durationMinutes: 90,
    status: 'Upcoming',
    capacity: 40,
    registeredCount: 31,
    price: 'free',
    registrationStatus: 'Open',
    coverColor: 'bg-green-500',
    joinUrl: 'https://zoom.us/j/44444',
    feedbackEnabled: true,
    participants: [
      mkP('p16','Anita Singh','anita@email.com','2026-04-10','registered',COLORS[5]),
      mkP('p17','Priya Malhotra','priya@email.com','2026-04-11','registered',COLORS[6]),
      mkP('p18','Kavita Nair','kavita@email.com','2026-04-12','registered',COLORS[7]),
      mkP('p19','Meera Joshi','meera@email.com','2026-04-13','registered',COLORS[8]),
      mkP('p20','Sunita Verma','sunita@email.com','2026-04-14','registered',COLORS[9]),
    ],
    materials: ['PCOS Diet Guide.pdf'],
    tags: ['pcos', 'q&a', 'free'],
  },
  {
    id: 'ev005',
    type: 'Workshop',
    title: 'Meal Prep Sunday',
    description: 'Bi-weekly batch cooking session. This week: protein bowls, overnight oats, and energy snacks.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-30',
    startTime: '10:00',
    endTime: '12:00',
    durationMinutes: 120,
    status: 'Upcoming',
    recurring: { frequency: 'biweekly', currentOccurrence: 6, totalOccurrences: 26 },
    capacity: 30,
    registeredCount: 24,
    price: 299,
    registrationStatus: 'Open',
    coverColor: 'bg-green-500',
    joinUrl: 'https://zoom.us/j/55555',
    feedbackEnabled: true,
    participants: [
      mkP('p21','Madhuri Pillai','madhuri@email.com','2026-04-01','registered',COLORS[0]),
      mkP('p22','Archana Nair','archana@email.com','2026-04-02','registered',COLORS[1]),
      mkP('p23','Padmaja Rao','padmaja@email.com','2026-04-03','registered',COLORS[2]),
      mkP('p24','Savita Kulkarni','savita@email.com','2026-04-04','registered',COLORS[3]),
      mkP('p25','Urmila Devi','urmila@email.com','2026-04-05','registered',COLORS[4]),
    ],
    materials: ['Batch Cooking Guide Week 6.pdf', 'Shopping List.pdf'],
    tags: ['cooking', 'meal-prep', 'practical'],
  },
  {
    id: 'ev006',
    type: 'Webinar',
    title: 'Nutrition Myths Debunked',
    description: 'Separating fact from fiction in popular nutrition advice. Live Q&A at the end.',
    host: 'Dr. Priya Sharma',
    date: '2026-05-02',
    startTime: '19:00',
    endTime: '20:30',
    durationMinutes: 90,
    status: 'Upcoming',
    capacity: 500,
    registeredCount: 200,
    price: 'free',
    registrationStatus: 'Open',
    coverColor: 'bg-purple-500',
    joinUrl: 'https://zoom.us/j/66666',
    participants: [
      mkP('p26','Tanuja Mehta','tanuja@email.com','2026-04-05','registered',COLORS[5]),
      mkP('p27','Leela Krishnan','leela@email.com','2026-04-06','registered',COLORS[6]),
      mkP('p28','Nandita Bose','nandita@email.com','2026-04-07','registered',COLORS[7]),
      mkP('p29','Subhadra Iyer','subhadra@email.com','2026-04-08','registered',COLORS[8]),
      mkP('p30','Jyotsna Rao','jyotsna@email.com','2026-04-09','registered',COLORS[9]),
    ],
    tags: ['webinar', 'education', 'free'],
  },
  {
    id: 'ev007',
    type: 'In-Person',
    title: 'Yoga & Breathwork Retreat',
    description: 'Full-day in-person retreat combining yoga, breathwork, and mindful nutrition practices.',
    host: 'Dr. Priya Sharma',
    date: '2026-05-03',
    startTime: '08:00',
    endTime: '17:00',
    durationMinutes: 540,
    status: 'Upcoming',
    capacity: 25,
    registeredCount: 20,
    price: 2999,
    registrationStatus: 'Open',
    coverColor: 'bg-orange-500',
    venue: 'Serenity Wellness Centre',
    address: '14 Koramangala Inner Ring Road, Bengaluru, Karnataka 560034',
    specialInstructions: 'Enter from Gate 2. Bring a yoga mat, water bottle, and comfortable clothing. Lunch and snacks provided.',
    participants: [
      mkP('p31','Nalini Krishnan','nalini@email.com','2026-04-01','registered',COLORS[0]),
      mkP('p32','Meena Agarwal','meena@email.com','2026-04-02','registered',COLORS[1]),
      mkP('p33','Rekha Gupta','rekha@email.com','2026-04-03','registered',COLORS[2]),
      mkP('p34','Shobha Iyer','shobha@email.com','2026-04-04','registered',COLORS[3]),
      mkP('p35','Vimala Nair','vimala@email.com','2026-04-05','registered',COLORS[4]),
    ],
    tags: ['in-person', 'retreat', 'yoga', 'premium'],
    waitlistEnabled: true,
  },
  {
    id: 'ev008',
    type: 'Meeting',
    title: 'PCOS Management — Monthly Group Call',
    description: 'Monthly group check-in for all PCOS programme participants.',
    program: 'PCOS Management',
    host: 'Dr. Priya Sharma',
    date: '2026-05-05',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    status: 'Upcoming',
    recurring: { frequency: 'monthly', currentOccurrence: 3, totalOccurrences: 6 },
    capacity: 20,
    registeredCount: 14,
    price: 'included',
    registrationStatus: 'Open',
    coverColor: 'bg-blue-500',
    joinUrl: 'https://zoom.us/j/77777',
    participants: [
      mkP('p36','Anita Singh','anita@email.com','2026-02-01','registered',COLORS[5]),
      mkP('p37','Priya Malhotra','priya@email.com','2026-02-01','registered',COLORS[6]),
      mkP('p38','Kavita Nair','kavita@email.com','2026-02-02','registered',COLORS[7]),
      mkP('p39','Meera Joshi','meera@email.com','2026-02-02','registered',COLORS[8]),
      mkP('p40','Sunita Verma','sunita@email.com','2026-02-03','registered',COLORS[9]),
    ],
    tags: ['pcos', 'group', 'monthly'],
  },
  {
    id: 'ev009',
    type: 'Webinar',
    title: 'Heart Health & Diet — Monthly Masterclass',
    description: 'Evidence-based nutrition strategies for cardiovascular health. Expert guest speaker joining.',
    host: 'Dr. Priya Sharma',
    date: '2026-05-08',
    startTime: '18:00',
    endTime: '19:30',
    durationMinutes: 90,
    status: 'Upcoming',
    capacity: 300,
    registeredCount: 156,
    price: 'free',
    registrationStatus: 'Open',
    coverColor: 'bg-purple-500',
    joinUrl: 'https://zoom.us/j/88888',
    participants: [
      mkP('p41','Tanuja Mehta','tanuja@email.com','2026-04-10','registered',COLORS[0]),
      mkP('p42','Leela Krishnan','leela@email.com','2026-04-11','registered',COLORS[1]),
      mkP('p43','Nandita Bose','nandita@email.com','2026-04-12','registered',COLORS[2]),
      mkP('p44','Subhadra Iyer','subhadra@email.com','2026-04-13','registered',COLORS[3]),
      mkP('p45','Jyotsna Rao','jyotsna@email.com','2026-04-14','registered',COLORS[4]),
    ],
    tags: ['heart', 'webinar', 'free'],
  },
];

// ─── Completed Events ─────────────────────────────────────────────────────────

export const COMPLETED_EVENTS: VitaleEvent[] = [
  {
    id: 'cev001',
    type: 'Meeting',
    title: 'Hive Connect',
    description: 'Weekly group meeting — Occurrence 1 of 14.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-18',
    startTime: '16:00',
    endTime: '18:00',
    durationMinutes: 120,
    status: 'Completed',
    recurring: { frequency: 'weekly', currentOccurrence: 1, totalOccurrences: 14 },
    capacity: 30,
    registeredCount: 12,
    attendedCount: 10,
    price: 'included',
    registrationStatus: 'Closed',
    coverColor: 'bg-blue-500',
    recordingUrl: 'https://zoom.us/rec/share/hive1',
    participants: [
      mkP('p50','Priya Malhotra','priya@email.com','2026-04-10','attended',COLORS[0],'16:03',115),
      mkP('p51','Aarav Gupta','aarav@email.com','2026-04-11','attended',COLORS[1],'16:01',118),
      mkP('p52','Meera Joshi','meera@email.com','2026-04-11','attended',COLORS[2],'16:05',110),
      mkP('p53','Anita Singh','anita@email.com','2026-04-12','attended',COLORS[3],'16:02',117),
      mkP('p54','Rahul Mehta','rahul@email.com','2026-04-12','no-show',COLORS[4]),
      mkP('p55','Kavita Nair','kavita@email.com','2026-04-11','attended',COLORS[5],'16:04',112),
    ],
    tags: ['community', 'weekly'],
  },
  {
    id: 'cev002',
    type: 'Workshop',
    title: 'Inner Circle Recharge',
    description: 'Weekly recharge — Occurrence 13.',
    program: 'Inner Circle Premium',
    host: 'Dr. Priya Sharma',
    date: '2026-04-19',
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    status: 'Completed',
    recurring: { frequency: 'weekly', currentOccurrence: 13, totalOccurrences: 52 },
    capacity: 20,
    registeredCount: 17,
    attendedCount: 15,
    price: 'included',
    registrationStatus: 'Closed',
    coverColor: 'bg-green-500',
    recordingUrl: 'https://zoom.us/rec/share/ic13',
    feedbackEnabled: true,
    participants: [
      mkP('p56','Kavita Nair','kavita@email.com','2026-01-05','attended',COLORS[5],'09:01',88),
      mkP('p57','Sunita Verma','sunita@email.com','2026-01-05','attended',COLORS[6],'09:00',90),
      mkP('p58','Deepa Rao','deepa@email.com','2026-01-06','attended',COLORS[7],'09:03',85),
      mkP('p59','Rekha Gupta','rekha@email.com','2026-01-06','no-show',COLORS[8]),
      mkP('p60','Seema Jain','seema@email.com','2026-01-07','attended',COLORS[9],'09:02',87),
    ],
    materials: ['Week 13 Habit Tracker.pdf'],
    tags: ['inner-circle', 'premium'],
  },
  {
    id: 'cev003',
    type: 'Workshop',
    title: 'Managing Stress Through Diet',
    description: 'Learn how food choices affect cortisol levels and mood regulation.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-19',
    startTime: '11:00',
    endTime: '12:30',
    durationMinutes: 90,
    status: 'Completed',
    capacity: 40,
    registeredCount: 41,
    attendedCount: 38,
    price: 349,
    registrationStatus: 'Full',
    coverColor: 'bg-green-500',
    recordingUrl: 'https://zoom.us/rec/share/stress1',
    feedbackEnabled: true,
    participants: [
      mkP('p61','Meena Agarwal','meena@email.com','2026-04-05','attended',COLORS[0],'11:02',88),
      mkP('p62','Rekha Gupta','rekha@email.com','2026-04-05','attended',COLORS[1],'11:00',90),
      mkP('p63','Shobha Iyer','shobha@email.com','2026-04-06','attended',COLORS[2],'11:05',85),
      mkP('p64','Vimala Nair','vimala@email.com','2026-04-06','no-show',COLORS[3]),
      mkP('p65','Parvathi Rao','parvathi@email.com','2026-04-07','attended',COLORS[4],'11:01',89),
    ],
    tags: ['stress', 'cortisol'],
  },
  {
    id: 'cev004',
    type: 'Webinar',
    title: 'Gut Health & Immunity',
    description: 'How a healthy gut microbiome supports your immune system.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-15',
    startTime: '19:00',
    endTime: '20:00',
    durationMinutes: 60,
    status: 'Completed',
    capacity: 500,
    registeredCount: 189,
    attendedCount: 142,
    price: 'free',
    registrationStatus: 'Closed',
    coverColor: 'bg-purple-500',
    recordingUrl: 'https://zoom.us/rec/share/gut1',
    participants: [
      mkP('p66','Tanuja Mehta','tanuja@email.com','2026-04-01','attended',COLORS[5],'19:01',58),
      mkP('p67','Leela Krishnan','leela@email.com','2026-04-01','attended',COLORS[6],'19:05',55),
      mkP('p68','Nandita Bose','nandita@email.com','2026-04-02','attended',COLORS[7],'19:00',60),
      mkP('p69','Subhadra Iyer','subhadra@email.com','2026-04-02','no-show',COLORS[8]),
      mkP('p70','Jyotsna Rao','jyotsna@email.com','2026-04-03','attended',COLORS[9],'19:03',57),
    ],
    tags: ['gut', 'immunity', 'free'],
  },
  {
    id: 'cev005',
    type: 'In-Person',
    title: 'Mindful Eating Walk — Cubbon Park',
    description: 'Guided nature walk with mindfulness practices and a healthy picnic lunch.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-12',
    startTime: '07:00',
    endTime: '10:00',
    durationMinutes: 180,
    status: 'Completed',
    capacity: 15,
    registeredCount: 15,
    attendedCount: 13,
    price: 799,
    registrationStatus: 'Full',
    coverColor: 'bg-orange-500',
    venue: 'Cubbon Park',
    address: 'Cubbon Park, MG Road, Bengaluru, Karnataka 560001',
    participants: [
      mkP('p71','Nalini Krishnan','nalini@email.com','2026-04-01','attended',COLORS[0]),
      mkP('p72','Sharmila Rao','sharmila@email.com','2026-04-01','attended',COLORS[1]),
      mkP('p73','Vaishali Mehta','vaishali@email.com','2026-04-02','attended',COLORS[2]),
      mkP('p74','Radha Pilani','radha@email.com','2026-04-02','no-show',COLORS[3]),
      mkP('p75','Sarita Bhat','sarita@email.com','2026-04-03','attended',COLORS[4]),
    ],
    tags: ['in-person', 'outdoor'],
  },
  {
    id: 'cev006',
    type: 'Workshop',
    title: 'Meal Prep Sunday',
    description: 'Week 5 batch cooking session.',
    host: 'Dr. Priya Sharma',
    date: '2026-04-16',
    startTime: '10:00',
    endTime: '12:00',
    durationMinutes: 120,
    status: 'Completed',
    recurring: { frequency: 'biweekly', currentOccurrence: 5, totalOccurrences: 26 },
    capacity: 30,
    registeredCount: 26,
    attendedCount: 23,
    price: 299,
    registrationStatus: 'Closed',
    coverColor: 'bg-green-500',
    recordingUrl: 'https://zoom.us/rec/share/mp5',
    participants: [
      mkP('p76','Madhuri Pillai','madhuri@email.com','2026-04-01','attended',COLORS[5],'10:01',118),
      mkP('p77','Archana Nair','archana@email.com','2026-04-02','attended',COLORS[6],'10:03',115),
      mkP('p78','Padmaja Rao','padmaja@email.com','2026-04-03','no-show',COLORS[7]),
      mkP('p79','Savita Kulkarni','savita@email.com','2026-04-04','attended',COLORS[8],'10:00',120),
      mkP('p80','Urmila Devi','urmila@email.com','2026-04-05','attended',COLORS[9],'10:02',117),
    ],
    materials: ['Batch Cooking Guide Week 5.pdf'],
    tags: ['cooking', 'meal-prep'],
  },
];

// ─── Stats ────────────────────────────────────────────────────────────────────

export const EVENT_STATS = {
  totalUpcoming: UPCOMING_EVENTS.length,
  totalCompleted: COMPLETED_EVENTS.length,
  totalRegistered: UPCOMING_EVENTS.reduce((a, e) => a + e.registeredCount, 0),
  avgAttendance: 84,
};
