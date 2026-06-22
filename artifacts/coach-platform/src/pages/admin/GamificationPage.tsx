import { Trophy } from 'lucide-react';
import { DeferredDomain } from '@/components/DeferredDomain';

/** Gamification (D6) — DEFERRED. No badge/streak/leaderboard API exists. */
export default function GamificationPage() {
  return (
    <DeferredDomain
      pageTitle="Gamification"
      subtitle="Badges, streaks & challenges"
      title="Gamification isn't available yet"
      icon={<Trophy className="w-7 h-7 text-muted-foreground" />}
      reason="Badge, streak, and challenge configuration needs the D6 gamification API, which isn't implemented. The mock rules/points were removed rather than presented as real."
    />
  );
}
