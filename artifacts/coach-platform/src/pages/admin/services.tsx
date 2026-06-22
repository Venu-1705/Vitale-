import { Briefcase } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/**
 * Services (1:1 coaching offerings) — NO BACKEND. There is no service-offering /
 * booking / availability domain in the platform (verified: no router or schema).
 */
export default function Services() {
  return (
    <UnavailableDomain
      pageTitle="Services"
      title="Service offerings aren't available yet"
      icon={<Briefcase className="w-7 h-7 text-muted-foreground" />}
      reason="Bookable 1:1 service offerings need a scheduling/availability backend, which doesn't exist yet. Pricing, slots, and bookings can't be backed honestly, so this surface is disabled rather than faked."
      alternatives={[{ label: 'Programs', href: '/admin/programs' }, { label: 'Storefront', href: '/admin/storefront' }]}
    />
  );
}
