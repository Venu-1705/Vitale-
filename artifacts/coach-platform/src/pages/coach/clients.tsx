import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Users, Loader2, AlertCircle, Info, ChevronRight, UserPlus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useCarePlans } from '@/lib/collaboration';
import { useAccessGrants, type GrantDataCategory } from '@/lib/access';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const short = (id: string) => id.slice(0, 8);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const CATEGORY_LABEL: Record<GrantDataCategory, string> = {
  health_data: 'Health', meals: 'Meals', programs: 'Programs', lab_results: 'Labs',
  community: 'Community', orders: 'Orders', messages: 'Messages', clinical: 'Clinical',
};

interface ClientRow {
  userId: string;
  categories: GrantDataCategory[]; // consented data categories (active grants)
  hasActiveGrant: boolean;
  carePlans: number;
  since: string | null;
}

/**
 * Clients — derived from D2 access grants naming this org (the consent signal that
 * makes a newly-onboarded client appear), unioned with D9 care plans. There is no
 * client-invitation entity, so onboarding is: share the org id → client grants
 * consent (mobile) → they appear here. No client PII is shown (D1 deferred).
 */
export default function Clients() {
  const [, navigate] = useLocation();
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const grants = useAccessGrants();
  const carePlans = useCarePlans();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLoading = grants.isLoading || carePlans.isLoading;
  const isError = grants.isError || carePlans.isError;

  const clients = useMemo<ClientRow[]>(() => {
    const byUser = new Map<string, ClientRow>();
    // Grants naming this org → consented clients.
    for (const g of grants.data ?? []) {
      if (organizationId && g.organizationId !== organizationId) continue;
      const row = byUser.get(g.userId) ?? { userId: g.userId, categories: [], hasActiveGrant: false, carePlans: 0, since: null };
      if (g.status === 'active') {
        row.hasActiveGrant = true;
        for (const c of g.dataCategoriesGranted) if (!row.categories.includes(c)) row.categories.push(c);
      }
      const when = g.grantedAt ?? g.createdAt;
      if (!row.since || when < row.since) row.since = when;
      byUser.set(g.userId, row);
    }
    // Care plans → also clients (may predate or lack a grant).
    for (const p of carePlans.data ?? []) {
      const row = byUser.get(p.userId) ?? { userId: p.userId, categories: [], hasActiveGrant: false, carePlans: 0, since: null };
      row.carePlans += 1;
      if (!row.since || p.createdAt < row.since) row.since = p.createdAt;
      byUser.set(p.userId, row);
    }
    const rows = Array.from(byUser.values());
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.userId.toLowerCase().includes(q)) : rows;
  }, [grants.data, carePlans.data, organizationId, search]);

  const inviteText = organizationId
    ? `Join my coaching on Vitalé. In the app, grant access to organization ID: ${organizationId}`
    : '';

  function copyInvite() {
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} disabled={!organizationId}><UserPlus className="w-4 h-4 mr-2" /> Invite Client</Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground max-w-2xl">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Clients appear here once they grant your organization access (consent). Open a client to view their consent-gated, audited health and diet records.
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client ID…" className="pl-8" />
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b"><CardTitle className="text-lg">All Clients</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading clients…</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load clients.<Button variant="outline" size="sm" onClick={() => { grants.refetch(); carePlans.refetch(); }}>Retry</Button></div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><Users className="w-8 h-8 opacity-40" /> No clients yet. Invite a client to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Consented data</TableHead>
                  <TableHead>Care plans</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.userId} className="cursor-pointer hover:bg-muted/20" onClick={() => navigate(`${BASE}/admin/clients/${c.userId}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{c.userId.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <span className="font-mono text-xs">{short(c.userId)}</span>
                          {!c.hasActiveGrant && c.carePlans > 0 && <Badge variant="outline" className="ml-2 text-[10px]">no active grant</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.categories.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : c.categories.map((cat) => <Badge key={cat} variant="secondary" className="text-[10px]">{CATEGORY_LABEL[cat]}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.carePlans}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(c.since)}</TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Client */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invite a Client</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              There's no automated client invite yet. Share your organization ID — the client grants your org access from their app, then appears in your list.
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Your Organization ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded px-2 py-2 font-mono break-all">{organizationId}</code>
                <Button variant="outline" size="icon" onClick={copyInvite}>{copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Invite message</p>
              <div className="text-sm bg-muted/40 rounded-lg p-3">{inviteText}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
            <Button onClick={() => { copyInvite(); toast.success('Invite copied'); }}>Copy Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
