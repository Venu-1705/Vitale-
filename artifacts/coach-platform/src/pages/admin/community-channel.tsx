import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hash, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Community Channel — INTENTIONALLY NOT BACKED.
 *
 * The original mock rendered a per-channel feed with access rules, categories,
 * who-can-post settings, profanity filters, and channel-level analytics. The D11
 * backend has NO channel entity: a community is per-organization, with posts,
 * comments, likes, poll votes, memberships, and a moderation flag queue. There
 * are no sub-channels to back this route, so it redirects to the real org-wide
 * community rather than fabricating a channel.
 */
export default function CommunityChannel() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const t = setTimeout(() => navigate(`${BASE}/admin/community`), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="max-w-2xl mx-auto py-16">
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><Hash className="w-7 h-7 text-muted-foreground" /></div>
          <h2 className="text-lg font-semibold">Channels aren't supported</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The backend models a single org-wide community — there are no sub-channels, access rules,
            or per-channel settings. Redirecting you to your community feed…
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" /> Posts, comments, likes, polls, and moderation all live on the community page.
          </div>
          <Button onClick={() => navigate(`${BASE}/admin/community`)}>Go to Community</Button>
        </CardContent>
      </Card>
    </div>
  );
}
