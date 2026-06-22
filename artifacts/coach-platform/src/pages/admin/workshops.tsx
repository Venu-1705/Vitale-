import { Presentation } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Workshops — NO BACKEND (no events/workshops/scheduling domain). */
export default function Workshops() {
  return (
    <UnavailableDomain
      pageTitle="Workshops"
      title="Workshops aren't available yet"
      icon={<Presentation className="w-7 h-7 text-muted-foreground" />}
      reason="Workshops depend on an events/scheduling backend that doesn't exist — no sessions, registrations, waitlists, or funnels. This surface is disabled rather than faked."
      alternatives={[{ label: 'Community', href: '/admin/community' }]}
    />
  );
}
