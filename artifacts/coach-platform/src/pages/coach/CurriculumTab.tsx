import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, GripVertical, ChevronDown, ChevronUp, Edit2, Trash2, Eye,
  Copy, BookOpen, CheckSquare, Video, FileText, Milestone, AlignLeft,
  ToggleLeft, ToggleRight, ChevronRight, Dumbbell, Paperclip, Flag,
  Layers, Lock, Unlock, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type ContentBlockType = 'diet-chart' | 'habit' | 'session' | 'resource' | 'milestone' | 'text';
type ModuleStatus = 'Draft' | 'Published';
type CompletionCriteria = 'none' | 'log-meals' | 'habits' | 'sessions';

interface ContentBlock {
  id: string;
  type: ContentBlockType;
  title: string;
  status: 'Active' | 'Draft';
  detail?: string;
}

interface CurriculumModule {
  id: string;
  title: string;
  weekStart: number;
  weekEnd: number;
  description: string;
  status: ModuleStatus;
  locked: boolean;
  completionCriteria: CompletionCriteria;
  criteriaValue: number;
  blocks: ContentBlock[];
}

// ─── Content block config ─────────────────────────────────────────────────────
const BLOCK_CFG: Record<ContentBlockType, { label: string; icon: React.ReactNode; color: string }> = {
  'diet-chart': { label: 'Diet Chart',     icon: <BookOpen className="w-3.5 h-3.5" />,  color: 'text-green-600 bg-green-50 border-green-200' },
  'habit':      { label: 'Habit',          icon: <CheckSquare className="w-3.5 h-3.5" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  'session':    { label: 'Session',        icon: <Video className="w-3.5 h-3.5" />,       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  'resource':   { label: 'Resource',       icon: <Paperclip className="w-3.5 h-3.5" />,   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  'milestone':  { label: 'Milestone',      icon: <Flag className="w-3.5 h-3.5" />,        color: 'text-orange-600 bg-orange-50 border-orange-200' },
  'text':       { label: 'Text Content',   icon: <AlignLeft className="w-3.5 h-3.5" />,   color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const CRITERIA_LABELS: Record<CompletionCriteria, string> = {
  'none': 'Time-based (auto-unlock by week)',
  'log-meals': 'Log meals for X days',
  'habits': 'Complete X habits',
  'sessions': 'Attend X sessions',
};

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED_MODULES: CurriculumModule[] = [
  {
    id: 'm1', title: 'Foundation & Assessment', weekStart: 1, weekEnd: 2,
    description: 'Baseline health metrics, food diary setup, and introduction to low-GI eating. Understanding your body type and hormonal profile.',
    status: 'Published', locked: false, completionCriteria: 'log-meals', criteriaValue: 7,
    blocks: [
      { id: 'b1', type: 'text',       title: 'Welcome & Program Overview',        status: 'Active', detail: 'Introduction to the PCOS reversal journey.' },
      { id: 'b2', type: 'diet-chart', title: 'Week 1 Foundation Diet Plan',        status: 'Active', detail: 'Low-GI, anti-inflammatory base plan' },
      { id: 'b3', type: 'habit',      title: 'Morning Walk (30 min)',              status: 'Active', detail: 'Daily • 7:00 AM' },
      { id: 'b4', type: 'resource',   title: 'PCOS Diet Guide.pdf',               status: 'Active', detail: 'Downloadable reference guide' },
      { id: 'b5', type: 'milestone',  title: 'Complete first 7 days of logging',  status: 'Active', detail: 'Checkpoint to unlock Module 2' },
    ],
  },
  {
    id: 'm2', title: 'Metabolic Reset', weekStart: 3, weekEnd: 4,
    description: 'Targeted nutrition protocol for blood sugar regulation. Introduction to cycle-syncing principles.',
    status: 'Published', locked: false, completionCriteria: 'habits', criteriaValue: 5,
    blocks: [
      { id: 'b6', type: 'diet-chart', title: 'Week 3 Metabolic Reset Plan',    status: 'Active' },
      { id: 'b7', type: 'habit',      title: 'No Sugar After 6 PM',           status: 'Active' },
      { id: 'b8', type: 'session',    title: 'Mid-program Consultation',      status: 'Active', detail: '30 min · Zoom' },
      { id: 'b9', type: 'resource',   title: 'Seed Cycling Guide.pdf',        status: 'Active' },
    ],
  },
  {
    id: 'm3', title: 'Hormonal Healing', weekStart: 5, weekEnd: 6,
    description: 'Deep dive into stress management, sleep optimisation, and supplement protocol. Lab interpretation session.',
    status: 'Draft', locked: true, completionCriteria: 'sessions', criteriaValue: 1,
    blocks: [
      { id: 'b10', type: 'text',      title: 'Understanding Cortisol & PCOS', status: 'Draft' },
      { id: 'b11', type: 'habit',     title: '10-min Guided Meditation',      status: 'Active' },
      { id: 'b12', type: 'session',   title: 'Detailed Review — Lab Results', status: 'Draft', detail: '45 min · Zoom' },
    ],
  },
  {
    id: 'm4', title: 'Lifestyle Integration', weekStart: 7, weekEnd: 8,
    description: 'Sustainable habit stacking, social eating strategies, and long-term maintenance plan design.',
    status: 'Draft', locked: true, completionCriteria: 'none', criteriaValue: 0,
    blocks: [],
  },
];

// ─── Block type picker ────────────────────────────────────────────────────────
function BlockTypePicker({ onSelect, onClose }: { onSelect: (t: ContentBlockType) => void; onClose: () => void }) {
  return (
    <div className="absolute z-10 top-full left-0 mt-1 bg-card border rounded-xl shadow-lg p-2 w-56 space-y-0.5" onClick={e => e.stopPropagation()}>
      {(Object.entries(BLOCK_CFG) as [ContentBlockType, typeof BLOCK_CFG[ContentBlockType]][]).map(([type, cfg]) => (
        <button
          key={type}
          onClick={() => { onSelect(type); onClose(); }}
          className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm text-left transition-colors border', cfg.color)}
        >
          {cfg.icon} {cfg.label}
        </button>
      ))}
    </div>
  );
}

// ─── Content Block Row ────────────────────────────────────────────────────────
function BlockRow({ block, onEdit, onDelete }: { block: ContentBlock; onEdit: () => void; onDelete: () => void }) {
  const cfg = BLOCK_CFG[block.type];
  return (
    <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-card hover:shadow-sm group">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab shrink-0" />
      <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border', cfg.color, 'shrink-0')}>
        {cfg.icon} {cfg.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{block.title}</p>
        {block.detail && <p className="text-xs text-muted-foreground truncate">{block.detail}</p>}
      </div>
      <Badge className={cn('text-[10px] border-0 shrink-0', block.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
        {block.status}
      </Badge>
      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={onEdit}><Edit2 className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

// ─── Edit Block Modal ─────────────────────────────────────────────────────────
function EditBlockModal({ block, onSave, onClose }: {
  block: ContentBlock;
  onSave: (b: ContentBlock) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...block });
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit Content Block</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Detail / Description</Label>
            <Input value={form.detail ?? ''} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} placeholder="Optional detail" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(['Active', 'Draft'] as const).map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn('flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors', form.status === s ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(form); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────
function ModuleCard({ module, index, totalWeeks, onChange, onDelete }: {
  module: CurriculumModule;
  index: number;
  totalWeeks: number;
  onChange: (m: CurriculumModule) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);

  function addBlock(type: ContentBlockType) {
    const newBlock: ContentBlock = {
      id: `bl-${Date.now()}`, type, title: BLOCK_CFG[type].label, status: 'Draft',
    };
    onChange({ ...module, blocks: [...module.blocks, newBlock] });
  }

  function updateBlock(updated: ContentBlock) {
    onChange({ ...module, blocks: module.blocks.map(b => b.id === updated.id ? updated : b) });
  }

  function deleteBlock(id: string) {
    onChange({ ...module, blocks: module.blocks.filter(b => b.id !== id) });
  }

  const weekPct = ((module.weekEnd - 1) / (totalWeeks || 8)) * 100;
  const weekWidth = ((module.weekEnd - module.weekStart + 1) / (totalWeeks || 8)) * 100;

  return (
    <>
      <div className={cn('border rounded-xl overflow-hidden', module.status === 'Published' ? 'border-primary/20' : 'border-dashed border-muted-foreground/30')}>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted/30 relative">
          <div className="absolute h-full bg-primary/40 rounded-r" style={{ left: `${weekPct}%`, width: `${weekWidth}%` }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
          <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0" />
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{module.title}</p>
              <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                Week {module.weekStart}–{module.weekEnd}
              </span>
              <Badge className={cn('text-[10px] border-0', module.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                {module.status}
              </Badge>
              {module.locked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
            </div>
            {!expanded && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">{module.blocks.length} items</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={e => { e.stopPropagation(); setEditingMeta(true); }}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={e => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>

            {/* Completion criteria */}
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Completion:</span>
              <span className="bg-muted/40 rounded px-2 py-0.5">
                {CRITERIA_LABELS[module.completionCriteria]}
                {module.completionCriteria !== 'none' && module.criteriaValue > 0 && ` (${module.criteriaValue})`}
              </span>
              <button
                onClick={() => onChange({ ...module, locked: !module.locked })}
                className={cn('flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition-colors', module.locked ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-green-300 text-green-600 bg-green-50')}
              >
                {module.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {module.locked ? 'Locked' : 'Unlocked'}
              </button>
            </div>

            {/* Content blocks */}
            <div className="space-y-1.5">
              {module.blocks.length === 0 ? (
                <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                  No content blocks yet — add one below
                </div>
              ) : (
                module.blocks.map(block => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    onEdit={() => setEditingBlock(block)}
                    onDelete={() => deleteBlock(block.id)}
                  />
                ))
              )}
            </div>

            {/* Add block */}
            <div className="relative">
              <button
                onClick={() => setShowBlockPicker(v => !v)}
                className="flex items-center gap-1.5 text-xs text-primary border border-dashed border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Content Block
              </button>
              {showBlockPicker && (
                <>
                  <div className="fixed inset-0 z-[5]" onClick={() => setShowBlockPicker(false)} />
                  <BlockTypePicker onSelect={addBlock} onClose={() => setShowBlockPicker(false)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit block modal */}
      {editingBlock && (
        <EditBlockModal
          block={editingBlock}
          onSave={updated => { updateBlock(updated); setEditingBlock(null); }}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {/* Edit module meta modal */}
      {editingMeta && (
        <EditModuleModal
          module={module}
          onSave={m => { onChange(m); setEditingMeta(false); }}
          onClose={() => setEditingMeta(false)}
        />
      )}
    </>
  );
}

// ─── Edit Module Modal ────────────────────────────────────────────────────────
function EditModuleModal({ module, onSave, onClose }: {
  module: CurriculumModule;
  onSave: (m: CurriculumModule) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...module });

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Module</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Module Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Week</Label>
              <Input type="number" min="1" max="52" value={form.weekStart} onChange={e => setForm(f => ({ ...f, weekStart: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End Week</Label>
              <Input type="number" min="1" max="52" value={form.weekEnd} onChange={e => setForm(f => ({ ...f, weekEnd: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (shown to client in app)</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-2">
                {(['Draft', 'Published'] as const).map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors', form.status === s ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Completion Criteria</Label>
            <div className="relative">
              <select
                value={form.completionCriteria}
                onChange={e => setForm(f => ({ ...f, completionCriteria: e.target.value as CompletionCriteria }))}
                className="w-full border rounded-lg px-3 py-2 text-sm appearance-none bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.entries(CRITERIA_LABELS) as [CompletionCriteria, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {form.completionCriteria !== 'none' && (
            <div className="space-y-1.5">
              <Label>Required count</Label>
              <Input type="number" min="1" value={form.criteriaValue} onChange={e => setForm(f => ({ ...f, criteriaValue: Number(e.target.value) }))} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (!form.title.trim()) { toast.error('Title required'); return; } onSave(form); onClose(); }}>Save Module</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({ modules }: { modules: CurriculumModule[] }) {
  const [selectedMod, setSelectedMod] = useState(modules[0]?.id ?? '');
  const mod = modules.find(m => m.id === selectedMod);

  return (
    <div className="border rounded-2xl overflow-hidden shadow-xl max-w-sm mx-auto bg-white">
      {/* Phone status bar */}
      <div className="bg-[#1a1a2e] text-white text-xs px-4 py-2 flex items-center justify-between">
        <span>9:41 AM</span>
        <div className="flex gap-1.5 items-center">
          <div className="w-4 h-2 border border-white rounded-sm"><div className="w-3/4 h-full bg-white rounded-sm" /></div>
        </div>
      </div>
      {/* App header */}
      <div className="bg-[#3d9b5f] text-white px-4 py-3">
        <p className="text-xs opacity-75">PCOS Reversal Program</p>
        <p className="font-bold text-sm">Program Modules</p>
      </div>
      {/* Module list */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {modules.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setSelectedMod(m.id)}
            className={cn('w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors', selectedMod === m.id ? 'bg-green-50 border-l-2 border-l-[#3d9b5f]' : '')}
          >
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5', m.locked ? 'bg-gray-200 text-gray-500' : 'bg-[#3d9b5f] text-white')}>
              {m.locked ? <Lock className="w-3 h-3" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn('text-sm font-semibold', m.locked ? 'text-gray-400' : 'text-gray-800')}>{m.title}</p>
              </div>
              <p className="text-xs text-gray-400">Week {m.weekStart}–{m.weekEnd} · {m.blocks.length} items</p>
              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{m.description}</p>
            </div>
            {!m.locked && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
          </button>
        ))}
      </div>
      {/* Selected module content */}
      {mod && !mod.locked && (
        <div className="border-t px-4 py-3 bg-gray-50 space-y-2">
          <p className="text-xs font-bold text-gray-700 mb-2">Content</p>
          {mod.blocks.map(b => {
            const cfg = BLOCK_CFG[b.type];
            return (
              <div key={b.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border text-xs">
                <span className={cn('p-1 rounded border', cfg.color)}>{cfg.icon}</span>
                <span className="font-medium text-gray-700">{b.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CurriculumTab({ programId }: { programId: string }) {
  const [modules, setModules] = useState<CurriculumModule[]>(SEED_MODULES);
  const [autoUnlock, setAutoUnlock] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [newModule, setNewModule] = useState(false);

  const totalWeeks = Math.max(...modules.map(m => m.weekEnd), 8);

  function addModule() {
    const lastEnd = Math.max(...modules.map(m => m.weekEnd), 0);
    const m: CurriculumModule = {
      id: `m-${Date.now()}`,
      title: 'New Module',
      weekStart: lastEnd + 1,
      weekEnd: lastEnd + 2,
      description: '',
      status: 'Draft',
      locked: true,
      completionCriteria: 'none',
      criteriaValue: 0,
      blocks: [],
    };
    setModules(prev => [...prev, m]);
    toast.success('Module added — click the edit icon to configure it');
  }

  function updateModule(updated: CurriculumModule) {
    setModules(prev => prev.map(m => m.id === updated.id ? updated : m));
  }

  function deleteModule(id: string) {
    setModules(prev => prev.filter(m => m.id !== id));
    toast.success('Module removed');
  }

  function cloneCurriculum() {
    toast.success('Curriculum cloned to a new draft program');
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">Curriculum Builder</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {modules.length} modules · {totalWeeks} weeks total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={cloneCurriculum} className="gap-1.5 text-xs">
            <Copy className="w-3.5 h-3.5" /> Clone Curriculum
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(v => !v)} className="gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Hide' : 'Preview as User'}
          </Button>
          <Button size="sm" onClick={addModule} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Module
          </Button>
        </div>
      </div>

      {/* Auto-progression toggle */}
      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border flex-wrap">
        <button onClick={() => setAutoUnlock(v => !v)} className={autoUnlock ? 'text-primary' : 'text-muted-foreground'}>
          {autoUnlock ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
        </button>
        <div>
          <p className="text-sm font-medium">Auto-unlock modules</p>
          <p className="text-xs text-muted-foreground">
            {autoUnlock
              ? 'Next module unlocks automatically when the scheduled week arrives'
              : 'You manually unlock each module for each client (controlled progression)'}
          </p>
        </div>
      </div>

      {/* Main content — timeline + optional preview */}
      <div className={cn('gap-6', showPreview ? 'grid grid-cols-1 xl:grid-cols-[1fr_320px]' : '')}>
        {/* Visual timeline header */}
        <div className="space-y-4">
          <div className="relative h-6 bg-muted/30 rounded-full overflow-hidden">
            {modules.map(m => {
              const left = ((m.weekStart - 1) / totalWeeks) * 100;
              const width = ((m.weekEnd - m.weekStart + 1) / totalWeeks) * 100;
              return (
                <div
                  key={m.id}
                  className={cn('absolute h-full rounded-full text-[10px] font-bold flex items-center justify-center text-white truncate px-1', m.status === 'Published' ? 'bg-primary' : 'bg-muted-foreground/40')}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${m.title} (Wk ${m.weekStart}–${m.weekEnd})`}
                >
                  {m.weekEnd - m.weekStart > 0 ? m.title.split(' ')[0] : ''}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
            <span>Week 1</span>
            <span>Week {Math.ceil(totalWeeks / 2)}</span>
            <span>Week {totalWeeks}</span>
          </div>

          {/* Module cards */}
          <div className="space-y-3">
            {modules.map((m, i) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={i}
                totalWeeks={totalWeeks}
                onChange={updateModule}
                onDelete={() => deleteModule(m.id)}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button onClick={() => toast.success('Curriculum saved')} className="gap-2">
              <Save className="w-4 h-4" /> Save Curriculum
            </Button>
          </div>
        </div>

        {/* Mobile preview */}
        {showPreview && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground text-center">Mobile App Preview</p>
            <PreviewPanel modules={modules} />
          </div>
        )}
      </div>
    </div>
  );
}
