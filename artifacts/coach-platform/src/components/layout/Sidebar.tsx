import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, BookOpen, UserCircle, Briefcase, Calendar,
  MessageSquare, BarChart3, Settings, Video, FileText, Utensils,
  Share2, Award, ShoppingBag, ShieldAlert, UsersRound, HeartHandshake,
  ChevronLeft, ChevronRight, ArrowRight, Leaf, CheckSquare, CalendarCheck,
  Megaphone, Gamepad2, Bell, Library,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [location] = useLocation();
  const { role, user } = useAuthStore();

  const adminLinks = [
    { section: 'Main' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: UserCircle, label: 'Coaches', href: '/admin/coaches', badge: 12 },
    { icon: BookOpen, label: 'Programs', href: '/admin/programs' },
    { icon: Users, label: 'Users', href: '/admin/users', badge: 1450 },
    { section: 'Content' },
    { icon: Briefcase, label: 'Services', href: '/admin/services' },
    { icon: UsersRound, label: 'Workshops', href: '/admin/workshops' },
    { icon: Calendar, label: 'Events', href: '/admin/events' },
    { icon: HeartHandshake, label: 'Community', href: '/admin/community' },
    { icon: Library, label: 'Resources', href: '/admin/resources' },
    { icon: CheckSquare, label: 'Habits', href: '/admin/habits' },
    { section: 'System' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
    { icon: Gamepad2, label: 'Gamification', href: '/admin/gamification' },
    { icon: Bell, label: 'Notifications', href: '/admin/notifications' },
    { icon: ShieldAlert, label: 'Audit Logs', href: '/admin/audit-logs' },
    { section: 'Integrations' },
    { icon: Video, label: 'Zoom Integration', href: '/admin/zoom' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  const coachLinks = [
    { section: 'Main' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: BookOpen, label: 'My Programs', href: '/admin/my-programs' },
    { icon: FileText, label: 'Diet Charts', href: '/admin/diet-charts', badge: 3 },
    { icon: Utensils, label: 'Recipes', href: '/admin/recipes' },
    { section: 'Content' },
    { icon: Megaphone, label: 'Community', href: '/admin/coach-community' },
    { icon: Library, label: 'Resources', href: '/admin/resources' },
    { icon: CheckSquare, label: 'Habits', href: '/admin/habits' },
    { section: 'Network' },
    { icon: Users, label: 'My Team', href: '/admin/my-team' },
    { icon: Share2, label: 'Collaborations', href: '/admin/collaborations' },
    { icon: UserCircle, label: 'Clients', href: '/admin/clients' },
    { icon: Video, label: 'Sessions', href: '/admin/sessions' },
    { icon: CalendarCheck, label: 'Bookings', href: '/admin/bookings' },
    { icon: MessageSquare, label: 'Messages', href: '/admin/messages', badge: 5 },
    { section: 'Growth' },
    { icon: Briefcase, label: 'Services', href: '/admin/services' },
    { icon: UsersRound, label: 'Workshops', href: '/admin/workshops' },
    { icon: Calendar, label: 'Events', href: '/admin/events' },
    { icon: ShoppingBag, label: 'Storefront', href: '/admin/storefront' },
    { icon: Award, label: 'Leaderboard', href: '/admin/leaderboard' },
    { icon: CheckSquare, label: 'Habits', href: '/admin/habits' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
    { section: 'Integrations' },
    { icon: Video, label: 'Zoom Integration', href: '/admin/zoom' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  const teamLinks = [
    { section: 'Main' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: BookOpen, label: 'Assigned Programs', href: '/admin/assigned-programs' },
    { icon: FileText, label: 'Diet Charts', href: '/admin/diet-charts' },
    { icon: Utensils, label: 'Recipes', href: '/admin/recipes' },
    { icon: UserCircle, label: 'Clients', href: '/admin/clients' },
    { icon: MessageSquare, label: 'Messages', href: '/admin/messages', badge: 2 },
    { section: 'System' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  const collabLinks = [
    { section: 'Main' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Share2, label: 'Shared Programs', href: '/admin/shared-programs' },
    { icon: FileText, label: 'Diet Charts', href: '/admin/diet-charts' },
    { icon: UserCircle, label: 'Clients', href: '/admin/clients' },
    { icon: MessageSquare, label: 'Messages', href: '/admin/messages', badge: 1 },
    { section: 'System' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  let links = adminLinks;
  if (role === 'coach') links = coachLinks;
  else if (role === 'team') links = teamLinks;
  else if (role === 'collab') links = collabLinks;

  const initials = user?.name.split(' ').map(n => n[0]).join('') || 'U';

  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col z-20",
      isOpen ? "w-64" : "w-20"
    )}>
      {/* Top: Logo & Toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          {isOpen && <span className="font-display font-semibold text-lg whitespace-nowrap text-white">Vitalé</span>}
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground hover:text-white p-1 rounded-md transition-colors hidden md:block"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* User profile */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 font-medium text-sidebar-accent-foreground border border-sidebar-border">
          {initials}
        </div>
        {isOpen && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-white truncate">{user?.name}</span>
            <span className="text-xs text-sidebar-primary uppercase tracking-wider font-semibold truncate">
              {user?.title || role}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <nav className="space-y-1 px-2">
          {links.map((item, idx) => {
            if (item.section) {
              if (!isOpen) return <div key={`sec-${idx}`} className="h-4" />;
              return (
                <div key={`sec-${idx}`} className="px-3 pt-4 pb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.section}
                  </p>
                </div>
              );
            }

            const Icon = item.icon as React.ElementType;
            const isActive = location.startsWith(item.href || '') && item.href !== '/admin';

            const linkContent = (
              <Link key={idx} href={item.href || '#'} 
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group relative",
                  isActive 
                    ? "bg-sidebar-accent text-white" 
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-white"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md" />
                )}
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-white")} />
                
                {isOpen && (
                  <div className="flex-1 flex justify-between items-center overflow-hidden">
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                    {item.badge && (
                      <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                
                {!isOpen && item.badge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </Link>
            );

            if (!isOpen) {
              return (
                <Tooltip key={idx} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>
      </div>

      {/* Refer & Earn */}
      {(role === 'admin' || role === 'coach') && isOpen && (
        <div className="p-4 m-4 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <h4 className="text-sm font-bold text-white mb-1">Refer and Earn</h4>
          <p className="text-xs text-sidebar-foreground mb-3 leading-relaxed">
            Refer Vitalé and earn 20% commission
          </p>
          <button className="text-xs font-semibold text-primary flex items-center gap-1 hover:text-white transition-colors">
            Invite friends <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
