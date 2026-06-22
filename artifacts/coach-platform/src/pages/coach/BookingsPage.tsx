import { CalendarClock } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/**
 * Bookings — NO BACKEND. No booking/availability/appointment domain exists
 * (the only `/bookings` route is lab-sample collection, a separate domain).
 * Recurring schedules, waitlists, and attendance analytics are all unbacked.
 */
export default function BookingsPage() {
  return (
    <UnavailableDomain
      pageTitle="Bookings"
      title="Bookings aren't available yet"
      icon={<CalendarClock className="w-7 h-7 text-muted-foreground" />}
      reason="There's no appointment/availability backend — no slots, bookings, recurring schedules, waitlists, or attendance to show. Rather than fabricate booking states, this is disabled until a scheduling domain exists."
      alternatives={[{ label: 'Messages', href: '/admin/messages' }, { label: 'Clients', href: '/admin/clients' }]}
    />
  );
}
