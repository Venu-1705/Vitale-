export type AccessLevel = 'View' | 'Create' | 'Edit' | 'Delete';
export type ResourceType = 'Diet Charts' | 'Recipes' | 'Clients' | 'Programs' | 'Analytics' | 'Messages';
export type TeamStatus = 'Active' | 'Invited' | 'Deactivated';

export interface Permission {
  resource: ResourceType;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface TeamActivityEntry {
  id: string;
  action: string;
  entity: string;
  timestamp: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  initials: string;
  color: string;
  assignedPrograms: string[];
  status: TeamStatus;
  lastActive: string;
  permissions: Permission[];
  activityLog: TeamActivityEntry[];
  dietChartsCreated: number;
  clientsMessaged: number;
  tasksCompleted: number;
}

export const PERMISSION_TEMPLATES: Record<string, Permission[]> = {
  'Nutritionist': [
    { resource: 'Diet Charts', view: true, create: true, edit: true, delete: false },
    { resource: 'Recipes', view: true, create: true, edit: true, delete: false },
    { resource: 'Clients', view: true, create: false, edit: false, delete: false },
    { resource: 'Programs', view: true, create: false, edit: false, delete: false },
    { resource: 'Analytics', view: true, create: false, edit: false, delete: false },
    { resource: 'Messages', view: true, create: true, edit: false, delete: false },
  ],
  'Admin Assistant': [
    { resource: 'Diet Charts', view: true, create: false, edit: false, delete: false },
    { resource: 'Recipes', view: true, create: false, edit: false, delete: false },
    { resource: 'Clients', view: true, create: true, edit: true, delete: false },
    { resource: 'Programs', view: true, create: false, edit: false, delete: false },
    { resource: 'Analytics', view: true, create: false, edit: false, delete: false },
    { resource: 'Messages', view: true, create: true, edit: false, delete: false },
  ],
  'Content Manager': [
    { resource: 'Diet Charts', view: true, create: false, edit: false, delete: false },
    { resource: 'Recipes', view: true, create: true, edit: true, delete: true },
    { resource: 'Clients', view: false, create: false, edit: false, delete: false },
    { resource: 'Programs', view: true, create: true, edit: true, delete: false },
    { resource: 'Analytics', view: true, create: false, edit: false, delete: false },
    { resource: 'Messages', view: false, create: false, edit: false, delete: false },
  ],
  'Custom': [
    { resource: 'Diet Charts', view: false, create: false, edit: false, delete: false },
    { resource: 'Recipes', view: false, create: false, edit: false, delete: false },
    { resource: 'Clients', view: false, create: false, edit: false, delete: false },
    { resource: 'Programs', view: false, create: false, edit: false, delete: false },
    { resource: 'Analytics', view: false, create: false, edit: false, delete: false },
    { resource: 'Messages', view: false, create: false, edit: false, delete: false },
  ],
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1', name: 'Neha Kapoor', email: 'neha.kapoor@vitale.com', roleTitle: 'Senior Nutritionist',
    initials: 'NK', color: 'bg-violet-500',
    assignedPrograms: ['Weight Loss Intensive', 'Diabetes Control Program', 'PCOS Reversal Program'],
    status: 'Active', lastActive: '15 min ago',
    permissions: PERMISSION_TEMPLATES['Nutritionist'],
    activityLog: [
      { id: 'ta-1', action: 'Updated diet chart', entity: 'Arjun Mehta - Phase 2 Chart', timestamp: '15 min ago' },
      { id: 'ta-2', action: 'Created new recipe', entity: 'Sprouted Moong Salad', timestamp: '2 hours ago' },
      { id: 'ta-3', action: 'Sent message', entity: 'Rahul Verma', timestamp: '3 hours ago' },
      { id: 'ta-4', action: 'Updated diet chart', entity: 'Priya Sharma - Hormonal Reset', timestamp: 'Yesterday' },
    ],
    dietChartsCreated: 48, clientsMessaged: 125, tasksCompleted: 312,
  },
  {
    id: 'tm-2', name: 'Rahul Tripathi', email: 'rahul.tripathi@vitale.com', roleTitle: 'Admin Assistant',
    initials: 'RT', color: 'bg-blue-500',
    assignedPrograms: ['Weight Loss Intensive', 'Athletic Performance', 'Senior Wellness Program'],
    status: 'Active', lastActive: '1 hour ago',
    permissions: PERMISSION_TEMPLATES['Admin Assistant'],
    activityLog: [
      { id: 'ta-5', action: 'Added new client', entity: 'Ananya Chatterjee', timestamp: '1 hour ago' },
      { id: 'ta-6', action: 'Updated client profile', entity: 'Mohan Iyer', timestamp: '3 hours ago' },
      { id: 'ta-7', action: 'Sent message', entity: 'Suresh Kumar (follow-up)', timestamp: 'Yesterday' },
    ],
    dietChartsCreated: 0, clientsMessaged: 89, tasksCompleted: 245,
  },
  {
    id: 'tm-3', name: 'Divya Menon', email: 'divya.menon@vitale.com', roleTitle: 'Content Manager',
    initials: 'DM', color: 'bg-emerald-500',
    assignedPrograms: ['All Programs'],
    status: 'Active', lastActive: '30 min ago',
    permissions: PERMISSION_TEMPLATES['Content Manager'],
    activityLog: [
      { id: 'ta-8', action: 'Published new recipe', entity: 'Ragi Smoothie Bowl', timestamp: '30 min ago' },
      { id: 'ta-9', action: 'Updated program content', entity: 'PCOS Reversal - Week 6 Module', timestamp: '2 hours ago' },
      { id: 'ta-10', action: 'Created recipe collection', entity: 'Anti-Inflammatory Foods', timestamp: 'Yesterday' },
    ],
    dietChartsCreated: 0, clientsMessaged: 0, tasksCompleted: 187,
  },
  {
    id: 'tm-4', name: 'Sanjay Bose', email: 'sanjay.bose@vitale.com', roleTitle: 'Nutritionist',
    initials: 'SB', color: 'bg-orange-500',
    assignedPrograms: ['Gut Reset Program', 'Thyroid Balance Program'],
    status: 'Active', lastActive: '2 hours ago',
    permissions: PERMISSION_TEMPLATES['Nutritionist'],
    activityLog: [
      { id: 'ta-11', action: 'Created diet chart', entity: 'Meera Pillai - Gut Reset Phase 1', timestamp: '2 hours ago' },
      { id: 'ta-12', action: 'Updated diet chart', entity: 'Sunita Reddy - Metabolism Boost', timestamp: 'Yesterday' },
    ],
    dietChartsCreated: 32, clientsMessaged: 67, tasksCompleted: 198,
  },
  {
    id: 'tm-5', name: 'Aisha Khan', email: 'aisha.khan@vitale.com', roleTitle: 'Client Success Manager',
    initials: 'AK', color: 'bg-pink-500',
    assignedPrograms: ['Weight Loss Intensive', 'Diabetes Control Program'],
    status: 'Invited', lastActive: 'Never',
    permissions: PERMISSION_TEMPLATES['Admin Assistant'],
    activityLog: [],
    dietChartsCreated: 0, clientsMessaged: 0, tasksCompleted: 0,
  },
];
