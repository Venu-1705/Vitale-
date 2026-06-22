import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Shared honest "this domain has no backend" surface. Used for the D7
 * Booking / Availability / Services / Events / Workshops cluster, which has NO
 * router or schema in the canonical Vitalé backend (verified: only lab-collection
 * bookings exist, a different domain). Rather than fabricate scheduling/booking
 * state, these pages render the truth and point to what IS backed.
 */
export function UnavailableDomain({
  title,
  pageTitle,
  icon,
  reason,
  alternatives,
}: {
  title: string;
  pageTitle: string;
  icon: ReactNode;
  reason: string;
  alternatives?: { label: string; href: string }[];
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground">Scheduling &amp; booking</p>
      </div>
      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg flex items-center gap-2">{icon} Not available</CardTitle></CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center">{icon}</div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{reason}</p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Booking, availability, services, events, and workshops have <span className="text-foreground font-medium">no backend domain</span> in
                the platform yet — no router, schema, or endpoints exist. The data shown previously was mock-only and was removed rather than
                fabricated.
              </p>
            </div>
            {alternatives && alternatives.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {alternatives.map((a) => (
                  <Button key={a.href} variant="outline" size="sm" onClick={() => navigate(`${BASE}${a.href}`)}>{a.label}</Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
