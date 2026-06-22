import { Card, CardContent } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';

/**
 * Weekly Reports — INTENTIONALLY NOT BACKED.
 *
 * The original mock rendered fabricated weekly adherence/engagement analytics
 * (promotion/demotion, scores, trends). No backend domain produces per-client
 * weekly rollups, and the underlying signals (health observations, meal logs)
 * are consent-gated point reads — not an aggregate analytics surface. Per the
 * no-fabrication rule, the analytics were removed rather than invented.
 *
 * Real, consent-gated client data lives on the Health Data and Diet Activity
 * tabs. A weekly-rollup analytics domain is a documented gap.
 */
export default function WeeklyReportsTab() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="max-w-md mx-auto text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-muted mx-auto flex items-center justify-center">
            <BarChart2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">Weekly reports aren't available yet</p>
          <p className="text-sm text-muted-foreground">
            There's no backend that produces weekly adherence/engagement rollups, and client
            health and meal data are consent-gated point reads — not analytics. Use the
            Health Data and Diet Activity tabs for the real, audited views.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
