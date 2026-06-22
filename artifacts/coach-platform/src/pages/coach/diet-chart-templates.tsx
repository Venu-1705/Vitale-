import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useDietCharts, type DietChartStatus } from '@/lib/nutrition';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const STATUS_COLOR: Record<DietChartStatus, string> = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', archived: 'bg-red-100 text-red-700' };

/**
 * Diet Chart Templates (D4). Diet charts ARE the reusable templates (org-scoped),
 * assigned to clients via assignments — there's no separate "template" entity, so
 * this lists the org's charts.
 */
export default function DietChartTemplates() {
  const [, navigate] = useLocation();
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: charts = [], isLoading, isError, refetch } = useDietCharts(organizationId ? { organizationId } : {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Diet Chart Templates</h1>
          <p className="text-muted-foreground mt-0.5">Reusable charts you can assign to clients</p>
        </div>
        <Button onClick={() => navigate(`${BASE}/admin/diet-charts/new`)}><Plus className="w-4 h-4 mr-2" /> New Chart</Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground max-w-2xl">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Diet charts double as templates — there's no separate template entity. Assign a chart to a client to deliver a stamped version.
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load charts.<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
      ) : charts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground"><FileText className="w-8 h-8 opacity-40" /> No diet charts yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {charts.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`${BASE}/admin/diet-charts/${c.id}`)}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">{c.title}<Badge className={`text-[10px] border-0 capitalize ${STATUS_COLOR[c.status]}`}>{c.status}</Badge></CardTitle></CardHeader>
              <CardContent>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">{c.totalDailyCalories != null ? `${c.totalDailyCalories} kcal/day · ` : ''}v{c.currentVersion}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
