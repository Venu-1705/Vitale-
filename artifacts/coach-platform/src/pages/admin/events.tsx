import { CalendarDays } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Events — NO BACKEND (no events/scheduling domain). */
export default function Events() {
  return (
    <UnavailableDomain
      pageTitle="Events"
      title="Events aren't available yet"
      icon={<CalendarDays className="w-7 h-7 text-muted-foreground" />}
      reason="There's no events/scheduling backend — no event records, RSVPs, ticketing, or attendance. The mock event list was removed rather than fabricated."
      alternatives={[{ label: 'Community', href: '/admin/community' }, { label: 'Programs', href: '/admin/programs' }]}
    />
  );
}
