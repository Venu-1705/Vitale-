import { Briefcase } from 'lucide-react';
import { UnavailableDomain } from '@/components/UnavailableDomain';

/** Service create/edit — NO BACKEND (no service-offering domain). */
export default function ServiceCreate() {
  return (
    <UnavailableDomain
      pageTitle="Create Service"
      title="Creating services isn't available yet"
      icon={<Briefcase className="w-7 h-7 text-muted-foreground" />}
      reason="There's no service-offering or scheduling backend to persist a service, its slots, or its pricing. Building this form would require fabricating contracts, so it's disabled."
      alternatives={[{ label: 'Back to Services', href: '/admin/services' }, { label: 'Create a Program', href: '/admin/programs/new' }]}
    />
  );
}
