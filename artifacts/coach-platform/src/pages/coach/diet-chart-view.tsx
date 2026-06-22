import { useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Edit2, Loader2, AlertCircle, Utensils, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError } from '@/lib/api';
import { useAccessGrants } from '@/lib/access';
import { useDietChart, useAssignDietChart, type MealType, type DietChartStatus } from '@/lib/nutrition';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const STATUS_COLOR: Record<DietChartStatus, string> = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', archived: 'bg-red-100 text-red-700' };

export default function DietChartView() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: chart, isLoading, isError, refetch } = useDietChart(id);

  // Assign-to-client modal (clients = the org's active access-grant subjects).
  const organizationId = useAuthStore((s) => s.user?.organizationId) ?? '';
  const grants = useAccessGrants();
  const assign = useAssignDietChart();
  const [assignOpen, setAssignOpen] = useState(false);
  const [clientUserId, setClientUserId] = useState('');
  const [startDate, setStartDate] = useState('');

  const clientOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const g of grants.data ?? []) {
      if (organizationId && g.organizationId !== organizationId) continue;
      if (g.status === 'active') ids.add(g.userId);
    }
    return Array.from(ids);
  }, [grants.data, organizationId]);

  const handleAssign = async () => {
    if (!id) return;
    if (!clientUserId) { toast.error('Pick a client.'); return; }
    try {
      await assign.mutateAsync({ dietChartId: id, userId: clientUserId, ...(startDate ? { startDate } : {}) });
      toast.success('Diet chart assigned.');
      setAssignOpen(false);
      setClientUserId('');
      setStartDate('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) toast.error("You don't have permission to assign this chart.");
      else if (err instanceof ApiError && err.status === 404) toast.error('Chart not found.');
      else if (err instanceof ApiError && err.status === 409) toast.error('This client already has this chart assigned.');
      else toast.error('Could not assign the chart.');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  if (isError || !chart) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertCircle className="w-7 h-7 text-destructive" /> Couldn't load this diet chart.
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button><Button variant="ghost" size="sm" onClick={() => navigate(`${BASE}/admin/diet-charts`)}>Back</Button></div>
      </div>
    );
  }

  const meals = [...chart.meals].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/diet-charts`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{chart.title}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Badge className={`text-[10px] border-0 capitalize ${STATUS_COLOR[chart.status]}`}>{chart.status}</Badge>
            <span>v{chart.currentVersion}</span>
            {chart.totalDailyCalories != null && <span>· {chart.totalDailyCalories} kcal/day</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}><UserPlus className="w-4 h-4 mr-1.5" /> Assign to Client</Button>
        <Button size="sm" onClick={() => navigate(`${BASE}/admin/diet-charts/${chart.id}/edit`)}><Edit2 className="w-4 h-4 mr-1.5" /> Edit</Button>
      </div>

      {chart.description && <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{chart.description}</p></CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" /> Meals</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No meals defined.</p>
          ) : meals.map((m) => (
            <div key={m.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{MEAL_LABEL[m.mealType]}</Badge>
                {m.name && <span className="text-sm font-medium">{m.name}</span>}
                {m.timeOfDay && <span className="text-xs text-muted-foreground ml-auto">{m.timeOfDay}</span>}
              </div>
              {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign “{chart.title}” to a client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              {clientOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clients yet. Share your organization ID so a client can grant access from the app.
                </p>
              ) : (
                <Select value={clientUserId} onValueChange={setClientUserId}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clientOptions.map((cid) => (
                      <SelectItem key={cid} value={cid}>Client …{cid.slice(-6)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Start date (optional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assign.isPending || clientOptions.length === 0}>
              {assign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
