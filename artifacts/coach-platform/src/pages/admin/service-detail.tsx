import { Briefcase } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Service detail — NO BACKEND (no service-offering domain). */
export default function ServiceDetail() {
  return (
    <UnavailableDomain
      pageTitle="Service"
      title="Service details aren't available yet"
      icon={<Briefcase className="w-7 h-7 text-muted-foreground" />}
      reason="No service-offering or booking backend exists, so there are no service records, bookings, or availability to display."
      alternatives={[{ label: 'Back to Services', href: '/admin/services' }]}
    />
  );
}
