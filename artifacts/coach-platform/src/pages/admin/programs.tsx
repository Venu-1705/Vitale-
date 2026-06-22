import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, LayoutGrid, List, BookOpen, Edit2, Share2, Archive,
  MoreVertical, Sparkles, Clock, Loader2, AlertCircle, CheckSquare, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  usePrograms, useSetProgramStatus, rupeesFromPaise,
  type Program, type ProgramStatus,
} from '@/lib/programs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const STATUSES: ProgramStatus[] = ['draft', 'published', 'archived'];

// Presentation-only gradient derived deterministically from the program id —
// the backend has no category/color/emoji, so we don't fabricate one.
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

function statusStyle(s: ProgramStatus) {
  if (s === 'published') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'draft') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function durationLabel(durationDays: number | null): string {
  if (durationDays == null) return '—';
  if (durationDays % 7 === 0) return `${durationDays / 7} week${durationDays === 7 ? '' : 's'}`;
  return `${durationDays} days`;
}

function priceLabel(p: Program): string {
  return p.pricePaise === 0 ? 'Free' : rupeesFromPaise(p.pricePaise);
}

type SortKey = 'newest' | 'alpha' | 'price';

export default function Programs() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const organizationId = user?.organizationId;

  const { data: allPrograms = [], isLoading, isError, refetch } = usePrograms(
    organizationId ? { organizationId } : {},
  );
  const setStatus = useSetProgramStatus();

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [statusFilter, setStatusFilter] = useState<ProgramStatus | 'all'>('all');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const programs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allPrograms.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === 'alpha') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else list = [...list].sort((a, b) => a.pricePaise - b.pricePaise);
    return list;
  }, [allPrograms, query, statusFilter, sort]);

  function handleShare(p: Program) {
    navigator.clipboard.writeText(`${window.location.origin}${BASE}/admin/programs/${p.id}`);
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function confirmArchive() {
    if (!archiveId) return;
    // Archive = PATCH status; D3 has no hard delete (existing enrollments retained).
    setStatus.mutate(
      { id: archiveId, status: 'archived' },
      {
        onSuccess: () => toast.success('Program archived'),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not archive'),
      },
    );
    setArchiveId(null);
  }

  const title = isAdmin ? 'All Programs' : 'My Programs';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{programs.length} programme{programs.length !== 1 ? 's' : ''} found</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 shrink-0" onClick={() => navigate(`${BASE}/admin/programs/new`)}>
          <Plus className="w-4 h-4 mr-2" /> Create Program
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search programs..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProgramStatus | 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setView('table')} className={`p-2 ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading programs…</div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <AlertCircle className="w-7 h-7 text-destructive" /> Couldn't load programs.
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : programs.length === 0 ? (
        <EmptyState onCreate={() => navigate(`${BASE}/admin/programs/new`)} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {programs.map((prog) => (
            <ProgramCard
              key={prog.id}
              prog={prog}
              copied={copied}
              onView={() => navigate(`${BASE}/admin/programs/${prog.id}`)}
              onEdit={() => navigate(`${BASE}/admin/programs/${prog.id}/edit`)}
              onShare={() => handleShare(prog)}
              onArchive={() => setArchiveId(prog.id)}
            />
          ))}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Cover</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((prog) => (
                <TableRow key={prog.id} className="cursor-pointer hover:bg-muted/20" onClick={() => navigate(`${BASE}/admin/programs/${prog.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className={`w-12 h-9 rounded-lg bg-gradient-to-br ${gradientForId(prog.id)}`} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm line-clamp-1">{prog.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{prog.slug}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{prog.visibility}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{durationLabel(prog.durationDays)}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusStyle(prog.status)}`}>{prog.status}</span></TableCell>
                  <TableCell className="text-sm font-medium">{prog.pricePaise === 0 ? <span className="text-green-600">Free</span> : rupeesFromPaise(prog.pricePaise)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">v{prog.currentVersion}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(prog.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="w-7 h-7"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`${BASE}/admin/programs/${prog.id}`)}><Eye className="w-3.5 h-3.5 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`${BASE}/admin/programs/${prog.id}/edit`)}><Edit2 className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(prog)}><Share2 className="w-3.5 h-3.5 mr-2" />{copied === prog.id ? 'Copied!' : 'Share'}</DropdownMenuItem>
                        {prog.status !== 'archived' && <DropdownMenuItem className="text-destructive" onClick={() => setArchiveId(prog.id)}><Archive className="w-3.5 h-3.5 mr-2" />Archive</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!archiveId} onOpenChange={(o) => !o && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this program?</AlertDialogTitle>
            <AlertDialogDescription>It will be hidden from new enrollments. Existing enrollments retain access (no hard delete).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProgramCard({ prog, copied, onView, onEdit, onShare, onArchive }: {
  prog: Program; copied: string | null;
  onView: () => void; onEdit: () => void; onShare: () => void; onArchive: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-xl border bg-card shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 group flex flex-col"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onView}
    >
      <div className={`relative h-40 bg-gradient-to-br ${gradientForId(prog.id)}`}>
        <div className="absolute inset-0 flex items-center justify-center text-white/40"><BookOpen className="w-12 h-12" /></div>
        <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full border font-semibold backdrop-blur-sm capitalize ${statusStyle(prog.status)} bg-white/80`}>{prog.status}</span>
        <div className={`absolute inset-x-0 bottom-0 flex justify-center gap-2 p-2 transition-all duration-200 ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 hover:bg-white shadow-sm" title="Edit"><Edit2 className="w-3.5 h-3.5 text-foreground" /></button>
          <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 hover:bg-white shadow-sm" title="Share">{copied === prog.id ? <CheckSquare className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5 text-foreground" />}</button>
          <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 hover:bg-white shadow-sm" title="Archive"><Archive className="w-3.5 h-3.5 text-muted-foreground" /></button>
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-base line-clamp-2 leading-snug mb-1.5">{prog.title}</h3>
        {prog.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{prog.description}</p>}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{durationLabel(prog.durationDays)}</span>
          <span className="capitalize">{prog.visibility}</span>
          <span>v{prog.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t">
          <span className="font-semibold text-sm">{prog.pricePaise === 0 ? <span className="text-green-600">Free</span> : rupeesFromPaise(prog.pricePaise)}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <BookOpen className="w-16 h-16 text-muted-foreground/30" />
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-secondary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No programs yet</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">Create your first program to start enrolling clients and tracking their health journeys.</p>
      <Button onClick={onCreate}><Plus className="w-4 h-4 mr-2" /> Create Program</Button>
    </div>
  );
}
