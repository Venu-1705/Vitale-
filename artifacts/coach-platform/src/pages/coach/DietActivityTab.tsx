import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Utensils, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useNutritionLogs, type MealType } from '@/lib/nutrition';

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};
const MEAL_COLOR: Record<MealType, string> = {
  breakfast: 'bg-amber-100 text-amber-700', lunch: 'bg-green-100 text-green-700',
  dinner: 'bg-indigo-100 text-indigo-700', snack: 'bg-rose-100 text-rose-700',
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/**
 * Client Diet Activity (D4) — audited, consent-gated meal logs. Reads via the
 * audited rpc_read_nutrition_logs; a coach needs an active grant on the subject
 * (403 surfaced honestly). Logs are grouped by day for review.
 */
export default function DietActivityTab({ subjectUserId }: { subjectUserId: string }) {
  const [fromDate, setFromDate] = useState(isoDaysAgo(14));
  const [toDate, setToDate] = useState(isoDaysAgo(0));

  const logs = useNutritionLogs({ subjectUserId, fromDate, toDate });
  const denied = logs.isError && logs.error instanceof ApiError && logs.error.status === 403;

  const byDay = useMemo(() => {
    const map = new Map<string, typeof logs.data>();
    for (const l of logs.data ?? []) {
      const arr = map.get(l.loggedDateIst) ?? [];
      arr.push(l);
      map.set(l.loggedDateIst, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs.data]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        Meal logs are consent-gated and audited. You see a client's logs only with an active grant.
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" /> Meal Logs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          {logs.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading logs…</div>
          ) : denied ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-center">
              <ShieldCheck className="w-7 h-7 text-amber-500" />
              <p className="font-medium text-foreground">No access to this client's diet activity</p>
              <p className="text-sm max-w-sm">You don't hold an active consent grant for this client's meal logs.</p>
            </div>
          ) : logs.isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load logs.</div>
          ) : byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No meal logs in the selected window.</p>
          ) : (
            <div className="space-y-4">
              {byDay.map(([day, dayLogs]) => (
                <div key={day}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                    {new Date(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="rounded-lg border divide-y">
                    {(dayLogs ?? []).map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <Badge className={`border-0 text-xs ${MEAL_COLOR[l.mealType]}`}>{MEAL_LABEL[l.mealType]}</Badge>
                        <span className="flex-1 text-muted-foreground">{l.note || '—'}</span>
                        {l.totalCalories != null && <span className="text-xs font-medium">{l.totalCalories} kcal</span>}
                        <Badge variant="secondary" className="text-[10px] capitalize">{l.source.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(l.loggedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
