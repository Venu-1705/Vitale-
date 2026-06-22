import { Flame } from 'lucide-react';
import { DeferredDomain } from '@/components/DeferredDomain';

/** Habits (D6) — DEFERRED. No habit/streak API exists. */
export default function HabitsPage() {
  return (
    <DeferredDomain
      pageTitle="Habits"
      subtitle="Client habit tracking"
      title="Habit tracking isn't available yet"
      icon={<Flame className="w-7 h-7 text-muted-foreground" />}
      reason="Habit definitions and streak tracking are part of the deferred D6 gamification domain — there are no endpoints to read or assign habits. No streaks are fabricated."
    />
  );
}
