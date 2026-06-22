export type HealthLogType = 'weight' | 'mood' | 'sleep' | 'energy' | 'symptom' | 'period' | 'note';
export type Severity = 'Mild' | 'Moderate' | 'Severe';
export type FlowLevel = 'Spotting' | 'Light' | 'Medium' | 'Heavy';

export interface HealthLogEntry {
  id: string;
  date: string;       // ISO date e.g. "2026-04-30"
  dateDisplay: string;
  time: string;
  type: HealthLogType;
  // Weight
  weightKg?: number;
  // Mood
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  moodLabel?: string;
  // Sleep
  sleepHours?: number;
  sleepQuality?: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  // Energy
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  energyLabel?: string;
  // Symptom
  symptoms?: { name: string; severity: Severity }[];
  // Period
  flowLevel?: FlowLevel;
  cycleDay?: number;
  // Note
  noteText?: string;
}

export interface PeriodCycle {
  startDate: string;
  endDate: string;
  duration: number;
}

export interface SymptomFreq {
  symptom: string;
  mild: number;
  moderate: number;
  severe: number;
  total: number;
}

const MOOD_LABELS: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Excellent' };
const ENERGY_LABELS: Record<number, string> = { 1: 'Exhausted', 2: 'Tired', 3: 'Moderate', 4: 'Energetic', 5: 'Very Energetic' };
const SLEEP_QUALITIES = ['Poor', 'Fair', 'Good', 'Excellent'] as const;
const SYMPTOM_POOL = ['Bloating', 'Fatigue', 'Headache', 'Cramps', 'Nausea', 'Acne', 'Mood Swings', 'Joint Pain'];
const FLOW_LEVELS: FlowLevel[] = ['Spotting', 'Light', 'Medium', 'Heavy'];

function seeded(n: number) { const x = Math.sin(n + 1) * 10000; return x - Math.floor(x); }

function makeDate(daysAgo: number): { date: string; dateDisplay: string } {
  const d = new Date(2026, 3, 30);
  d.setDate(d.getDate() - daysAgo);
  const dateDisplay = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return { date: d.toISOString().split('T')[0], dateDisplay };
}

const TIMES = ['6:30 AM', '7:15 AM', '8:00 AM', '9:45 AM', '10:30 AM', '12:00 PM', '2:30 PM', '7:00 PM', '9:00 PM', '10:15 PM'];

// Generate 60 days of varied health log entries
export function generateHealthLogs(): HealthLogEntry[] {
  const entries: HealthLogEntry[] = [];
  let id = 1;

  // Weight entries every 3-4 days
  const weightData = [
    74.8, 74.5, 74.2, 74.0, 73.6, 73.4, 73.1, 72.8, 72.5, 72.2,
    72.0, 71.8, 71.5, 71.3, 71.0, 70.8,
  ];
  weightData.forEach((kg, i) => {
    const daysAgo = 60 - i * 4;
    if (daysAgo < 0) return;
    const { date, dateDisplay } = makeDate(daysAgo);
    entries.push({ id: `hl-w-${id++}`, date, dateDisplay, time: '7:15 AM', type: 'weight', weightKg: kg });
  });

  // Daily mood, sleep, energy — for past 30 days
  for (let d = 0; d < 30; d++) {
    const s = seeded(d * 7);
    const { date, dateDisplay } = makeDate(d);
    const timeIdx = Math.floor(seeded(d * 3) * TIMES.length);

    // Mood
    const moodLevel = (Math.floor(s * 4) + 2) as 1 | 2 | 3 | 4 | 5;
    entries.push({ id: `hl-m-${id++}`, date, dateDisplay, time: TIMES[timeIdx], type: 'mood', moodLevel, moodLabel: MOOD_LABELS[moodLevel] });

    // Sleep (every other day)
    if (d % 2 === 0) {
      const sleepHours = parseFloat((5.5 + seeded(d * 11) * 3).toFixed(1));
      const qi = Math.floor(seeded(d * 13) * 4);
      entries.push({ id: `hl-sl-${id++}`, date, dateDisplay, time: '7:00 AM', type: 'sleep', sleepHours, sleepQuality: SLEEP_QUALITIES[qi] });
    }

    // Energy (every other day offset)
    if (d % 2 === 1) {
      const energyLevel = (Math.floor(seeded(d * 17) * 4) + 2) as 1 | 2 | 3 | 4 | 5;
      entries.push({ id: `hl-e-${id++}`, date, dateDisplay, time: TIMES[(timeIdx + 3) % TIMES.length], type: 'energy', energyLevel, energyLabel: ENERGY_LABELS[energyLevel] });
    }
  }

  // Symptom entries — 15 entries spread over 30 days
  const symptomDays = [1, 2, 4, 7, 8, 10, 12, 14, 16, 17, 20, 22, 25, 27, 29];
  symptomDays.forEach((d, i) => {
    const { date, dateDisplay } = makeDate(d);
    const numSymptoms = Math.floor(seeded(i * 31) * 2) + 1;
    const symptoms = Array.from({ length: numSymptoms }).map((_, si) => {
      const sIdx = Math.floor(seeded(i * 31 + si * 7) * SYMPTOM_POOL.length);
      const sevIdx = Math.floor(seeded(i * 31 + si * 13) * 3);
      return { name: SYMPTOM_POOL[sIdx], severity: (['Mild', 'Moderate', 'Severe'] as Severity[])[sevIdx] };
    });
    entries.push({ id: `hl-sy-${id++}`, date, dateDisplay, time: '9:45 AM', type: 'symptom', symptoms });
  });

  // Period entries — 3 cycles
  const periodDays = [
    { day: 55, flow: 'Medium' as FlowLevel, cycleDay: 1 },
    { day: 54, flow: 'Heavy' as FlowLevel, cycleDay: 2 },
    { day: 53, flow: 'Heavy' as FlowLevel, cycleDay: 3 },
    { day: 52, flow: 'Medium' as FlowLevel, cycleDay: 4 },
    { day: 51, flow: 'Light' as FlowLevel, cycleDay: 5 },
    { day: 26, flow: 'Light' as FlowLevel, cycleDay: 1 },
    { day: 25, flow: 'Medium' as FlowLevel, cycleDay: 2 },
    { day: 24, flow: 'Heavy' as FlowLevel, cycleDay: 3 },
    { day: 23, flow: 'Medium' as FlowLevel, cycleDay: 4 },
    { day: 3, flow: 'Spotting' as FlowLevel, cycleDay: 1 },
    { day: 2, flow: 'Light' as FlowLevel, cycleDay: 2 },
  ];
  periodDays.forEach(({ day, flow, cycleDay }) => {
    const { date, dateDisplay } = makeDate(day);
    entries.push({ id: `hl-p-${id++}`, date, dateDisplay, time: '8:00 AM', type: 'period', flowLevel: flow, cycleDay });
  });

  // Notes — 5 entries
  const noteContents = [
    'Feeling much better after starting the hormone balancing protocol. Energy is up.',
    'Had a very stressful week at work. Sleep affected.',
    'Tried the gluten-free roti recipe — loved it! No bloating today.',
    'Cycle slightly delayed this month, probably stress-related.',
    'Lost 2 kg since last check-in. Feeling motivated!',
  ];
  [3, 8, 15, 22, 28].forEach((d, i) => {
    const { date, dateDisplay } = makeDate(d);
    entries.push({ id: `hl-n-${id++}`, date, dateDisplay, time: '10:15 PM', type: 'note', noteText: noteContents[i] });
  });

  // Sort descending by date + time
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
}

export const HEALTH_LOGS: HealthLogEntry[] = generateHealthLogs();

// Weight series for chart (chronological)
export const WEIGHT_SERIES = [
  { date: 'Dec 1', weight: 75.8 },
  { date: 'Dec 15', weight: 75.3 },
  { date: 'Jan 1', weight: 75.0 },
  { date: 'Jan 15', weight: 74.5 },
  { date: 'Feb 1', weight: 74.0 },
  { date: 'Feb 15', weight: 73.5 },
  { date: 'Mar 1', weight: 73.0 },
  { date: 'Mar 15', weight: 72.5 },
  { date: 'Apr 1', weight: 72.0 },
  { date: 'Apr 15', weight: 71.5 },
  { date: 'Apr 22', weight: 71.2 },
  { date: 'Apr 28', weight: 71.0 },
];

export const SYMPTOM_FREQUENCY: SymptomFreq[] = [
  { symptom: 'Bloating',    mild: 4, moderate: 5, severe: 3, total: 12 },
  { symptom: 'Fatigue',     mild: 3, moderate: 4, severe: 1, total: 8  },
  { symptom: 'Headache',    mild: 3, moderate: 2, severe: 0, total: 5  },
  { symptom: 'Mood Swings', mild: 2, moderate: 2, severe: 1, total: 5  },
  { symptom: 'Cramps',      mild: 1, moderate: 2, severe: 1, total: 4  },
  { symptom: 'Acne',        mild: 2, moderate: 1, severe: 0, total: 3  },
];

export const PERIOD_CYCLES: PeriodCycle[] = [
  { startDate: '4 Mar 2026', endDate: '9 Mar 2026', duration: 5 },
  { startDate: '1 Apr 2026', endDate: '5 Apr 2026', duration: 4 },
  { startDate: '28 Apr 2026', endDate: '—', duration: 0 },
];

export const AVG_CYCLE_LENGTH = 28;
