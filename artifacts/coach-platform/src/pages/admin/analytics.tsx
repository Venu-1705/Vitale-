import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Analytics — NOT BACKED. There is no analytics/reporting domain in the backend.
 * The original mock rendered fabricated funnels, engagement, leaderboard, and
 * retention dashboards. The only real aggregate the platform computes is merchant
 * revenue (confirmed-order ₹ totals + by-status), which already lives on the
 * Storefront → Revenue tab. Everything else is removed rather than invented.
 */
export default function Analytics() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Platform metrics &amp; reporting</p>
      </div>
      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Not available</CardTitle></CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><BarChart3 className="w-7 h-7 text-muted-foreground" /></div>
            <h2 className="text-lg font-semibold">Analytics dashboards aren't available</h2>
            <p className="text-sm text-muted-foreground">
              There's no analytics or reporting backend. Engagement funnels, retention curves, leaderboards, and
              conversion metrics can't be computed from the existing APIs, so they were removed instead of faked.
            </p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> The one real aggregate — merchant revenue (₹ totals + by-status) — is on Storefront → Revenue.
            </div>
            <Button onClick={() => navigate(`${BASE}/admin/storefront`)}>View Revenue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
