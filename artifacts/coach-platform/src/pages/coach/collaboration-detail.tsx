import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, AlertCircle, Users, History } from 'lucide-react';
import {
  useCarePlan, useCareTeam, useCarePlanVersions,
  type CareTeamRole, type CarePlanStatus,
} from '@/lib/collaboration';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const short = (id: string) => id.slice(0, 8);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const ROLE_LABELS: Record<CareTeamRole, string> = {
  lead: 'Lead', nutritionist: 'Nutritionist', community_manager: 'Community Manager', collaborating_specialist: 'Collaborating Specialist',
};
const PLAN_STATUS_COLOR: Record<CarePlanStatus, string> = {
  active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500',
};

/**
 * Care plan detail (D9). NOTE: this page is not currently wired to a route in
 * App.tsx; it renders a care plan by :id when reached. Migrated off mock so it
 * shows real plan + care-team roster + the append-only version ledger.
 */
export default function CollaborationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const plan = useCarePlan(id);
  const team = useCareTeam(id);
  const versions = useCarePlanVersions(id);

  if (plan.isLoading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading care plan…</div>;
  }
  if (plan.isError || !plan.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertCircle className="w-7 h-7 text-destructive" /> Couldn't load this care plan.
        <Button variant="outline" size="sm" onClick={() => navigate(`${BASE}/admin/collaborations`)}>Back</Button>
      </div>
    );
  }

  const p = plan.data;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/collaborations`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{p.title}</h1>
          <p className="text-sm text-muted-foreground">Client <span className="font-mono">{short(p.userId)}</span> · v{p.currentVersion}</p>
        </div>
        <Badge className={`border-0 text-xs capitalize ${PLAN_STATUS_COLOR[p.status]}`}>{p.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Plan</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {p.description && <p className="text-muted-foreground">{p.description}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-muted-foreground">Start</p><p className="font-medium">{fmtDate(p.startDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">End</p><p className="font-medium">{fmtDate(p.endDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Owning org</p><p className="font-medium font-mono">{short(p.organizationId)}</p></div>
            <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{fmtDate(p.createdAt)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Care Team</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {team.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading team…</p>
          ) : (team.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No team members.</p>
          ) : team.data!.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{ROLE_LABELS[m.roleInTeam].charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ROLE_LABELS[m.roleInTeam]}</p>
                <p className="text-xs text-muted-foreground font-mono">{short(m.memberUserId)} · org {short(m.organizationId)}</p>
                {m.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.capabilities.map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c.replace(/_/g, ' ')}</Badge>)}
                  </div>
                )}
              </div>
              <Badge className={`border-0 text-xs capitalize ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Version History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {versions.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
          ) : (versions.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No versions recorded.</p>
          ) : versions.data!.map((v) => (
            <div key={v.id} className="flex items-center gap-3 text-sm border-b last:border-0 py-2">
              <Badge variant="outline" className="text-xs">v{v.versionNumber}</Badge>
              <span className="flex-1 text-muted-foreground">{v.changeSummary ?? 'Snapshot'}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(v.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
