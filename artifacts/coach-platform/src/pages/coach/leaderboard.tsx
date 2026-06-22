import { Medal } from 'lucide-react';
import { DeferredDomain } from '@/components/DeferredDomain';

/** Leaderboard (D6) — DEFERRED. No leaderboard/ranking API exists. */
export default function Leaderboard() {
  return (
    <DeferredDomain
      pageTitle="Leaderboard"
      subtitle="Client rankings"
      title="Leaderboards aren't available yet"
      icon={<Medal className="w-7 h-7 text-muted-foreground" />}
      reason="Rankings depend on the deferred D6 gamification domain (points, streaks, scoring) — no leaderboard endpoints exist. Showing fabricated rankings would misrepresent client performance, so it's disabled."
    />
  );
}
