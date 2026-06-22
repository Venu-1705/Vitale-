import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { METRIC_IDS, persistObservation, fetchHealthHistory, type MetricKey } from "@/lib/health";

export type LogType =
  | "weight"
  | "water"
  | "sleep"
  | "energy"
  | "mood"
  | "symptoms"
  | "period"
  | "note";

export type SymptomEntry = {
  name: string;
  severity: "mild" | "moderate" | "severe";
};

export type HealthLog = {
  id: string;
  type: LogType;
  timestamp: number;
  weight?: number;
  waterGlasses?: number;
  sleepHours?: number;
  energyLevel?: number;
  moodLevel?: number;
  symptoms?: SymptomEntry[];
  symptomNote?: string;
  periodType?: "start" | "end";
  periodFlow?: "light" | "medium" | "heavy";
  periodSymptoms?: string[];
  noteText?: string;
};

export type HealthProfile = {
  height: number;
  weight: number;
  age: number;
  gender: string;
  conditions: string[];
  allergies: string[];
  lastUpdated: number;
};

const NOW = new Date("2026-05-22T12:00:00.000Z").getTime();
const DAY = 86400000;

const SEED_LOGS: HealthLog[] = [
  { id: "seed-w1",  type: "weight",   timestamp: NOW - 77 * DAY, weight: 68.5 },
  { id: "seed-w2",  type: "weight",   timestamp: NOW - 70 * DAY, weight: 67.8 },
  { id: "seed-w3",  type: "weight",   timestamp: NOW - 63 * DAY, weight: 67.1 },
  { id: "seed-w4",  type: "weight",   timestamp: NOW - 56 * DAY, weight: 66.4 },
  { id: "seed-w5",  type: "weight",   timestamp: NOW - 49 * DAY, weight: 65.6 },
  { id: "seed-w6",  type: "weight",   timestamp: NOW - 42 * DAY, weight: 64.8 },
  { id: "seed-w7",  type: "weight",   timestamp: NOW - 35 * DAY, weight: 64.0 },
  { id: "seed-w8",  type: "weight",   timestamp: NOW - 28 * DAY, weight: 63.3 },
  { id: "seed-w9",  type: "weight",   timestamp: NOW - 14 * DAY, weight: 62.7 },
  { id: "seed-w10", type: "weight",   timestamp: NOW - 7  * DAY, weight: 62.1 },
  {
    id: "seed-s1",
    type: "symptoms",
    timestamp: NOW - 21 * DAY,
    symptoms: [
      { name: "Bloating", severity: "moderate" },
      { name: "Fatigue", severity: "mild" },
    ],
    symptomNote: "Happened after eating rajma",
  },
  {
    id: "seed-s2",
    type: "symptoms",
    timestamp: NOW - 5 * DAY,
    symptoms: [{ name: "Headache", severity: "mild" }],
  },
  { id: "seed-sl1", type: "sleep",  timestamp: NOW - 10 * DAY, sleepHours: 6.5 },
  { id: "seed-sl2", type: "sleep",  timestamp: NOW - 3  * DAY, sleepHours: 7.5 },
  { id: "seed-e1",  type: "energy", timestamp: NOW - 9  * DAY, energyLevel: 2 },
  { id: "seed-e2",  type: "energy", timestamp: NOW - 2  * DAY, energyLevel: 4 },
  { id: "seed-m1",  type: "mood",   timestamp: NOW - 8  * DAY, moodLevel: 3 },
  { id: "seed-m2",  type: "mood",   timestamp: NOW - 1  * DAY, moodLevel: 4 },
  {
    id: "seed-p1",
    type: "period",
    timestamp: NOW - 18 * DAY,
    periodType: "start",
    periodFlow: "medium",
    periodSymptoms: ["Cramps", "Bloating", "Fatigue"],
  },
  {
    id: "seed-n1",
    type: "note",
    timestamp: NOW - 4 * DAY,
    noteText: "Feeling much more energetic this week after reducing sugar intake.",
  },
];

const DEFAULT_PROFILE: HealthProfile = {
  height: 163,
  weight: 62.1,
  age: 28,
  gender: "Female",
  conditions: ["PCOS"],
  allergies: ["Lactose intolerant"],
  lastUpdated: NOW - 7 * DAY,
};

type HealthContextType = {
  logs: HealthLog[];
  profile: HealthProfile;
  healthXp: number;
  addLog: (log: Omit<HealthLog, "id" | "timestamp">) => void;
  updateProfile: (update: Partial<HealthProfile>) => void;
  weightLogs: HealthLog[];
};

const HealthContext = createContext<HealthContextType | null>(null);
const STORAGE_KEY = "vitale_health_v1";

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<HealthLog[]>(SEED_LOGS);
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [healthXp, setHealthXp] = useState(45);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.logs?.length) setLogs(saved.logs);
          if (saved.profile) setProfile(saved.profile);
          if (typeof saved.healthXp === "number") setHealthXp(saved.healthXp);
        }
      } catch {}
    }
    load();
  }, []);

  // Populate health HISTORY from D5 (per-metric reads). Replaces the numeric log
  // types with backend data; symptom/period/note logs (no backend) stay local.
  useEffect(() => {
    let active = true;
    fetchHealthHistory()
      .then((entries) => {
        if (!active || entries.length === 0) return;
        const toLog = (e: { metric: MetricKey; value: number; measuredAt: string }): HealthLog => {
          const ts = Date.parse(e.measuredAt);
          const base = { id: `d5-${e.metric}-${ts}`, timestamp: ts };
          switch (e.metric) {
            case "weight_kg": return { ...base, type: "weight", weight: e.value };
            case "water_glasses": return { ...base, type: "water", waterGlasses: e.value };
            case "sleep_hours": return { ...base, type: "sleep", sleepHours: e.value };
            case "energy_level": return { ...base, type: "energy", energyLevel: e.value };
            case "mood_level": return { ...base, type: "mood", moodLevel: e.value };
          }
        };
        const backendLogs = entries.map(toLog);
        setLogs((prev) => {
          const localOnly = prev.filter((l) => l.type === "symptoms" || l.type === "period" || l.type === "note");
          return [...backendLogs, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (l: HealthLog[], p: HealthProfile, x: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ logs: l, profile: p, healthXp: x }));
    } catch {}
  }, []);

  const addLog = useCallback(
    (entry: Omit<HealthLog, "id" | "timestamp">) => {
      const newLog: HealthLog = {
        ...entry,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
      };
      const updatedLogs = [newLog, ...logs];
      const updatedXp = healthXp + 3;
      setLogs(updatedLogs);
      setHealthXp(updatedXp);
      // Additively persist mapped readings to D5 so the client's coach can see them
      // (consent-gated). Unmapped types (symptoms/period/note) stay local-only.
      const mapped =
        newLog.type === "weight" && newLog.weight != null ? { metricDefinitionId: METRIC_IDS.weight_kg, valueNumeric: newLog.weight, unit: "kg" }
        : newLog.type === "water" && newLog.waterGlasses != null ? { metricDefinitionId: METRIC_IDS.water_glasses, valueNumeric: newLog.waterGlasses, unit: "glasses" }
        : newLog.type === "sleep" && newLog.sleepHours != null ? { metricDefinitionId: METRIC_IDS.sleep_hours, valueNumeric: newLog.sleepHours, unit: "hours" }
        : newLog.type === "energy" && newLog.energyLevel != null ? { metricDefinitionId: METRIC_IDS.energy_level, valueNumeric: newLog.energyLevel }
        : newLog.type === "mood" && newLog.moodLevel != null ? { metricDefinitionId: METRIC_IDS.mood_level, valueNumeric: newLog.moodLevel }
        : null;
      if (mapped) void persistObservation(mapped).catch(() => {});
      if (newLog.type === "weight" && newLog.weight) {
        const updatedProfile = { ...profile, weight: newLog.weight, lastUpdated: Date.now() };
        setProfile(updatedProfile);
        persist(updatedLogs, updatedProfile, updatedXp);
      } else {
        persist(updatedLogs, profile, updatedXp);
      }
    },
    [logs, profile, healthXp, persist]
  );

  const updateProfile = useCallback(
    (update: Partial<HealthProfile>) => {
      const updated = { ...profile, ...update, lastUpdated: Date.now() };
      setProfile(updated);
      persist(logs, updated, healthXp);
    },
    [profile, logs, healthXp, persist]
  );

  const weightLogs = logs
    .filter((l) => l.type === "weight" && l.weight !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <HealthContext.Provider value={{ logs, profile, healthXp, addLog, updateProfile, weightLogs }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used inside HealthProvider");
  return ctx;
}
