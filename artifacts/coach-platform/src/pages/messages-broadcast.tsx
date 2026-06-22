import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Message Broadcast — INTENTIONALLY NOT BACKED.
 *
 * The original mock composed a one-to-many announcement to a fabricated client
 * directory. The D13 messaging backend has NO broadcast endpoint and NO recipient
 * directory: conversations are 1:1, directed (caller + a subject user), and
 * basis/consent-gated by the DB. A blast-to-many surface can't be backed honestly
 * without inventing contracts, so it's surfaced as unavailable rather than faked.
 *
 * For org-wide announcements, the real channel is a community **announcement**
 * post (D11). For individual outreach, use 1:1 conversations on the Messages page.
 */
export default function MessagesBroadcast() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/messages`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Broadcast</h1>
          <p className="text-sm text-muted-foreground">Send an announcement to many people</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-lg flex items-center gap-2"><Radio className="w-5 h-5 text-primary" /> Not available</CardTitle></CardHeader>
        <CardContent className="py-10">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><Radio className="w-7 h-7 text-muted-foreground" /></div>
            <h2 className="text-lg font-semibold">Broadcast messaging isn't available</h2>
            <p className="text-sm text-muted-foreground">
              The messaging backend supports only 1:1, directed, consent-gated conversations — there's no
              one-to-many broadcast endpoint and no recipient directory. Rather than fabricate delivery to a
              made-up audience, this surface is disabled.
            </p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Use instead:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Org-wide notice → post a community <span className="text-foreground">announcement</span> (Community).</li>
                  <li>Individual outreach → start a <span className="text-foreground">1:1 conversation</span> (Messages).</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(`${BASE}/admin/messages`)}>Back to Messages</Button>
              <Button onClick={() => navigate(`${BASE}/admin/community`)}>Go to Community</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
