import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Users as UsersIcon } from 'lucide-react';

/**
 * Admin "Users" directory — INTENTIONALLY NOT BACKED.
 *
 * The original mock rendered a full end-consumer directory (health conditions,
 * leagues, streaks, weight history, consent logs). Two hard reasons make that
 * surface impossible to back honestly against the canonical Vitalé backend:
 *
 *   1. No endpoint exists. D0–D15 expose org-scoped membership (see Coaches &
 *      Staff → /organizations/:id/members) and subject-scoped health/consent
 *      reads — there is NO admin "list every platform user" route, by design.
 *
 *   2. DPDP minimization. Admins have NO ambient access to end-user health data.
 *      An admin-facing directory of users' conditions/streaks/weights would
 *      violate that constraint even if an endpoint were added.
 *
 * Per the migration rules ("if data does not exist in D0–D15, remove or honestly
 * degrade; do not fabricate"), the fabricated directory was removed rather than
 * wired to invented contracts. Org staff management lives on the Coaches & Staff
 * page (real D0). A future end-user surface must be a consented, subject-scoped
 * domain — documented as a gap, not built here.
 */
export default function Users() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Platform end-user management</p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Not available
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center">
              <UsersIcon className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">A platform-wide user directory isn't available</h2>
            <p className="text-sm text-muted-foreground">
              The backend deliberately has no admin endpoint that lists every end-user, and
              India's DPDP Act prohibits admins from holding ambient access to end-users' health
              data. Surfacing conditions, streaks, or weight history here would breach that.
            </p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 space-y-2">
              <p className="font-medium text-foreground">What you can manage instead:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="text-foreground">Coaches &amp; Staff</span> — your organization's members and roles (live, D0).</li>
                <li><span className="text-foreground">Clients</span> — only end-users who have granted your org consent appear, scoped to their shared data (consent-gated).</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              A consented, subject-scoped end-user surface is a separate future domain — not fabricated here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
