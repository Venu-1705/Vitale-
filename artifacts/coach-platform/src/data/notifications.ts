export type NotifStatus = 'Active' | 'Inactive';
export type NotifTrigger =
  | 'Before each meal slot'
  | 'No meals logged today'
  | '1 hour before session'
  | '15 min before session'
  | 'Monday morning'
  | 'After weekly reset'
  | 'On badge trigger'
  | 'Coach sends message'
  | 'User inactive 3+ days'
  | 'Custom';

export type NotifTarget =
  | 'All users'
  | 'Users with diet chart'
  | 'Users with active streak'
  | 'Enrolled users'
  | 'Promoted users'
  | 'Earning user'
  | 'Target user'
  | 'Inactive users';

export interface ScheduledNotif {
  id: string;
  name: string;
  trigger: NotifTrigger;
  time: string;
  target: NotifTarget;
  status: NotifStatus;
  icon: string;
  category: 'Meal' | 'Streak' | 'Session' | 'Engagement' | 'Social' | 'League';
}

export type BroadcastStatus = 'Sent' | 'Scheduled' | 'Failed' | 'Draft';
export type NotifType = 'Scheduled' | 'Broadcast' | 'Badge' | 'Streak' | 'Session' | 'League' | 'Inactivity';

export interface NotifLogEntry {
  id: string;
  sentAt: string;
  type: NotifType;
  title: string;
  body: string;
  target: string;
  sentTo: number;
  delivered: number;
  opened: number;
  status: BroadcastStatus;
}

function daysAgo(n: number, h = 10, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export const SCHEDULED_NOTIFS: ScheduledNotif[] = [
  { id: 'sn1',  name: 'Meal reminder',        trigger: 'Before each meal slot',  time: '15 min before',     target: 'Users with diet chart',    status: 'Active',   icon: '🍽️', category: 'Meal'       },
  { id: 'sn2',  name: 'Streak danger',         trigger: 'No meals logged today',  time: '8:00 PM IST',       target: 'Users with active streak', status: 'Active',   icon: '🔥', category: 'Streak'     },
  { id: 'sn3',  name: 'Session reminder (1hr)',trigger: '1 hour before session',  time: '1 hour before',     target: 'Enrolled users',           status: 'Active',   icon: '📅', category: 'Session'    },
  { id: 'sn4',  name: 'Session reminder (15m)',trigger: '15 min before session',  time: '15 min before',     target: 'Enrolled users',           status: 'Active',   icon: '⏰', category: 'Session'    },
  { id: 'sn5',  name: 'Weekly summary',        trigger: 'Monday morning',         time: '9:00 AM IST',       target: 'All users',                status: 'Active',   icon: '📊', category: 'Engagement' },
  { id: 'sn6',  name: 'League promotion',      trigger: 'After weekly reset',     time: 'Monday 00:05 IST',  target: 'Promoted users',           status: 'Active',   icon: '🏆', category: 'League'     },
  { id: 'sn7',  name: 'Badge earned',          trigger: 'On badge trigger',       time: 'Immediate',         target: 'Earning user',             status: 'Active',   icon: '🎖️', category: 'Social'     },
  { id: 'sn8',  name: 'Coach message',         trigger: 'Coach sends message',    time: 'Immediate',         target: 'Target user',              status: 'Active',   icon: '💬', category: 'Engagement' },
  { id: 'sn9',  name: 'Inactivity nudge',      trigger: 'User inactive 3+ days',  time: '10:00 AM IST',      target: 'Inactive users',           status: 'Active',   icon: '👋', category: 'Engagement' },
  { id: 'sn10', name: 'Program milestone',     trigger: 'Custom',                 time: 'Immediate',         target: 'Enrolled users',           status: 'Inactive', icon: '🎯', category: 'Engagement' },
];

export const NOTIF_LOG: NotifLogEntry[] = [
  { id: 'nl1',  sentAt: daysAgo(0,  9,  0), type: 'Scheduled',  title: 'Weekly Summary',               body: 'Your week in review: 18 meals logged, 7-day streak maintained!',        target: 'All users',                 sentTo: 1420, delivered: 1389, opened: 634,  status: 'Sent'      },
  { id: 'nl2',  sentAt: daysAgo(0, 20,  0), type: 'Streak',     title: "Don't break your streak! 🔥",   body: 'You haven\'t logged any meals yet today. Log now to keep your streak.',   target: 'Users with active streak',  sentTo: 487,  delivered: 471,  opened: 312,  status: 'Sent'      },
  { id: 'nl3',  sentAt: daysAgo(1, 11, 30), type: 'Broadcast',  title: 'New PCOS Program Available',   body: 'Our most popular PCOS Reversal Program is now open for enrolment!',      target: 'All users',                 sentTo: 1450, delivered: 1412, opened: 521,  status: 'Sent'      },
  { id: 'nl4',  sentAt: daysAgo(1, 15,  0), type: 'Session',    title: 'Session starting in 1 hour',   body: 'Your coaching session with Nutritionist Kavya is in 1 hour.',             target: 'Enrolled users',            sentTo: 12,   delivered: 12,   opened: 11,   status: 'Sent'      },
  { id: 'nl5',  sentAt: daysAgo(1, 15, 45), type: 'Session',    title: 'Session in 15 minutes!',       body: 'Your session with Dr. Arjun Mehta starts in 15 minutes. Join now.',       target: 'Enrolled users',            sentTo: 8,    delivered: 8,    opened: 8,    status: 'Sent'      },
  { id: 'nl6',  sentAt: daysAgo(2, 10,  0), type: 'Inactivity', title: 'We miss you! 👋',               body: 'You haven\'t logged a meal in 3 days. Your coach is waiting.',           target: 'Inactive users',            sentTo: 134,  delivered: 128,  opened: 67,   status: 'Sent'      },
  { id: 'nl7',  sentAt: daysAgo(2, 13,  0), type: 'Badge',      title: 'You earned a new badge! 🎖️',   body: 'Congratulations — you\'ve earned the 7-Day Streak badge! +30 XP',         target: 'Earning user',              sentTo: 23,   delivered: 23,   opened: 21,   status: 'Sent'      },
  { id: 'nl8',  sentAt: daysAgo(3,  8, 30), type: 'Scheduled',  title: 'Breakfast time 🍽️',            body: 'Time to log your breakfast! Don\'t forget to follow your diet chart.',   target: 'Users with diet chart',     sentTo: 892,  delivered: 854,  opened: 398,  status: 'Sent'      },
  { id: 'nl9',  sentAt: daysAgo(3, 12,  5), type: 'League',     title: 'You\'ve been promoted! 🏆',    body: 'Congratulations! You\'ve been promoted to Gold league this week.',         target: 'Promoted users',            sentTo: 89,   delivered: 87,   opened: 79,   status: 'Sent'      },
  { id: 'nl10', sentAt: daysAgo(4, 11,  0), type: 'Broadcast',  title: 'New Feature: Recipe Sharing',  body: 'You can now share your favourite recipes with the Vitalé community!',     target: 'All users',                 sentTo: 1450, delivered: 1401, opened: 489,  status: 'Sent'      },
  { id: 'nl11', sentAt: daysAgo(5, 20,  0), type: 'Streak',     title: "Don't break your streak! 🔥",   body: 'You haven\'t logged any meals yet today. Log now to keep your streak.',   target: 'Users with active streak',  sentTo: 510,  delivered: 498,  opened: 321,  status: 'Sent'      },
  { id: 'nl12', sentAt: daysAgo(7,  9,  0), type: 'Scheduled',  title: 'Weekly Summary',               body: 'Check out your progress this week!',                                     target: 'All users',                 sentTo: 1398, delivered: 1354, opened: 598,  status: 'Sent'      },
  { id: 'nl13', sentAt: daysAgo(8, 14,  0), type: 'Broadcast',  title: 'Flash Sale: Transform 90',     body: '24-hour offer: Join Transform 90 at 30% off. Limited spots.',             target: 'Inactive users',            sentTo: 234,  delivered: 221,  opened: 98,   status: 'Sent'      },
  { id: 'nl14', sentAt: daysAgo(0, 10,  0), type: 'Broadcast',  title: 'Upcoming Webinar',             body: 'Free webinar: Understanding PCOS — this Saturday 11 AM IST.',             target: 'All users',                 sentTo: 0,    delivered: 0,    opened: 0,    status: 'Scheduled' },
  { id: 'nl15', sentAt: daysAgo(10,16,  0), type: 'Inactivity', title: 'Come back! Your coach misses you', body: 'It\'s been a week. Let\'s get back on track together.',              target: 'Inactive users',            sentTo: 89,   delivered: 84,   opened: 29,   status: 'Sent'      },
  { id: 'nl16', sentAt: daysAgo(12, 9,  0), type: 'Scheduled',  title: 'Weekly Summary',               body: 'Check out your progress this week!',                                     target: 'All users',                 sentTo: 1380, delivered: 1330, opened: 567,  status: 'Sent'      },
  { id: 'nl17', sentAt: daysAgo(14,15,  0), type: 'Broadcast',  title: 'New Coach Joined Vitalé',      body: 'Welcome Dr. Sunita Rao — specialist in Diabetic Wellness!',               target: 'All users',                 sentTo: 1450, delivered: 1398, opened: 412,  status: 'Sent'      },
  { id: 'nl18', sentAt: daysAgo(3, 18,  0), type: 'Broadcast',  title: 'Community Feature Launch',     body: 'The Community feed is now live — connect with fellow members!',           target: 'All users',                 sentTo: 1450, delivered: 0,    opened: 0,    status: 'Failed'    },
];

export const PROGRAM_TARGETS = [
  'PCOS Reversal Program',
  'Transform 90',
  'Gut Reset 30-Day',
  'Diabetic Wellness',
  'Cardiac Wellness',
  'Weight Loss Journey',
  'Thyroid Balance Program',
];

export const NOTIF_STATS = {
  sentToday: 1907,
  deliveryRate: 97.1,
  avgOpenRate: 44.3,
  scheduledToday: 4,
};
