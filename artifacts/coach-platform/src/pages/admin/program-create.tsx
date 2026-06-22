import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2, ArrowLeft, BookOpen, Loader2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useProgram, useUpdateProgram, useCreateProgramWithCurriculum,
  type ProgramVisibility, type SessionContentType,
  type NewModuleDraft,
} from '@/lib/programs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const STEPS = ['Basics', 'Curriculum', 'Review'];
const CONTENT_TYPES: SessionContentType[] = ['video', 'article', 'live', 'task'];
const VISIBILITIES: ProgramVisibility[] = ['private', 'unlisted', 'public'];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

interface DraftSession { title: string; content_type: SessionContentType; video_url: string; duration_min: string; }
interface DraftModule { title: string; description: string; sessions: DraftSession[]; }

const emptySession = (): DraftSession => ({ title: '', content_type: 'video', video_url: '', duration_min: '' });
const emptyModule = (): DraftModule => ({ title: '', description: '', sessions: [emptySession()] });

export default function ProgramCreate() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const { user } = useAuthStore();
  const organizationId = user?.organizationId;

  // Edit mode loads the real program row (basics). NOTE: there is no backend GET
  // for live/draft modules+sessions, so the curriculum editor can only ADD new
  // content in edit mode — existing draft curriculum can't be re-read over HTTP.
  const { data: existing, isLoading: loadingExisting } = useProgram(isEdit ? params.id : undefined);

  const create = useCreateProgramWithCurriculum();
  const update = useUpdateProgram(params.id ?? '');

  const [step, setStep] = useState(0);
  const [slugDirty, setSlugDirty] = useState(false);
  const [basics, setBasics] = useState({
    title: '', slug: '', description: '', visibility: 'private' as ProgramVisibility,
    isFree: true, priceRupees: '', durationDays: '',
  });
  const [modules, setModules] = useState<DraftModule[]>([emptyModule()]);

  // Hydrate basics from the loaded program (edit mode), once.
  const [hydrated, setHydrated] = useState(false);
  if (isEdit && existing && !hydrated) {
    setBasics({
      title: existing.title,
      slug: existing.slug,
      description: existing.description ?? '',
      visibility: existing.visibility,
      isFree: existing.pricePaise === 0,
      priceRupees: existing.pricePaise ? String(existing.pricePaise / 100) : '',
      durationDays: existing.durationDays != null ? String(existing.durationDays) : '',
    });
    setSlugDirty(true);
    setHydrated(true);
  }

  function setTitle(title: string) {
    setBasics((b) => ({ ...b, title, slug: slugDirty ? b.slug : slugify(title) }));
  }

  // ── Curriculum editing helpers ────────────────────────────────────────────
  const addModule = () => setModules((m) => [...m, emptyModule()]);
  const removeModule = (i: number) => setModules((m) => m.filter((_, j) => j !== i));
  const patchModule = (i: number, patch: Partial<DraftModule>) => setModules((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSession = (mi: number) => setModules((m) => m.map((x, j) => (j === mi ? { ...x, sessions: [...x.sessions, emptySession()] } : x)));
  const removeSession = (mi: number, si: number) => setModules((m) => m.map((x, j) => (j === mi ? { ...x, sessions: x.sessions.filter((_, k) => k !== si) } : x)));
  const patchSession = (mi: number, si: number, patch: Partial<DraftSession>) =>
    setModules((m) => m.map((x, j) => (j === mi ? { ...x, sessions: x.sessions.map((s, k) => (k === si ? { ...s, ...patch } : s)) } : x)));

  const basicsValid = basics.title.trim().length > 0 && /^[a-z0-9-]+$/.test(basics.slug);

  function toDraftModules(): NewModuleDraft[] {
    return modules
      .filter((m) => m.title.trim())
      .map((m) => ({
        title: m.title.trim(),
        description: m.description.trim() || undefined,
        sessions: m.sessions
          .filter((s) => s.title.trim())
          .map((s) => ({
            title: s.title.trim(),
            content_type: s.content_type,
            video_url: s.video_url.trim() || undefined,
            duration_seconds: s.duration_min ? Math.round(Number(s.duration_min) * 60) : undefined,
          })),
      }));
  }

  function priceFields() {
    const price_paise = basics.isFree ? 0 : Math.max(0, Math.round(Number(basics.priceRupees || '0') * 100));
    const duration_days = basics.durationDays ? Number(basics.durationDays) : undefined;
    return { price_paise, duration_days };
  }

  function handleCreate(publish: boolean) {
    if (!organizationId) { toast.error('No organization in session'); return; }
    if (!basicsValid) { toast.error('Title and a valid slug are required'); setStep(0); return; }
    const { price_paise, duration_days } = priceFields();
    create.mutate(
      {
        program: {
          organization_id: organizationId,
          title: basics.title.trim(),
          slug: basics.slug,
          description: basics.description.trim() || undefined,
          visibility: basics.visibility,
          price_paise,
          duration_days,
        },
        modules: toDraftModules(),
        publish,
      },
      {
        onSuccess: (p) => { toast.success(publish ? 'Program published' : 'Program created'); navigate(`${BASE}/admin/programs/${p.id}`); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not create program'),
      },
    );
  }

  function handleUpdateBasics() {
    if (!basicsValid) { toast.error('Title and a valid slug are required'); return; }
    const { price_paise, duration_days } = priceFields();
    update.mutate(
      {
        title: basics.title.trim(),
        slug: basics.slug,
        description: basics.description.trim() || null,
        visibility: basics.visibility,
        price_paise,
        duration_days: duration_days ?? null,
      },
      {
        onSuccess: () => { toast.success('Program updated'); navigate(`${BASE}/admin/programs/${params.id}`); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update program'),
      },
    );
  }

  if (isEdit && loadingExisting) {
    return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading program…</div>;
  }

  const busy = create.isPending || update.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/programs`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-display font-bold">{isEdit ? 'Edit Program' : 'Create Program'}</h1>
          <p className="text-sm text-muted-foreground">{isEdit ? 'Update program details' : 'Set up a new program and its curriculum'}</p>
        </div>
      </div>

      {/* Stepper (create only) */}
      {!isEdit && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-primary text-white' : i === step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'font-semibold' : 'text-muted-foreground'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>
      )}

      {/* Step 0 / edit: Basics */}
      {(isEdit || step === 0) && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Basics</h2>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={basics.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PCOS Reversal Program" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug *</Label>
            <Input value={basics.slug} onChange={(e) => { setSlugDirty(true); setBasics((b) => ({ ...b, slug: slugify(e.target.value) })); }} placeholder="pcos-reversal" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={basics.description} onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={basics.visibility} onValueChange={(v) => setBasics((b) => ({ ...b, visibility: v as ProgramVisibility }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITIES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input type="number" min={1} value={basics.durationDays} onChange={(e) => setBasics((b) => ({ ...b, durationDays: e.target.value }))} placeholder="optional" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Free program</p>
              <p className="text-xs text-muted-foreground">Paid enrollment requires payments (D8), not yet implemented.</p>
            </div>
            <Switch checked={basics.isFree} onCheckedChange={(v) => setBasics((b) => ({ ...b, isFree: v }))} />
          </div>
          {!basics.isFree && (
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input type="number" min={0} value={basics.priceRupees} onChange={(e) => setBasics((b) => ({ ...b, priceRupees: e.target.value }))} placeholder="2999" />
              <p className="text-xs text-amber-600">Heads up: paid enrollment is blocked until payments land — learners will see an "unavailable" state.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Curriculum (create only) */}
      {!isEdit && step === 1 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Build the curriculum now. After publishing, this becomes an immutable version snapshot. (The backend has no draft-curriculum read, so curriculum is authored here in one pass.)
          </div>
          {modules.map((m, mi) => (
            <div key={mi} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input value={m.title} onChange={(e) => patchModule(mi, { title: e.target.value })} placeholder={`Module ${mi + 1} title`} className="font-medium" />
                {modules.length > 1 && <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeModule(mi)}><Trash2 className="w-4 h-4" /></Button>}
              </div>
              <Textarea value={m.description} onChange={(e) => patchModule(mi, { description: e.target.value })} rows={2} placeholder="Module description (optional)" />
              <div className="space-y-2 pl-3 border-l-2 border-muted">
                {m.sessions.map((s, si) => (
                  <div key={si} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-5" value={s.title} onChange={(e) => patchSession(mi, si, { title: e.target.value })} placeholder={`Session ${si + 1}`} />
                    <Select value={s.content_type} onValueChange={(v) => patchSession(mi, si, { content_type: v as SessionContentType })}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="col-span-3" type="number" min={0} value={s.duration_min} onChange={(e) => patchSession(mi, si, { duration_min: e.target.value })} placeholder="min" />
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => removeSession(mi, si)} disabled={m.sessions.length === 1}><Trash2 className="w-3.5 h-3.5" /></Button>
                    {s.content_type === 'video' && (
                      <Input className="col-span-12" value={s.video_url} onChange={(e) => patchSession(mi, si, { video_url: e.target.value })} placeholder="Video URL (optional)" />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addSession(mi)}><Plus className="w-3.5 h-3.5 mr-1" /> Add session</Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addModule}><Plus className="w-4 h-4 mr-1.5" /> Add module</Button>
        </div>
      )}

      {/* Step 2: Review (create only) */}
      {!isEdit && step === 2 && (
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4" /> Review</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Title:</span> {basics.title}</p>
            <p><span className="text-muted-foreground">Slug:</span> <span className="font-mono">{basics.slug}</span></p>
            <p><span className="text-muted-foreground">Visibility:</span> <span className="capitalize">{basics.visibility}</span></p>
            <p><span className="text-muted-foreground">Price:</span> {basics.isFree ? 'Free' : `₹${basics.priceRupees || 0}`}</p>
            <p><span className="text-muted-foreground">Duration:</span> {basics.durationDays ? `${basics.durationDays} days` : '—'}</p>
            <p><span className="text-muted-foreground">Curriculum:</span> {toDraftModules().length} module(s), {toDraftModules().reduce((n, m) => n + m.sessions.length, 0)} session(s)</p>
          </div>
          <p className="text-xs text-muted-foreground">Publishing freezes an immutable version snapshot. You can also save as a draft and publish later.</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        {isEdit ? (
          <>
            <Button variant="outline" onClick={() => navigate(`${BASE}/admin/programs/${params.id}`)}>Cancel</Button>
            <Button onClick={handleUpdateBasics} disabled={busy || !basicsValid}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate(`${BASE}/admin/programs`))}>
              {step > 0 ? <><ChevronLeft className="w-4 h-4 mr-1" /> Back</> : 'Cancel'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !basicsValid}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleCreate(false)} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Draft'}</Button>
                <Button onClick={() => handleCreate(true)} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish'}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
