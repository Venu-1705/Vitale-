import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, AlertCircle, ShieldCheck, LineChart as LineChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ApiError } from '@/lib/api';
import {
  useMetricDefinitions, useHealthObservations, observationValue,
  type MetricCategory,
} from '@/lib/health';

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  vital: 'Vitals', body_composition: 'Body Composition', activity: 'Activity', sleep: 'Sleep',
  nutrition_derived: 'Nutrition', lab: 'Lab', wearable: 'Wearable',
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/**
 * Client Health Data (D5) — audited, consent-gated. The coach reads ONE metric
 * over a closed [from,to] window; the backend re-enforces the access predicate
 * and writes an audit row. Without an active health_data grant the read 403s,
 * which we surface honestly. Admins get no ambient access here.
 */
export default function HealthDataTab({ subjectUserId }: { subjectUserId: string }) {
  const metrics = useMetricDefinitions({ activeOnly: true });
  const [metricId, setMetricId] = useState<string>('');
  const [fromDate, setFromDate] = useState(isoDaysAgo(90));
  const [toDate, setToDate] = useState(isoDaysAgo(0));

  const obs = useHealthObservations({ subjectUserId, metricDefinitionId: metricId || undefined, fromDate, toDate });
  const metric = metrics.data?.find((m) => m.id === metricId);

  const chartData = useMemo(() => {
    const rows = obs.data ?? [];
    return rows
      .filter((o) => o.valueNumeric != null)
      .map((o) => ({ date: o.measuredDateIst, value: o.valueNumeric as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [obs.data]);

  const denied = obs.isError && obs.error instanceof ApiError && obs.error.status === 403;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        Health readings are consent-gated. Access requires an active <span className="font-medium">health_data</span> grant from this client; every read is audited. Pick a metric and date range to view readings.
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Readings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label>Metric</Label>
              <Select value={metricId} onValueChange={setMetricId} disabled={metrics.isLoading}>
                <SelectTrigger><SelectValue placeholder={metrics.isLoading ? 'Loading…' : 'Select a metric'} /></SelectTrigger>
                <SelectContent>
                  {(metrics.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.displayName} · {CATEGORY_LABELS[m.category]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          {!metricId ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Select a metric to load this client's readings.</p>
          ) : obs.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading readings…</div>
          ) : denied ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-center">
              <ShieldCheck className="w-7 h-7 text-amber-500" />
              <p className="font-medium text-foreground">No access to this client's health data</p>
              <p className="text-sm max-w-sm">You don't hold an active consent grant for this client's health readings. Ask the client to grant access, or check your <span className="font-medium">view_client_health</span> capability.</p>
            </div>
          ) : obs.isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load readings.</div>
          ) : (obs.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No readings for this metric in the selected window.</p>
          ) : (
            <>
              {chartData.length >= 2 && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                      <YAxis fontSize={11} width={40} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="rounded-lg border divide-y">
                {obs.data!.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <LineChartIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 font-medium">{observationValue(o)}</span>
                    {metric?.canonicalUnit && o.unit == null && <span className="text-xs text-muted-foreground">{metric.canonicalUnit}</span>}
                    <Badge variant="secondary" className="text-[10px] capitalize">{o.source.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(o.measuredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
