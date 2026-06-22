import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, MoreVertical, Search, Users, Loader2, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useOrgMembers,
  useMemberPermissions,
  useCreateInvitation,
  useUpdateMember,
  type OrganizationMember,
  type MemberRole,
  type MemberStatus,
  type StaffRole,
  type Capability,
} from '@/lib/organizations';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner_coach: 'Owner Coach',
  nutritionist: 'Nutritionist',
  community_manager: 'Community Manager',
};

const STATUS_COLORS: Record<MemberStatus, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-blue-100 text-blue-700',
  suspended: 'bg-amber-100 text-amber-700',
  removed: 'bg-gray-100 text-gray-500',
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  view_client_health: 'View Client Health',
  manage_programs: 'Manage Programs',
  manage_diet_charts: 'Manage Diet Charts',
  message_clients: 'Message Clients',
  moderate_community: 'Moderate Community',
  manage_staff: 'Manage Staff',
  view_revenue: 'View Revenue',
  manage_lab_recommendations: 'Lab Recommendations',
  manage_products: 'Manage Products',
  write_clinical_notes: 'Clinical Notes',
  manage_care_plans: 'Care Plans',
};

function roleInitials(role: MemberRole): string {
  return ROLE_LABELS[role].split(' ').map((w) => w[0]).join('').slice(0, 2);
}

/** Capability list for a member — lazily fetched only when the detail modal opens. */
function MemberCapabilities({ orgId, memberId }: { orgId: string; memberId: string }) {
  const { data: perms = [], isLoading } = useMemberPermissions(orgId, memberId);
  if (isLoading) {
    return <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading capabilities…</p>;
  }
  if (perms.length === 0) {
    return <p className="text-xs text-muted-foreground">No capabilities granted.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {perms.map((p) => (
        <Badge key={p.id} variant="secondary" className="text-xs">{CAPABILITY_LABELS[p.capability]}</Badge>
      ))}
    </div>
  );
}

export default function MyTeam() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: members = [], isLoading, isError, refetch } = useOrgMembers(organizationId);
  const createInvitation = useCreateInvitation(organizationId ?? '');
  const updateMember = useUpdateMember(organizationId ?? '');

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<OrganizationMember | null>(null);
  const [invite, setInvite] = useState<{ email: string; invitedRole: StaffRole }>({ email: '', invitedRole: 'nutritionist' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => ROLE_LABELS[m.memberRole].toLowerCase().includes(q) || m.userId.toLowerCase().includes(q) || m.status.toLowerCase().includes(q),
    );
  }, [members, search]);

  const activeCount = members.filter((m) => m.status === 'active').length;
  const invitedCount = members.filter((m) => m.status === 'invited').length;

  function handleInvite() {
    if (!invite.email) { toast.error('Email is required'); return; }
    // D0 invitation contract: { email, invitedRole, token (min 8), expiresAt (ISO) }.
    const token = (globalThis.crypto?.randomUUID?.() ?? `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    createInvitation.mutate(
      { email: invite.email, invitedRole: invite.invitedRole, token, expiresAt },
      {
        onSuccess: () => {
          toast.success(`Invitation created for ${invite.email}`);
          setAddOpen(false);
          setInvite({ email: '', invitedRole: 'nutritionist' });
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not create invitation'),
      },
    );
  }

  function suspend(m: OrganizationMember) {
    updateMember.mutate(
      { memberId: m.id, status: 'suspended' },
      { onSuccess: () => toast.success('Member suspended'), onError: () => toast.error('Could not update member') },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Team</h1>
          <p className="text-muted-foreground mt-0.5">{activeCount} active · {invitedCount} invited</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!organizationId}>
          <Plus className="w-4 h-4 mr-2" /> Invite Member
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by role or status..." className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading team…</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load team.
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Users className="w-8 h-8 opacity-40" />
              {members.length === 0 ? 'No team members yet. Invite your first member.' : 'No members match your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Member</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">{roleInitials(m.memberRole)}</div>
                          <div className="min-w-0">
                            <p className="font-medium">{ROLE_LABELS[m.memberRole]}</p>
                            <p className="text-xs text-muted-foreground font-mono">{m.userId.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">{ROLE_LABELS[m.memberRole]}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-xs text-muted-foreground">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4"><Badge className={`text-xs border-0 capitalize ${STATUS_COLORS[m.status]}`}>{m.status}</Badge></td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailMember(m)}>View Details</DropdownMenuItem>
                            {m.memberRole !== 'owner_coach' && m.status === 'active' && (
                              <DropdownMenuItem className="text-destructive" onClick={() => suspend(m)}>Suspend</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address *</Label>
              <Input type="email" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} placeholder="member@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={invite.invitedRole} onValueChange={(v) => setInvite((s) => ({ ...s, invitedRole: v as StaffRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nutritionist">Nutritionist</SelectItem>
                  <SelectItem value="community_manager">Community Manager</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Owner-coach role can't be assigned. Granular capabilities are granted after the member accepts.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={createInvitation.isPending}>
              {createInvitation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!detailMember} onOpenChange={(v) => !v && setDetailMember(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Member Profile</DialogTitle></DialogHeader>
          {detailMember && organizationId && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xl font-bold">{roleInitials(detailMember.memberRole)}</div>
                <div>
                  <p className="font-bold text-lg">{ROLE_LABELS[detailMember.memberRole]}</p>
                  <p className="text-xs text-muted-foreground font-mono">{detailMember.userId}</p>
                </div>
                <Badge className={`ml-auto border-0 capitalize ${STATUS_COLORS[detailMember.status]}`}>{detailMember.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="font-medium">{detailMember.joinedAt ? new Date(detailMember.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Invited</p>
                  <p className="font-medium">{detailMember.invitedAt ? new Date(detailMember.invitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
              <div>
                <p className="font-medium text-sm mb-2">Capabilities</p>
                <MemberCapabilities orgId={organizationId} memberId={detailMember.id} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailMember(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
