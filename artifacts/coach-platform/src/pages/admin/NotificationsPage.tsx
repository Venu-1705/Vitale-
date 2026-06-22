import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Loader2, AlertCircle, CheckCheck, Info, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllRead,
  type AppNotification,
} from '@/lib/notifications';

function priorityColor(p: string | null): string {
  if (p === 'high' || p === 'urgent') return 'bg-red-100 text-red-700';
  if (p === 'low') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-700';
}

function NotificationRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b ${n.read ? '' : 'bg-primary/5'}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'}`}>
        <Bell className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{n.title}</p>
          {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
        </div>
        {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
        <div className="flex items-center gap-2 mt-1">
          {n.typeName && <Badge variant="secondary" className="text-[10px]">{n.typeName}</Badge>}
          {n.priority && <Badge className={`text-[10px] border-0 capitalize ${priorityColor(n.priority)}`}>{n.priority}</Badge>}
          <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      {!n.read && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onRead(n.id)}><Check className="w-3.5 h-3.5 mr-1" /> Mark read</Button>
      )}
    </div>
  );
}

/**
 * Notifications — the caller's OWN inbox (D10). The original mock was an admin
 * send/schedule/broadcast console with fabricated audiences and delivery/open
 * rates; the backend exposes none of that — only the recipient's inbox, an
 * unread badge, and mark-read/read-all. Authoring, scheduling, broadcast, and
 * delivery analytics are a documented gap, not faked here.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const list = useNotifications(tab === 'unread' ? { unread: true, limit: 100 } : { limit: 100 });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  function readOne(id: string) {
    markRead.mutate(id, { onError: () => toast.error('Could not mark read') });
  }
  function readAll() {
    markAll.mutate(undefined, {
      onSuccess: (r) => toast.success(r.updated > 0 ? `${r.updated} marked read` : 'All caught up'),
      onError: () => toast.error('Could not mark all read'),
    });
  }

  const items = list.data ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-0.5">{unread.data ?? 0} unread</p>
        </div>
        <Button variant="outline" onClick={readAll} disabled={markAll.isPending || (unread.data ?? 0) === 0}>
          {markAll.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />} Mark all read
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        This is your personal notification inbox. Composing, scheduling, broadcasting, and delivery analytics aren't backend-supported and were removed rather than fabricated.
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Inbox</CardTitle>
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
          ) : list.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load notifications.<Button variant="outline" size="sm" onClick={() => list.refetch()}>Retry</Button></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><Bell className="w-8 h-8 opacity-40" />{tab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</div>
          ) : (
            items.map((n) => <NotificationRow key={n.id} n={n} onRead={readOne} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
