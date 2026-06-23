import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, ShieldCheck, ClipboardList, Utensils } from 'lucide-react';
import HealthDataTab from './HealthDataTab';
import DietActivityTab from './DietActivityTab';
import WeeklyReportsTab from './WeeklyReportsTab';
import { useCarePlans, type CarePlanStatus } from '@/lib/collaboration';
import { useDietChartAssignments, type AssignmentStatus } from '@/lib/nutrition';
import { QueryError } from '@/components/QueryError';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const short = (id: string) => id.slice(0, 8);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const PLAN_STATUS_COLOR: Record<CarePlanStatus, string> = {
  active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500',
};
const ASSIGN_STATUS_COLOR: Record<AssignmentStatus, string> = {
  active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700', ended: 'bg-gray-100 text-gray-500',
};

/**
 * Client detail (care loop hub). The route :id IS the client's user UUID — the
 * subject for every consent-gated read. We deliberately show NO name/email/phone
 * or fabricated scores: the backend exposes no client PII to coaches (D1), and
 * health/meal data are consent-gated point reads surfaced on their own tabs.
 */
export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const subjectUserId = id ?? '';

  const carePlansQuery = useCarePlans();
  const assignmentsQuery = useDietChartAssignments();

  const carePlans = useMemo(() => (carePlansQuery.data ?? []).filter((p) => p.userId === subjectUserId), [carePlansQuery.data, subjectUserId]);
  const assignments = useMemo(() => (assignmentsQuery.data ?? []).filter((a) => a.userId === subjectUserId), [assignmentsQuery.data, subjectUserId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/clients`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {subjectUserId.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">Client</h1>
            <p className="text-xs text-muted-foreground font-mono">{subjectUserId}</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        Client identity and health data are protected. You see only what this client has consented to share with your organization; every health/diet read is audited.
      </div>

      <Tabs defaultValue="care">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="care">Care Plans</TabsTrigger>
          <TabsTrigger value="health-data">Health Data</TabsTrigger>
          <TabsTrigger value="diet-activity">Diet Activity</TabsTrigger>
          <TabsTrigger value="diet-charts">Diet Charts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Care Plans (D9) */}
        <TabsContent value="care" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Care Plans</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {carePlansQuery.isLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              ) : carePlansQuery.isError ? (
                <QueryError compact message="Couldn't load care plans." onRetry={() => carePlansQuery.refetch()} retrying={carePlansQuery.isRefetching} />
              ) : carePlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No care plans for this client.</p>
              ) : carePlans.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">v{p.currentVersion} · {fmtDate(p.startDate)}{p.endDate ? ` – ${fmtDate(p.endDate)}` : ''}</p>
                  </div>
                  <Badge className={`border-0 text-xs capitalize ${PLAN_STATUS_COLOR[p.status]}`}>{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Data (D5, consent-gated) */}
        <TabsContent value="health-data">
          <HealthDataTab subjectUserId={subjectUserId} />
        </TabsContent>

        {/* Diet Activity (D4, consent-gated) */}
        <TabsContent value="diet-activity">
          <DietActivityTab subjectUserId={subjectUserId} />
        </TabsContent>

        {/* Diet Charts assigned to this client (D4) */}
        <TabsContent value="diet-charts" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" /> Assigned Diet Charts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {assignmentsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              ) : assignmentsQuery.isError ? (
                <QueryError compact message="Couldn't load assigned diet charts." onRetry={() => assignmentsQuery.refetch()} retrying={assignmentsQuery.isRefetching} />
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No diet charts assigned to this client.</p>
              ) : assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="text-sm">Chart <span className="font-mono">{short(a.dietChartId)}</span></p>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.startDate)}{a.endDate ? ` – ${fmtDate(a.endDate)}` : ''}</p>
                  </div>
                  <Badge className={`border-0 text-xs capitalize ${ASSIGN_STATUS_COLOR[a.status]}`}>{a.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <WeeklyReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
