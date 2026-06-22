import { CalendarDays } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Event create/edit — NO BACKEND (no events/scheduling domain). */
export default function EventCreate() {
  return (
    <UnavailableDomain
      pageTitle="Create Event"
      title="Creating events isn't available yet"
      icon={<CalendarDays className="w-7 h-7 text-muted-foreground" />}
      reason="There's no events backend to persist an event, schedule, capacity, or Zoom link. Building this form would require inventing contracts, so it's disabled."
      alternatives={[{ label: 'Back to Events', href: '/admin/events' }]}
    />
  );
}
