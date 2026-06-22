import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Audit Logs — NOT READABLE YET. The access-audit trail (coach_data_access_audit)
 * is a REVOKE-API, hash-chained table: rows are written in-transaction by the
 * audited read RPCs, but there is NO client read endpoint — audited reads are
 * explicitly deferred (backend "Phase 8"). Surfacing who-accessed-whose-health-data
 * also has strict DPDP implications and must go through a purpose-built audited
 * read, not a raw query. So this is shown as unavailable rather than fabricated.
 *
 * The D2 surfaces that DO exist (consents, access grants, deletion requests,
 * admin support-access) are subject/grant management, not the access-audit log.
 */
export default function AuditLogs() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground">Data-access audit trail</p>
      </div>
      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Not available</CardTitle></CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><ShieldCheck className="w-7 h-7 text-muted-foreground" /></div>
            <h2 className="text-lg font-semibold">The access-audit trail isn't readable yet</h2>
            <p className="text-sm text-muted-foreground">
              Every coach/admin read of a client's health data is recorded in a hash-chained audit table, but the
              backend exposes <span className="font-medium">no read endpoint</span> for it — audited audit-log reads
              are deferred. Under DPDP this trail must be served through a purpose-built audited read, so it isn't
              shown rather than fabricated.
            </p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> Consent, access-grant, and deletion-request management (D2) do have real endpoints and can be surfaced separately.
            </div>
            <Button variant="outline" onClick={() => navigate(`${BASE}/admin/dashboard`)}>Back to Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
