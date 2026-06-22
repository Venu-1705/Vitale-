export type BookingStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'No-show';
export type SessionColor = 'blue' | 'green' | 'purple' | 'orange';

export interface SessionType {
  id: string;
  name: string;
  duration: number; // minutes
  description: string;
  price: number; // 0 = included in program
  color: SessionColor;
  active: boolean;
}

export interface TimeSlot {
  start: string; // "09:00"
  end: string;   // "09:30"
}

export interface DayAvailability {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  enabled: boolean;
  slots: TimeSlot[];
}

export interface BlockedDate {
  id: string;
  date: string; // "2026-05-15"
  reason: string;
}

export interface SessionNote {
  id: string;
  bookingId: string;
  content: string;
  sharedWithClient: boolean;
  createdAt: string;
  sections: { label: string; text: string }[];
}

export interface Booking {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  sessionTypeId: string;
  sessionTypeName: string;
  sessionColor: SessionColor;
  duration: number;
  date: string;       // "2026-05-12"
  time: string;       // "10:00 AM"
  bookedOn: string;   // "Apr 28"
  status: BookingStatus;
  zoomLink: string;
  notes?: SessionNote;
}

export const SESSION_TYPES: SessionType[] = [
  {
    id: 'st1',
    name: 'Quick Check-in',
    duration: 15,
    description: 'Review progress, celebrate quick wins, and address immediate questions.',
    price: 0,
    color: 'blue',
    active: true,
  },
  {
    id: 'st2',
    name: 'Consultation',
    duration: 30,
    description: 'Diet review, meal plan adjustments, and answering detailed questions.',
    price: 0,
    color: 'green',
    active: true,
  },
  {
    id: 'st3',
    name: 'Detailed Review',
    duration: 45,
    description: 'In-depth analysis of health data, new protocol design, and long-term planning.',
    price: 499,
    color: 'purple',
    active: true,
  },
  {
    id: 'st4',
    name: 'Group Session',
    duration: 60,
    description: 'Guided group coaching session for program cohort members.',
    price: 199,
    color: 'orange',
    active: false,
  },
];

export const DEFAULT_AVAILABILITY: DayAvailability[] = [
  { day: 'Mon', enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '15:00', end: '18:00' }] },
  { day: 'Tue', enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '15:00', end: '18:00' }] },
  { day: 'Wed', enabled: true,  slots: [{ start: '09:00', end: '12:00' }] },
  { day: 'Thu', enabled: true,  slots: [{ start: '10:00', end: '13:00' }, { start: '16:00', end: '19:00' }] },
  { day: 'Fri', enabled: true,  slots: [{ start: '09:00', end: '12:00' }] },
  { day: 'Sat', enabled: false, slots: [] },
  { day: 'Sun', enabled: false, slots: [] },
];

export const BLOCKED_DATES: BlockedDate[] = [
  { id: 'bd1', date: '2026-05-15', reason: 'Public holiday' },
  { id: 'bd2', date: '2026-05-22', reason: 'Conference travel' },
  { id: 'bd3', date: '2026-06-01', reason: 'Personal day' },
];

export const BOOKINGS: Booking[] = [
  // Upcoming
  {
    id: 'b1', clientId: 'c1', clientName: 'Priya Sharma', clientAvatar: 'PS',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-05-08', time: '10:00 AM', bookedOn: 'May 1', status: 'Confirmed',
    zoomLink: 'https://zoom.us/j/123456789',
  },
  {
    id: 'b2', clientId: 'c2', clientName: 'Arjun Mehta', clientAvatar: 'AM',
    sessionTypeId: 'st1', sessionTypeName: 'Quick Check-in', sessionColor: 'blue', duration: 15,
    date: '2026-05-08', time: '11:00 AM', bookedOn: 'May 3', status: 'Confirmed',
    zoomLink: 'https://zoom.us/j/987654321',
  },
  {
    id: 'b3', clientId: 'c5', clientName: 'Kavita Patel', clientAvatar: 'KP',
    sessionTypeId: 'st3', sessionTypeName: 'Detailed Review', sessionColor: 'purple', duration: 45,
    date: '2026-05-09', time: '3:00 PM', bookedOn: 'May 2', status: 'Pending',
    zoomLink: 'https://zoom.us/j/456789123',
  },
  {
    id: 'b4', clientId: 'c4', clientName: 'Rohit Verma', clientAvatar: 'RV',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-05-12', time: '10:30 AM', bookedOn: 'May 4', status: 'Confirmed',
    zoomLink: 'https://zoom.us/j/321654987',
  },
  {
    id: 'b5', clientId: 'c7', clientName: 'Sunita Rao', clientAvatar: 'SR',
    sessionTypeId: 'st1', sessionTypeName: 'Quick Check-in', sessionColor: 'blue', duration: 15,
    date: '2026-05-13', time: '9:00 AM', bookedOn: 'May 5', status: 'Pending',
    zoomLink: 'https://zoom.us/j/654321789',
  },
  {
    id: 'b6', clientId: 'c3', clientName: 'Meera Nair', clientAvatar: 'MN',
    sessionTypeId: 'st3', sessionTypeName: 'Detailed Review', sessionColor: 'purple', duration: 45,
    date: '2026-05-14', time: '4:00 PM', bookedOn: 'May 3', status: 'Confirmed',
    zoomLink: 'https://zoom.us/j/789123456',
  },
  {
    id: 'b7', clientId: 'c6', clientName: 'Deepak Singh', clientAvatar: 'DS',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-05-19', time: '11:30 AM', bookedOn: 'May 5', status: 'Confirmed',
    zoomLink: 'https://zoom.us/j/112233445',
  },
  {
    id: 'b8', clientId: 'c1', clientName: 'Priya Sharma', clientAvatar: 'PS',
    sessionTypeId: 'st1', sessionTypeName: 'Quick Check-in', sessionColor: 'blue', duration: 15,
    date: '2026-05-21', time: '10:00 AM', bookedOn: 'May 6', status: 'Pending',
    zoomLink: 'https://zoom.us/j/556677889',
  },
  // Past / Completed
  {
    id: 'b9', clientId: 'c2', clientName: 'Arjun Mehta', clientAvatar: 'AM',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-04-29', time: '10:00 AM', bookedOn: 'Apr 22', status: 'Completed',
    zoomLink: 'https://zoom.us/j/000111222',
    notes: {
      id: 'n1', bookingId: 'b9', sharedWithClient: false, createdAt: 'Apr 29, 2026',
      content: 'Good progress this week. Protein intake has improved significantly.',
      sections: [
        { label: 'What was discussed', text: 'Reviewed week 4 progress. Arjun has been consistent with meal logging.' },
        { label: 'Progress observed', text: 'Protein intake up to 68g/day (target: 65g). Weight stable at 78kg.' },
        { label: 'Adjustments made', text: 'Added a post-workout snack of 2 boiled eggs to increase satiety.' },
        { label: 'Follow-up actions', text: 'Focus on fibre this week. Target 25g/day via dal, sabzi and salads.' },
      ],
    },
  },
  {
    id: 'b10', clientId: 'c5', clientName: 'Kavita Patel', clientAvatar: 'KP',
    sessionTypeId: 'st3', sessionTypeName: 'Detailed Review', sessionColor: 'purple', duration: 45,
    date: '2026-04-25', time: '3:00 PM', bookedOn: 'Apr 18', status: 'Completed',
    zoomLink: 'https://zoom.us/j/333444555',
    notes: {
      id: 'n2', bookingId: 'b10', sharedWithClient: true, createdAt: 'Apr 25, 2026',
      content: 'Phase 2 review. Excellent adherence. Transitioning to maintenance protocol.',
      sections: [
        { label: 'What was discussed', text: 'End of Phase 2 deep-dive. Hormonal panel results reviewed.' },
        { label: 'Progress observed', text: 'AMH improved from 0.8 to 1.4. Cycle regularised to 30 days.' },
        { label: 'Adjustments made', text: 'Reducing inositol from 4g to 2g. Adding seed cycling protocol.' },
        { label: 'Follow-up actions', text: 'Retest hormonal panel in 6 weeks. Start Phase 3 next Monday.' },
      ],
    },
  },
  {
    id: 'b11', clientId: 'c4', clientName: 'Rohit Verma', clientAvatar: 'RV',
    sessionTypeId: 'st1', sessionTypeName: 'Quick Check-in', sessionColor: 'blue', duration: 15,
    date: '2026-04-22', time: '9:30 AM', bookedOn: 'Apr 15', status: 'No-show',
    zoomLink: 'https://zoom.us/j/666777888',
  },
  {
    id: 'b12', clientId: 'c3', clientName: 'Meera Nair', clientAvatar: 'MN',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-04-20', time: '11:00 AM', bookedOn: 'Apr 13', status: 'Cancelled',
    zoomLink: 'https://zoom.us/j/999000111',
  },
  {
    id: 'b13', clientId: 'c1', clientName: 'Priya Sharma', clientAvatar: 'PS',
    sessionTypeId: 'st2', sessionTypeName: 'Consultation', sessionColor: 'green', duration: 30,
    date: '2026-04-15', time: '10:00 AM', bookedOn: 'Apr 8', status: 'Completed',
    zoomLink: 'https://zoom.us/j/222333444',
    notes: {
      id: 'n3', bookingId: 'b13', sharedWithClient: false, createdAt: 'Apr 15, 2026',
      content: 'Mid-program check. Managing PCOS symptoms well. Stress cortisol still elevated.',
      sections: [
        { label: 'What was discussed', text: 'PCOS symptom tracking, sleep quality, and current stressors.' },
        { label: 'Progress observed', text: 'Bloating reduced by ~60%. Hair fall stabilising. Sleep 6–7 hrs.' },
        { label: 'Adjustments made', text: 'Added ashwagandha 300mg before bed. Reduced HIIT to 2x/week.' },
        { label: 'Follow-up actions', text: 'Track sleep with app. Journal stressors daily for 2 weeks.' },
      ],
    },
  },
];
