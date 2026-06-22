import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Users, Loader2, AlertCircle, Info, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCollaborationRequests, useCreateCollaborationRequest, useUpdateCollaborationRequest,
  useCollaborationAgreements, useCarePlans,
  type CollabRequestStatus, type CollabAgreementStatus, type CarePlanStatus,
} from '@/lib/collaboration';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const REQ_STATUS_COLOR: Record<CollabRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700', accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};
const AGREE_STATUS_COLOR: Record<CollabAgreementStatus, string> = {
  active: 'bg-green-100 text-green-700', ended: 'bg-gray-100 text-gray-500',
};
const PLAN_STATUS_COLOR: Record<CarePlanStatus, string> = {
  active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500',
};
const short = (id: string) => id.slice(0, 8);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function Collaborations() {
  const [, navigate] = useLocation();
  const myOrg = useAuthStore((s) => s.user?.organizationId);

  const requests = useCollaborationRequests();
  const agreements = useCollaborationAgreements();
  const carePlans = useCarePlans();
  const createReq = useCreateCollaborationRequest();
  const updateReq = useUpdateCollaborationRequest();

  const [tab, setTab] = useState('requests');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ toOrganizationId: '', userId: '', message: '' });

  const reqs = requests.data ?? [];
  const incoming = useMemo(() => reqs.filter((r) => r.toOrganizationId === myOrg), [reqs, myOrg]);
  const outgoing = useMemo(() => reqs.filter((r) => r.fromOrganizationId === myOrg), [reqs, myOrg]);
  const pendingIncoming = incoming.filter((r) => r.status === 'pending').length;
  const activeAgreements = (agreements.data ?? []).filter((a) => a.status === 'active').length;

  function send() {
    if (!myOrg) { toast.error('No organization in session'); return; }
    if (!form.toOrganizationId || !form.userId) { toast.error('Partner org ID and shared client ID are required'); return; }
    createReq.mutate(
      { fromOrganizationId: myOrg, toOrganizationId: form.toOrganizationId.trim(), userId: form.userId.trim(), message: form.message.trim() || undefined },
      {
        onSuccess: () => { toast.success('Collaboration request sent'); setOpen(false); setForm({ toOrganizationId: '', userId: '', message: '' }); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not send request'),
      },
    );
  }

  function respond(id: string, status: 'accepted' | 'declined' | 'cancelled') {
    updateReq.mutate({ id, status }, {
      onSuccess: () => toast.success(`Request ${status}`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update request'),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Collaborations</h1>
          <p className="text-muted-foreground mt-0.5">
            {activeAgreements} active agreement{activeAgreements !== 1 ? 's' : ''} · {pendingIncoming} request{pendingIncoming !== 1 ? 's' : ''} to review
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!myOrg}><Plus className="w-4 h-4 mr-2" /> New Request</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="care-plans">Care Plans</TabsTrigger>
        </TabsList>

        {/* Requests */}
        <TabsContent value="requests" className="space-y-3">
          {requests.isLoading ? <Loading /> : requests.isError ? <ErrorState onRetry={() => requests.refetch()} /> : reqs.length === 0 ? (
            <Empty icon={<Users className="w-8 h-8 opacity-40" />} text="No collaboration requests yet." />
          ) : (
            <>
              {incoming.length > 0 && <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Incoming</p>}
              {incoming.map((r) => (
                <Card key={r.id}><CardContent className="p-4 flex items-center gap-3">
                  <ArrowDownLeft className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">From org <span className="font-mono">{short(r.fromOrganizationId)}</span> · client <span className="font-mono">{short(r.userId)}</span></p>
                    {r.message && <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(r.createdAt)}</p>
                  </div>
                  <Badge className={`border-0 text-xs capitalize ${REQ_STATUS_COLOR[r.status]}`}>{r.status}</Badge>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respond(r.id, 'accepted')}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => respond(r.id, 'declined')}>Decline</Button>
                    </div>
                  )}
                </CardContent></Card>
              ))}
              {outgoing.length > 0 && <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide pt-2">Outgoing</p>}
              {outgoing.map((r) => (
                <Card key={r.id}><CardContent className="p-4 flex items-center gap-3">
                  <ArrowUpRight className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">To org <span className="font-mono">{short(r.toOrganizationId)}</span> · client <span className="font-mono">{short(r.userId)}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(r.createdAt)}</p>
                  </div>
                  <Badge className={`border-0 text-xs capitalize ${REQ_STATUS_COLOR[r.status]}`}>{r.status}</Badge>
                  {r.status === 'pending' && <Button size="sm" variant="outline" onClick={() => respond(r.id, 'cancelled')}>Cancel</Button>}
                </CardContent></Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Agreements */}
        <TabsContent value="agreements" className="space-y-3">
          {agreements.isLoading ? <Loading /> : agreements.isError ? <ErrorState onRetry={() => agreements.refetch()} /> : (agreements.data ?? []).length === 0 ? (
            <Empty icon={<Users className="w-8 h-8 opacity-40" />} text="No collaboration agreements yet." />
          ) : (agreements.data ?? []).map((a) => (
            <Card key={a.id}><CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm">Primary <span className="font-mono">{short(a.primaryOrganizationId)}</span> ↔ Collaborating <span className="font-mono">{short(a.collaboratingOrganizationId)}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Client <span className="font-mono">{short(a.userId)}</span> · {fmtDate(a.startDate)}{a.endDate ? ` – ${fmtDate(a.endDate)}` : ''}</p>
                </div>
                {a.revenueSharePct != null && <Badge variant="secondary" className="text-xs">Rev share {a.revenueSharePct}%</Badge>}
                <Badge className={`border-0 text-xs capitalize ${AGREE_STATUS_COLOR[a.status]}`}>{a.status}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        {/* Care plans */}
        <TabsContent value="care-plans" className="space-y-3">
          {carePlans.isLoading ? <Loading /> : carePlans.isError ? <ErrorState onRetry={() => carePlans.refetch()} /> : (carePlans.data ?? []).length === 0 ? (
            <Empty icon={<Users className="w-8 h-8 opacity-40" />} text="No care plans yet." />
          ) : (carePlans.data ?? []).map((p) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-sm" onClick={() => navigate(`${BASE}/admin/clients/${p.userId}`)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Client <span className="font-mono">{short(p.userId)}</span> · v{p.currentVersion} · {fmtDate(p.startDate)}</p>
                </div>
                <Badge className={`border-0 text-xs capitalize ${PLAN_STATUS_COLOR[p.status]}`}>{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* New request */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Collaboration Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              Coach/organization discovery isn't available yet (no directory endpoint). Enter the partner organization ID and the shared client's user ID directly.
            </div>
            <div className="space-y-1.5">
              <Label>Partner Organization ID *</Label>
              <Input value={form.toOrganizationId} onChange={(e) => setForm((f) => ({ ...f, toOrganizationId: e.target.value }))} placeholder="uuid" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Shared Client (user ID) *</Label>
              <Input value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} placeholder="uuid" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={3} placeholder="Optional note to the receiving org" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={createReq.isPending}>{createReq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load.<Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>;
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">{icon}{text}</div>;
}
