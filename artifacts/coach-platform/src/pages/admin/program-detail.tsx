import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Edit2, Share2, Users, BookOpen, Video, FileText, Radio, ClipboardList,
  Loader2, AlertCircle, Rocket, Archive, Info, CheckSquare,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useProgram, useProgramVersion, useProgramRoster, usePublishProgram,
  rupeesFromPaise,
  type SnapshotModule, type SessionContentType, type EnrollmentStatus, type ProgramStatus,
} from '@/lib/programs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const GRADIENTS = [
  'from-emerald-400 to-teal-500', 'from-violet-400 to-purple-500',
  'from-sky-400 to-blue-500', 'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500', 'from-lime-400 to-green-500',
];
function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function statusColor(s: ProgramStatus) {
  if (s === 'published') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'draft') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

const CONTENT_ICON: Record<SessionContentType, React.ReactNode> = {
  video: <Video className="w-4 h-4 text-blue-500" />,
  article: <FileText className="w-4 h-4 text-green-500" />,
  live: <Radio className="w-4 h-4 text-rose-500" />,
  task: <ClipboardList className="w-4 h-4 text-amber-500" />,
};

const ENROLL_STATUS_COLOR: Record<EnrollmentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-amber-100 text-amber-700',
};

function durationLabel(days: number | null): string {
  if (days == null) return '—';
  if (days % 7 === 0) return `${days / 7} weeks`;
  return `${days} days`;
}

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: prog, isLoading, isError, refetch } = useProgram(id);
  const published = !!prog && prog.status === 'published' && prog.currentVersion > 0;
  const versionQuery = useProgramVersion(id, published ? prog!.currentVersion : undefined);
  const roster = useProgramRoster(id);
  const publish = usePublishProgram(id ?? '');

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading program…</div>;
  }
  if (isError || !prog) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertCircle className="w-7 h-7 text-destructive" /> Couldn't load this program.
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`${BASE}/admin/programs`)}>Back</Button>
        </div>
      </div>
    );
  }

  function share() {
    navigator.clipboard.writeText(`${window.location.origin}${BASE}/admin/programs/${prog!.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const modules: SnapshotModule[] = versionQuery.data?.snapshot.modules ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`relative rounded-2xl overflow-hidden h-44 bg-gradient-to-br ${gradientForId(prog.id)}`}>
        <div className="absolute inset-0 flex items-center justify-center text-white/20"><BookOpen className="w-24 h-24" /></div>
        <Button variant="ghost" size="icon" className="absolute top-3 left-3 text-white hover:bg-white/20" onClick={() => navigate(`${BASE}/admin/programs`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="absolute bottom-4 left-5 right-5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold bg-white/90 capitalize ${statusColor(prog.status)}`}>{prog.status}</span>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/90 text-foreground capitalize">{prog.visibility}</span>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/90 text-foreground">v{prog.currentVersion}</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-white drop-shadow">{prog.title}</h1>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => navigate(`${BASE}/admin/programs/${prog.id}/edit`)}><Edit2 className="w-4 h-4 mr-1.5" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={share}>{copied ? <CheckSquare className="w-4 h-4 mr-1.5 text-green-600" /> : <Share2 className="w-4 h-4 mr-1.5" />}{copied ? 'Copied' : 'Share'}</Button>
        {prog.status === 'draft' && (
          <Button size="sm" variant="outline" onClick={() => publish.publish()} disabled={publish.isPending}>
            {publish.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Rocket className="w-4 h-4 mr-1.5" />} Publish
          </Button>
        )}
        {prog.status !== 'archived' && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setArchiveOpen(true)}><Archive className="w-4 h-4 mr-1.5" /> Archive</Button>
        )}
      </div>

      {/* Quick facts (real fields only) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Price', value: prog.pricePaise === 0 ? 'Free' : rupeesFromPaise(prog.pricePaise) },
          { label: 'Duration', value: durationLabel(prog.durationDays) },
          { label: 'Enrolled', value: roster.isLoading ? '…' : String(roster.data?.length ?? 0) },
          { label: 'Max enrollments', value: prog.maxEnrollments != null ? String(prog.maxEnrollments) : 'Unlimited' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{prog.description || 'No description provided.'}</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold mb-3">Details</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              {[
                { label: 'Slug', value: prog.slug },
                { label: 'Visibility', value: prog.visibility },
                { label: 'Status', value: prog.status },
                { label: 'Current version', value: `v${prog.currentVersion}` },
                { label: 'Currency', value: prog.currency },
                { label: 'Created', value: new Date(prog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Published', value: prog.publishedAt ? new Date(prog.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              ].map((d) => (
                <div key={d.label}>
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  <p className="font-medium capitalize">{d.value}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Curriculum — published snapshot */}
        <TabsContent value="curriculum" className="space-y-4">
          {!published ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Curriculum preview is available after publishing.</p>
                <p className="mt-1">The backend exposes curriculum only as an immutable published-version snapshot — there's no draft-curriculum read endpoint. Publish this program to view and verify its frozen curriculum here.</p>
              </div>
            </div>
          ) : versionQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading curriculum…</div>
          ) : modules.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">This version has no modules.</div>
          ) : (
            modules.map((m) => (
              <div key={m.id} className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/20">
                  <p className="font-semibold">{m.title}</p>
                  {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                </div>
                <div className="divide-y">
                  {m.sessions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No sessions.</p>
                  ) : m.sessions.map((s) => (
                    <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                      {CONTENT_ICON[s.contentType]}
                      <span className="text-sm flex-1">{s.title}</span>
                      {s.durationSeconds != null && <span className="text-xs text-muted-foreground">{Math.round(s.durationSeconds / 60)} min</span>}
                      <Badge variant="secondary" className="text-xs capitalize">{s.contentType}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Roster — real enrollments */}
        <TabsContent value="roster" className="space-y-4">
          {roster.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading roster…</div>
          ) : roster.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load roster.<Button variant="outline" size="sm" onClick={() => roster.refetch()}>Retry</Button></div>
          ) : (roster.data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground"><Users className="w-8 h-8 opacity-40" /> No enrollments yet.</div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Learner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.data!.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.userId.slice(0, 8)}</TableCell>
                      <TableCell><Badge className={`text-xs border-0 capitalize ${ENROLL_STATUS_COLOR[e.status]}`}>{e.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-32">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(e.progressPct)}%` }} /></div>
                          <span className="text-xs text-muted-foreground">{Math.round(e.progressPct)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this program?</AlertDialogTitle>
            <AlertDialogDescription>It will be hidden from new enrollments. Existing enrollments retain access (no hard delete).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { publish.archive(); setArchiveOpen(false); toast.success('Program archived'); }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
