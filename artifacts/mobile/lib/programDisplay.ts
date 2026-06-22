/**
 * Presentation adapter for D3 programs.
 *
 * The backend program contract is intentionally lean — identity + commercial +
 * lifecycle fields only. It carries NO marketing/social-proof data (coach
 * profile, ratings, reviews, category, difficulty, "what's included"). Rather
 * than extend the backend or fabricate that data, this module derives the
 * *decoration* the UI needs (a stable gradient, rupee price, week count) from
 * the real row, and is the single place any presentation-only default lives.
 *
 * What this adapter will NOT do: invent a coach name, a star rating, a review
 * count, or a clinical category. Screens that previously rendered those read
 * them from here as `null`/absent and degrade honestly.
 */
import type { Program, SessionContentType } from "./programs";

// A small fixed palette of gradient pairs. A program's pair is chosen by a
// stable hash of its id, so the same program always renders the same colours
// without any persisted/served styling.
const GRADIENTS: [string, string][] = [
  ["#EF4444", "#EC4899"],
  ["#8B5CF6", "#EC4899"],
  ["#3B82F6", "#06B6D4"],
  ["#22C55E", "#10B981"],
  ["#F59E0B", "#F97316"],
  ["#14B8A6", "#0EA5E9"],
  ["#1D4ED8", "#7C3AED"],
  ["#FDA4AF", "#F472B6"],
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function gradientForId(id: string): [string, string] {
  return GRADIENTS[hashId(id) % GRADIENTS.length];
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}

export function weeksFromDays(days: number | null): number | null {
  if (days == null) return null;
  return Math.max(1, Math.round(days / 7));
}

/** A backend program decorated with presentation-only fields, ready to render. */
export interface DisplayProgram {
  id: string;
  title: string;
  slug: string;
  description: string;
  pricePaise: number;
  priceRupees: number;
  isFree: boolean;
  durationDays: number | null;
  durationWeeks: number | null;
  status: Program["status"];
  visibility: Program["visibility"];
  organizationId: string;
  currentVersion: number;
  gradientStart: string;
  gradientEnd: string;
}

export function toDisplayProgram(p: Program): DisplayProgram {
  const [gradientStart, gradientEnd] = gradientForId(p.id);
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    pricePaise: p.pricePaise,
    priceRupees: paiseToRupees(p.pricePaise),
    isFree: p.pricePaise === 0,
    durationDays: p.durationDays,
    durationWeeks: weeksFromDays(p.durationDays),
    status: p.status,
    visibility: p.visibility,
    organizationId: p.organizationId,
    currentVersion: p.currentVersion,
    gradientStart,
    gradientEnd,
  };
}

// ── Session content-type presentation ────────────────────────────────────────

export interface ContentTypeStyle {
  label: string;
  /** Feather icon name. */
  icon: string;
  color: string;
}

const CONTENT_TYPE_STYLES: Record<SessionContentType, ContentTypeStyle> = {
  video: { label: "Video", icon: "play-circle", color: "#3B82F6" },
  article: { label: "Article", icon: "file-text", color: "#14B8A6" },
  live: { label: "Live", icon: "radio", color: "#8B5CF6" },
  task: { label: "Task", icon: "check-square", color: "#F97316" },
};

export function contentTypeStyle(t: SessionContentType): ContentTypeStyle {
  return CONTENT_TYPE_STYLES[t] ?? CONTENT_TYPE_STYLES.task;
}

/** "12 min" / "1h 05m" from a nullable duration-in-seconds. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}
