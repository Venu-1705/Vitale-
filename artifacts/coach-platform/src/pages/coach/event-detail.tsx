import { CalendarDays } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Event detail — NO BACKEND (no events/scheduling domain). */
export default function EventDetail() {
  return (
    <UnavailableDomain
      pageTitle="Event"
      title="Event details aren't available yet"
      icon={<CalendarDays className="w-7 h-7 text-muted-foreground" />}
      reason="No events backend exists, so there are no event records, registrations, or attendance to display."
      alternatives={[{ label: 'Back to Events', href: '/admin/events' }]}
    />
  );
}
