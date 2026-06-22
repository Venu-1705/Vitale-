import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Loader2, Info, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { apiPost } from '@/lib/api';
import {
  useCreateDietChart, useDietChart, type MealType, type DietChartStatus,
} from '@/lib/nutrition';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const STATUSES: DietChartStatus[] = ['draft', 'active', 'archived'];

interface DraftMeal { mealType: MealType; name: string; timeOfDay: string; notes: string }
const emptyMeal = (): DraftMeal => ({ mealType: 'breakfast', name: '', timeOfDay: '', notes: '' });

/**
 * Diet Chart Builder (D4). Creates a chart then appends its meals. NOTE: there's
 * no chart-UPDATE endpoint, so the /edit route shows the existing chart read-only
 * and lets you append meals; basic fields can't be edited in place (documented gap).
 */
export default function DietChartBuilder() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const organizationId = useAuthStore((s) => s.user?.organizationId);

  const existing = useDietChart(isEdit ? params.id : undefined);
  const createChart = useCreateDietChart();

  const [form, setForm] = useState({ title: '', description: '', totalDailyCalories: '', status: 'draft' as DietChartStatus });
  const [meals, setMeals] = useState<DraftMeal[]>([emptyMeal()]);
  const [busy, setBusy] = useState(false);

  async function appendMeals(chartId: string) {
    const valid = meals.filter((m) => m.name.trim() || m.timeOfDay.trim());
    for (let i = 0; i < valid.length; i++) {
      const m = valid[i];
      await apiPost(`/diet-charts/${chartId}/meals`, {
        mealType: m.mealType,
        ...(m.name.trim() ? { name: m.name.trim() } : {}),
        ...(m.timeOfDay.trim() ? { timeOfDay: m.timeOfDay.trim() } : {}),
        ...(m.notes.trim() ? { notes: m.notes.trim() } : {}),
        sortOrder: i,
      });
    }
  }

  function createNew() {
    if (!organizationId) { toast.error('No organization in session'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setBusy(true);
    createChart.mutate(
      { organizationId, title: form.title.trim(), description: form.description.trim() || undefined, totalDailyCalories: form.totalDailyCalories ? Number(form.totalDailyCalories) : undefined, status: form.status },
      {
        onSuccess: async (chart) => {
          try { await appendMeals(chart.id); toast.success('Diet chart created'); } catch { toast.error('Chart created, but some meals failed'); }
          navigate(`${BASE}/admin/diet-charts/${chart.id}`);
        },
        onError: (e: unknown) => { setBusy(false); toast.error(e instanceof Error ? e.message : 'Could not create chart'); },
      },
    );
  }

  async function addMealsToExisting() {
    if (!params.id) return;
    setBusy(true);
    try { await appendMeals(params.id); toast.success('Meals added'); navigate(`${BASE}/admin/diet-charts/${params.id}`); }
    catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : 'Could not add meals'); }
  }

  if (isEdit && existing.isLoading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading chart…</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/diet-charts`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Diet Chart' : 'New Diet Chart'}</h1>
          <p className="text-sm text-muted-foreground">{isEdit ? 'Add meals to this chart' : 'Create a chart and its meals'}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Diet charts have no in-place update endpoint. {isEdit ? 'Existing fields are read-only; you can append new meals.' : 'Set the details and meals once at creation.'}
      </div>

      {/* Basics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isEdit && existing.data ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{existing.data.title}</p>
              {existing.data.description && <p className="text-muted-foreground">{existing.data.description}</p>}
              <p className="text-xs text-muted-foreground">{existing.data.totalDailyCalories != null ? `${existing.data.totalDailyCalories} kcal/day · ` : ''}v{existing.data.currentVersion} · {existing.data.status}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Daily calories</Label><Input type="number" min={0} value={form.totalDailyCalories} onChange={(e) => setForm((f) => ({ ...f, totalDailyCalories: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DietChartStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Existing meals (edit mode) */}
      {isEdit && existing.data && existing.data.meals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Existing meals</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {[...existing.data.meals].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm border-b last:border-0 py-1.5">
                <Badge variant="secondary" className="text-xs capitalize">{m.mealType}</Badge>
                <span>{m.name ?? '—'}</span>
                {m.timeOfDay && <span className="text-xs text-muted-foreground ml-auto">{m.timeOfDay}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Meals to add */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" /> {isEdit ? 'Add meals' : 'Meals'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {meals.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Select value={m.mealType} onValueChange={(v) => setMeals((arr) => arr.map((x, j) => (j === i ? { ...x, mealType: v as MealType } : x)))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{MEAL_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="col-span-4" value={m.name} onChange={(e) => setMeals((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Meal name" />
              <Input className="col-span-2" value={m.timeOfDay} onChange={(e) => setMeals((arr) => arr.map((x, j) => (j === i ? { ...x, timeOfDay: e.target.value } : x)))} placeholder="08:00" />
              <Input className="col-span-2" value={m.notes} onChange={(e) => setMeals((arr) => arr.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} placeholder="Notes" />
              <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => setMeals((arr) => arr.filter((_, j) => j !== i))} disabled={meals.length === 1}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setMeals((arr) => [...arr, emptyMeal()])}><Plus className="w-3.5 h-3.5 mr-1" /> Add meal</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`${BASE}/admin/diet-charts`)}>Cancel</Button>
        <Button onClick={isEdit ? addMealsToExisting : createNew} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Add Meals' : 'Create Chart'}</Button>
      </div>
    </div>
  );
}
