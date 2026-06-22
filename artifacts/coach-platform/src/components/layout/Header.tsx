import React, { useState } from 'react';
import { Menu, Search, Bell, LogOut, User, Settings, HelpCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Link, useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/lib/notifications';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);

  // D10 notifications — the caller's own inbox preview.
  const unreadCount = useUnreadCount();
  const recent = useNotifications({ limit: 6 });
  const markAll = useMarkAllRead();
  const unread = unreadCount.data ?? 0;

  // Generate breadcrumbs from path
  const pathParts = location.split('/').filter(Boolean);
  const pageName = pathParts[pathParts.length - 1] || 'dashboard';
  const formattedPageName = pageName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const initials = user?.name.split(' ').map(n => n[0]).join('') || 'U';

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="hidden sm:flex items-center text-sm font-medium text-muted-foreground">
          <span>Vitalé</span>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-foreground capitalize">{formattedPageName}</span>
        </div>
      </div>

      <div className="flex-1 max-w-xl px-4 sm:px-8 relative hidden md:block">
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            className="pl-10 bg-muted/50 border-transparent focus:bg-white focus:border-primary transition-all w-full" 
            placeholder="Search clients, programmes, recipes..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
        
        {/* Search Dropdown Placeholder */}
        {searchFocused && (
          <div className="absolute top-full left-4 sm:left-8 right-4 sm:right-8 mt-2 bg-white rounded-lg shadow-lg border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Recent</div>
              <div className="px-2 py-2 hover:bg-muted rounded text-sm cursor-pointer flex items-center justify-between">
                <span>Rahul Desai</span>
                <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded">Client</span>
              </div>
              <div className="px-2 py-2 hover:bg-muted rounded text-sm cursor-pointer flex items-center justify-between">
                <span>Weight Loss 90 Days</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Program</span>
              </div>
            </div>
            <div className="bg-muted p-2 border-t border-border text-center">
              <span className="text-xs text-primary font-medium cursor-pointer hover:underline">View all results</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center border-2 border-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 mr-4 mt-2" align="end">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h4 className="font-semibold">Notifications</h4>
              <button
                className="text-xs text-primary hover:underline disabled:opacity-50"
                disabled={markAll.isPending || unread === 0}
                onClick={() => markAll.mutate()}
              >
                Mark all as read
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {(recent.data ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications.</div>
              ) : (recent.data ?? []).map((n) => (
                <div key={n.id} className={`p-4 border-b border-border/50 hover:bg-muted/50 cursor-pointer flex gap-3 relative ${n.read ? '' : 'bg-primary/5'}`}>
                  {!n.read && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-border bg-muted/30 text-center">
              <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => navigate(`${BASE}/admin/notifications`)}>
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-medium text-sm border border-border shadow-sm">
                {initials}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <div className="mt-2 text-xs font-semibold px-2 py-0.5 bg-muted rounded-full w-fit uppercase">
                  {user?.role}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings" className="cursor-pointer flex w-full">
                <User className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings" className="cursor-pointer flex w-full">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help & Support</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
