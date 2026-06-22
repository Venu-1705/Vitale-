import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

/**
 * Generic "this domain is deferred / has no API yet" surface. Used for D6
 * (gamification / habits / leaderboard), which has DB scaffolding but NO HTTP API
 * — there are no badge/streak/leaderboard endpoints to read or write. Rather than
 * fabricate streaks/rankings, these pages tell the truth.
 */
export function DeferredDomain({ pageTitle, subtitle, title, icon, reason }: {
  pageTitle: string;
  subtitle: string;
  title: string;
  icon: ReactNode;
  reason: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg flex items-center gap-2">{icon} Not available yet</CardTitle></CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center">{icon}</div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{reason}</p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Gamification (badges, streaks, leaderboards) is a <span className="text-foreground font-medium">deferred domain (D6)</span>: the data model exists but no API endpoints are implemented. No scores or rankings are fabricated here.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
