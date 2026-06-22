import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Send, ChevronRight, Plus, Loader2, AlertCircle, Info, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getUserId } from '@/lib/session';
import { useAuthStore } from '@/stores/auth-store';
import {
  useConversations, useMessages, useSendMessage, useCreateConversation, useMarkConversationRead,
  type Conversation, type ConversationType,
} from '@/lib/messaging';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const short = (id: string | null) => (id ? id.slice(0, 8) : '—');
const TYPE_LABEL: Record<ConversationType, string> = {
  coach_user: 'Coach ↔ Client', staff_user: 'Staff ↔ Client', care_team: 'Care Team', community_peer: 'Peer',
};

function ChatPanel({ conversation }: { conversation: Conversation }) {
  const me = getUserId();
  const messagesQuery = useMessages(conversation.id, { limit: 100 });
  const send = useSendMessage(conversation.id);
  const markRead = useMarkConversationRead(conversation.id);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Newest-first from the API → render chronologically.
  const messages = useMemo(() => [...(messagesQuery.data ?? [])].reverse(), [messagesQuery.data]);

  useEffect(() => { markRead.mutate(); /* eslint-disable-next-line */ }, [conversation.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setText(''),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not send'),
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-3 shrink-0 bg-background">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
          {short(conversation.subjectUserId).slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm font-mono">{short(conversation.subjectUserId)}</p>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[conversation.conversationType]} · {conversation.status}</p>
        </div>
        {conversation.subjectUserId && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => window.location.assign(`${BASE}/admin/clients/${conversation.subjectUserId}`)}>
            View Client <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
        {messagesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : messagesQuery.isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load messages.</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">No messages yet. Say hello.</div>
        ) : messages.map((m) => {
          const isMe = m.senderUserId === me;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="flex flex-col max-w-[70%]">
                {!isMe && <span className="text-[10px] text-muted-foreground mb-0.5 font-mono">{short(m.senderUserId)}</span>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-white border shadow-sm rounded-tl-sm'}`}>
                  {m.body}
                  <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {m.editedAt && <span>· edited</span>}
                    {isMe && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="p-3 bg-background border-t shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Type a message… (Enter to send)"
            className="flex-1 resize-none text-sm bg-muted/30 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 min-h-[36px] max-h-32 border border-transparent focus:border-primary/30"
            rows={1}
          />
          <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={submit} disabled={!text.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [, navigate] = useLocation();
  const myOrg = useAuthStore((s) => s.user?.organizationId);
  const { data: conversations = [], isLoading, isError, refetch } = useConversations();
  const createConv = useCreateConversation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<{ conversationType: ConversationType; subjectUserId: string }>({ conversationType: 'coach_user', subjectUserId: '' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? conversations.filter((c) => (c.subjectUserId ?? '').toLowerCase().includes(q)) : conversations;
  }, [conversations, search]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function create() {
    if (!form.subjectUserId) { toast.error('Client/peer user ID is required'); return; }
    if (form.conversationType !== 'community_peer' && !myOrg) { toast.error('No organization in session'); return; }
    createConv.mutate(
      { conversationType: form.conversationType, subjectUserId: form.subjectUserId.trim(), organizationId: form.conversationType === 'community_peer' ? undefined : myOrg },
      {
        onSuccess: (c) => { toast.success('Conversation started'); setActiveId(c.id); setNewOpen(false); setForm({ conversationType: 'coach_user', subjectUserId: '' }); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not start conversation'),
      },
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0 overflow-hidden rounded-xl border bg-background">
      {/* LEFT — conversations */}
      <div className="w-80 shrink-0 flex flex-col border-r">
        <div className="p-4 border-b shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`${BASE}/admin/messages/broadcast`)}>Broadcast</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client ID…" className="pl-8 h-8 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm"><AlertCircle className="w-5 h-5 text-destructive" /><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No conversations.</div>
          ) : filtered.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 border-b text-left hover:bg-muted/30 transition-colors ${activeId === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                {short(c.subjectUserId).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm font-mono truncate">{short(c.subjectUserId)}</p>
                <p className="text-xs text-muted-foreground truncate">{TYPE_LABEL[c.conversationType]}</p>
              </div>
              {c.status === 'archived' && <Badge variant="secondary" className="text-[10px]">archived</Badge>}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — chat */}
      {active ? <ChatPanel key={active.id} conversation={active} /> : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Conversation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              No recipient directory exists yet — enter the client's (or peer's) user ID directly. Conversations are 1:1 and consent/basis-gated by the backend.
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.conversationType} onValueChange={(v) => setForm((f) => ({ ...f, conversationType: v as ConversationType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach_user">Coach ↔ Client</SelectItem>
                  <SelectItem value="staff_user">Staff ↔ Client</SelectItem>
                  <SelectItem value="care_team">Care Team</SelectItem>
                  <SelectItem value="community_peer">Peer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client / Peer User ID *</Label>
              <Input value={form.subjectUserId} onChange={(e) => setForm((f) => ({ ...f, subjectUserId: e.target.value }))} placeholder="uuid" className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={createConv.isPending}>{createConv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
