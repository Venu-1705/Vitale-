export interface MessageAttachment {
  type: 'image' | 'pdf' | 'diet_chart' | 'recipe';
  name: string;
  url?: string;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'Coach' | 'Team Member' | 'Client';
  senderInitials: string;
  senderColor: string;
  text?: string;
  attachment?: MessageAttachment;
  timestamp: string;
  time: string;
  isSystem?: boolean;
  reactions?: { emoji: string; count: number }[];
  read: boolean;
  delivered: boolean;
}

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  online: boolean;
  pinned: boolean;
  messages: ChatMessage[];
}

export const QUICK_REPLY_TEMPLATES = [
  { id: 't-1', name: 'Diet Chart Ready', content: 'Your new diet chart is ready! Please check the Diet Charts section.' },
  { id: 't-2', name: 'Great Progress', content: 'Great progress! Keep up the consistency.' },
  { id: 't-3', name: 'Weekly Check-in', content: 'Please complete your weekly check-in when you get a chance.' },
  { id: 't-4', name: 'Consultation Reminder', content: 'Your next consultation is scheduled. Please be on time and come prepared with your check-in report.' },
  { id: 't-5', name: 'Supplement Reminder', content: 'Hi! Just a reminder to take your supplements as prescribed — morning with breakfast and evening with dinner.' },
  { id: 't-6', name: 'Missed Check-in', content: 'We noticed you missed your weekly check-in. Please submit it at your earliest convenience so we can track your progress accurately.' },
];

function makeMsg(
  id: string, senderId: string, senderName: string, senderRole: 'Coach' | 'Team Member' | 'Client',
  initials: string, color: string, text: string, time: string, timestamp: string,
  read = true, delivered = true
): ChatMessage {
  return { id, senderId, senderName, senderRole, senderInitials: initials, senderColor: color, text, timestamp, time, read, delivered, reactions: [] };
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1', clientId: 'c-001', clientName: 'Arjun Mehta', clientInitials: 'AM', clientColor: 'bg-blue-500',
    lastMessage: 'Did I need to take supplements today?', lastMessageTime: '10:42 AM', unreadCount: 2, online: true, pinned: true,
    messages: [
      { id: 'm-sys-1', senderId: 'system', senderName: '', senderRole: 'Team Member', senderInitials: '', senderColor: '', text: 'Diet chart updated — Phase 2: Active Fat Burn', timestamp: 'Apr 20, 2026', time: '', isSystem: true, read: true, delivered: true },
      makeMsg('m-1-1', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Good morning Arjun! How are you feeling today? Did you stick to the morning walk?', '09:15 AM', 'Today'),
      makeMsg('m-1-2', 'c-001', 'Arjun Mehta', 'Client', 'AM', 'bg-blue-500', 'Good morning Doctor! Yes, did 30 minutes walk. Feeling much better this week.', '09:28 AM', 'Today'),
      makeMsg('m-1-3', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Excellent! Keep it up. Your blood sugar readings are looking much better too.', '09:35 AM', 'Today'),
      makeMsg('m-1-4', 'c-001', 'Arjun Mehta', 'Client', 'AM', 'bg-blue-500', 'Did I need to take supplements today?', '10:42 AM', 'Today', false, true),
      makeMsg('m-1-5', 'c-001', 'Arjun Mehta', 'Client', 'AM', 'bg-blue-500', 'Also, can I have coconut water in the evening?', '10:43 AM', 'Today', false, true),
    ],
  },
  {
    id: 'conv-2', clientId: 'c-002', clientName: 'Priya Sharma', clientInitials: 'PS', clientColor: 'bg-pink-500',
    lastMessage: 'Thank you so much doctor!', lastMessageTime: 'Yesterday', unreadCount: 0, online: true, pinned: true,
    messages: [
      makeMsg('m-2-1', 'c-002', 'Priya Sharma', 'Client', 'PS', 'bg-pink-500', 'Doctor, my period came after 3 months! I am so happy!', '2:15 PM', 'Yesterday'),
      makeMsg('m-2-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is wonderful news Priya! This is a great sign that the protocol is working. Keep following the diet diligently.', '2:30 PM', 'Yesterday'),
      makeMsg('m-2-3', 'c-002', 'Priya Sharma', 'Client', 'PS', 'bg-pink-500', 'Thank you so much doctor!', '2:32 PM', 'Yesterday'),
    ],
  },
  {
    id: 'conv-3', clientId: 'c-003', clientName: 'Rahul Verma', clientInitials: 'RV', clientColor: 'bg-green-500',
    lastMessage: 'My sugar levels this morning were 142.', lastMessageTime: 'Tuesday', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-3-1', 'c-003', 'Rahul Verma', 'Client', 'RV', 'bg-green-500', 'My sugar levels this morning were 142.', '7:30 AM', 'Tuesday'),
      makeMsg('m-3-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is much better than when you started. What did you have for dinner last night?', '9:00 AM', 'Tuesday'),
      makeMsg('m-3-3', 'c-003', 'Rahul Verma', 'Client', 'RV', 'bg-green-500', 'Dal khichdi with some sabzi. No rice.', '9:05 AM', 'Tuesday'),
      makeMsg('m-3-4', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Perfect choice! Continue this pattern. Please submit your weekly check-in today.', '9:10 AM', 'Tuesday'),
    ],
  },
  {
    id: 'conv-4', clientId: 'c-004', clientName: 'Anjali Singh', clientInitials: 'AS', clientColor: 'bg-purple-500',
    lastMessage: 'Should I increase my protein intake?', lastMessageTime: 'Monday', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-4-1', 'c-004', 'Anjali Singh', 'Client', 'AS', 'bg-purple-500', 'Should I increase my protein intake? I have been feeling tired after workouts.', '6:45 PM', 'Monday'),
      makeMsg('m-4-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Yes, let us increase it to 100g per day. I will update your diet chart accordingly.', '7:00 PM', 'Monday'),
      { id: 'm-4-sys', senderId: 'system', senderName: '', senderRole: 'Team Member', senderInitials: '', senderColor: '', text: 'Diet chart updated by Dr. Radha', timestamp: 'Monday', time: '7:15 PM', isSystem: true, read: true, delivered: true },
    ],
  },
  {
    id: 'conv-5', clientId: 'c-011', clientName: 'Rohan Gupta', clientInitials: 'RG', clientColor: 'bg-cyan-500',
    lastMessage: 'Ready for tomorrow\'s session!', lastMessageTime: '2 days ago', unreadCount: 0, online: true, pinned: false,
    messages: [
      makeMsg('m-5-1', 'c-011', 'Rohan Gupta', 'Client', 'RG', 'bg-cyan-500', 'Just completed the 5K run in 22 minutes!', '6:00 PM', 'Wed'),
      makeMsg('m-5-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Amazing improvement! You have come a long way from 28 minutes when you started.', '6:10 PM', 'Wed'),
      makeMsg('m-5-3', 'c-011', 'Rohan Gupta', 'Client', 'RG', 'bg-cyan-500', 'Ready for tomorrow\'s session!', '6:12 PM', 'Wed'),
    ],
  },
  {
    id: 'conv-6', clientId: 'c-007', clientName: 'Kartik Joshi', clientInitials: 'KJ', clientColor: 'bg-red-500',
    lastMessage: 'Can I have a cheat meal on Sunday?', lastMessageTime: '3 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-6-1', 'c-007', 'Kartik Joshi', 'Client', 'KJ', 'bg-red-500', 'Can I have a cheat meal on Sunday? My friend\'s birthday.', '8:00 PM', 'Tue'),
      makeMsg('m-6-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Since you are in a bulking phase, one celebration meal is fine. Just avoid alcohol and prioritize protein even then.', '8:30 PM', 'Tue'),
    ],
  },
  {
    id: 'conv-7', clientId: 'c-016', clientName: 'Pooja Menon', clientInitials: 'PM', clientColor: 'bg-emerald-500',
    lastMessage: 'Lost 2 kgs this month!', lastMessageTime: '3 days ago', unreadCount: 0, online: true, pinned: false,
    messages: [
      makeMsg('m-7-1', 'c-016', 'Pooja Menon', 'Client', 'PM', 'bg-emerald-500', 'Lost 2 kgs this month! So excited!', '5:00 PM', 'Tue'),
      makeMsg('m-7-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Excellent work Pooja! Consistency is key. Keep it up!', '5:15 PM', 'Tue'),
    ],
  },
  {
    id: 'conv-8', clientId: 'c-008', clientName: 'Meera Pillai', clientInitials: 'MP', clientColor: 'bg-indigo-500',
    lastMessage: 'The bloating has reduced a lot!', lastMessageTime: '4 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-8-1', 'c-008', 'Meera Pillai', 'Client', 'MP', 'bg-indigo-500', 'The bloating has reduced a lot since switching to the gut reset diet!', '3:00 PM', 'Mon'),
      makeMsg('m-8-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is wonderful to hear. The elimination protocol is working. Keep avoiding the trigger foods.', '3:30 PM', 'Mon'),
    ],
  },
  {
    id: 'conv-9', clientId: 'c-013', clientName: 'Suresh Kumar', clientInitials: 'SK', clientColor: 'bg-lime-600',
    lastMessage: 'Missed check-in this week.', lastMessageTime: '1 week ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-9-1', 'c-013', 'Suresh Kumar', 'Client', 'SK', 'bg-lime-600', 'Sorry, was busy with work. Missed check-in this week.', '9:00 AM', 'Last Mon'),
      makeMsg('m-9-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is okay. Please try to be consistent. Sending you the check-in form again.', '10:00 AM', 'Last Mon'),
    ],
  },
  {
    id: 'conv-10', clientId: 'c-018', clientName: 'Ritu Bhatia', clientInitials: 'RB', clientColor: 'bg-pink-600',
    lastMessage: 'Having trouble following the diet.', lastMessageTime: '1 week ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-10-1', 'c-018', 'Ritu Bhatia', 'Client', 'RB', 'bg-pink-600', 'Having trouble following the vegan + gluten-free diet. Very restrictive.', '2:00 PM', 'Last Tue'),
      makeMsg('m-10-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Let us schedule a call to discuss some easier meal options. I understand it is challenging.', '3:00 PM', 'Last Tue'),
    ],
  },
  {
    id: 'conv-11', clientId: 'c-005', clientName: 'Vikram Nair', clientInitials: 'VN', clientColor: 'bg-orange-500',
    lastMessage: 'Cholesterol report shows improvement!', lastMessageTime: '5 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-11-1', 'c-005', 'Vikram Nair', 'Client', 'VN', 'bg-orange-500', 'Cholesterol report shows improvement! LDL came down by 20 points.', '11:00 AM', 'Last Wed'),
      makeMsg('m-11-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Excellent! The Mediterranean-style meal plan is definitely working. Continue with the omega-3 rich foods.', '11:30 AM', 'Last Wed'),
    ],
  },
  {
    id: 'conv-12', clientId: 'c-012', clientName: 'Kavitha Nambiar', clientInitials: 'KN', clientColor: 'bg-fuchsia-500',
    lastMessage: 'Skin is clearing up too!', lastMessageTime: '6 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-12-1', 'c-012', 'Kavitha Nambiar', 'Client', 'KN', 'bg-fuchsia-500', 'Not only am I losing weight, skin is clearing up too! The anti-inflammatory diet is amazing.', '4:00 PM', 'Last Thu'),
      makeMsg('m-12-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is a great sign that your inflammation is reducing. The skin improvement is a wonderful bonus!', '4:15 PM', 'Last Thu'),
    ],
  },
  {
    id: 'conv-13', clientId: 'c-006', clientName: 'Sunita Reddy', clientInitials: 'SR', clientColor: 'bg-teal-500',
    lastMessage: 'Feeling more energetic lately', lastMessageTime: '2 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-13-1', 'c-006', 'Sunita Reddy', 'Client', 'SR', 'bg-teal-500', 'Feeling more energetic lately. The metabolism seems to be improving.', '10:00 AM', '2 days ago'),
      makeMsg('m-13-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'That is the thyroid responding to the protocol. Keep up the good work!', '10:30 AM', '2 days ago'),
    ],
  },
  {
    id: 'conv-14', clientId: 'c-014', clientName: 'Ananya Chatterjee', clientInitials: 'AC', clientColor: 'bg-violet-500',
    lastMessage: 'Which protein powder do you recommend?', lastMessageTime: '2 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-14-1', 'c-014', 'Ananya Chatterjee', 'Client', 'AC', 'bg-violet-500', 'Which protein powder do you recommend for vegetarians?', '3:00 PM', '2 days ago'),
      makeMsg('m-14-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'I recommend a good pea protein isolate or brown rice protein. Avoid whey if you are lactose sensitive.', '3:30 PM', '2 days ago'),
    ],
  },
  {
    id: 'conv-15', clientId: 'c-020', clientName: 'Geeta Krishnamurthy', clientInitials: 'GK', clientColor: 'bg-teal-600',
    lastMessage: 'My knee pain has reduced significantly.', lastMessageTime: '3 days ago', unreadCount: 0, online: false, pinned: false,
    messages: [
      makeMsg('m-15-1', 'c-020', 'Geeta Krishnamurthy', 'Client', 'GK', 'bg-teal-600', 'My knee pain has reduced significantly after adding turmeric and anti-inflammatory foods.', '9:00 AM', '3 days ago'),
      makeMsg('m-15-2', 'coach', 'Dr. Radha', 'Coach', 'DR', 'bg-green-600', 'Wonderful! Keep the curcumin supplementation going as well. You are making great progress.', '9:30 AM', '3 days ago'),
    ],
  },
];
