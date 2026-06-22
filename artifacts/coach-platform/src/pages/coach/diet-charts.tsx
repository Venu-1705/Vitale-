import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Utensils, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useDietCharts, useCreateDietChart, type DietChart, type DietChartStatus,
} from '@/lib/nutrition';

const STATUSES: DietChartStatus[] = ['draft', 'active', 'archived'];

function statusStyle(s: DietChartStatus) {
  if (s === 'active') return 'bg-green-100 text-green-700';
  if (s === 'draft') return 'bg-gray-100 text-gray-600';
  return 'bg-red-100 text-red-700';
}
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DietCharts() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: charts = [], isLoading, isError, refetch } = useDietCharts(organizationId ? { organizationId } : {});
  const createChart = useCreateDietChart();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<DietChartStatus | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', calories: '', status: 'draft' as DietChartStatus });

  const filtered = useMemo<DietChart[]>(() => {
    const needle = q.trim().toLowerCase();
    return charts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (needle && !c.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [charts, q, statusFilter]);

  const counts = useMemo(() => ({
    total: charts.length,
    active: charts.filter((c) => c.status === 'active').length,
    draft: charts.filter((c) => c.status === 'draft').length,
    archived: charts.filter((c) => c.status === 'archived').length,
  }), [charts]);

  function create() {
    if (!organizationId) { toast.error('No organization in session'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    createChart.mutate(
      {
        organizationId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        totalDailyCalories: form.calories ? Number(form.calories) : undefined,
        status: form.status,
      },
      {
        onSuccess: () => { toast.success('Diet chart created'); setOpen(false); setForm({ title: '', description: '', calories: '', status: 'draft' }); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not create chart'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Diet Charts</h1>
          <p className="text-muted-foreground mt-0.5">{counts.total} total · {counts.active} active · {counts.draft} draft</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!organizationId}><Plus className="w-4 h-4 mr-2" /> New Diet Chart</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search charts…" className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DietChartStatus | 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b"><CardTitle className="text-lg">Templates</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading diet charts…</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load diet charts.<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><Utensils className="w-8 h-8 opacity-40" />{charts.length === 0 ? 'No diet charts yet.' : 'No charts match your filters.'}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Daily Calories</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{c.title}</p>
                      {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{c.totalDailyCalories != null ? `${c.totalDailyCalories} kcal` : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{c.currentVersion}</TableCell>
                    <TableCell><Badge className={`text-xs border-0 capitalize ${statusStyle(c.status)}`}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(c.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Diet Chart</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. PCOS Anti-inflammatory Plan" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Daily Calories</Label>
                <Input type="number" min={0} value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} placeholder="1600" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DietChartStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={createChart.isPending}>{createChart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
