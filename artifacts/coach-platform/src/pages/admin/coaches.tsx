import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useOrgMembers,
  useCreateInvitation,
  type MemberRole,
  type MemberStatus,
  type OrganizationMember,
  type StaffRole,
} from '@/lib/organizations';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner_coach: 'Owner Coach',
  nutritionist: 'Nutritionist',
  community_manager: 'Community Manager',
};

const ACTIVE_STATUSES: MemberStatus[] = ['active'];

function memberInitial(m: OrganizationMember): string {
  return ROLE_LABELS[m.memberRole]?.charAt(0) ?? '?';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export default function Coaches() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: members = [], isLoading, isError, refetch } = useOrgMembers(organizationId);
  const createInvitation = useCreateInvitation(organizationId ?? '');

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [invite, setInvite] = useState<{ email: string; invitedRole: StaffRole }>({
    email: '',
    invitedRole: 'nutritionist',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        ROLE_LABELS[m.memberRole].toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q),
    );
  }, [members, search]);

  function handleInvite() {
    if (!invite.email) { toast.error('Email is required'); return; }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Coaches & Staff</h1>
          <p className="text-muted-foreground">Your organization's members and their roles</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!organizationId}>
          <Plus className="w-4 h-4 mr-2" /> Add Member
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Members</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by role or status..."
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading members…
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <p>Couldn't load members.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {members.length === 0 ? 'No members in this organization yet.' : 'No members match your search.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                          {memberInitial(m)}
                        </div>
                        <div>
                          <p className="font-medium">{ROLE_LABELS[m.memberRole]}</p>
                          <p className="text-xs text-muted-foreground font-mono">{shortId(m.userId)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[m.memberRole]}</TableCell>
                    <TableCell>
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ACTIVE_STATUSES.includes(m.status) ? 'default' : 'secondary'}
                        className={ACTIVE_STATUSES.includes(m.status) ? 'bg-primary/20 text-primary hover:bg-primary/30 border-0 capitalize' : 'bg-muted text-muted-foreground border-0 capitalize'}
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
                placeholder="member@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={invite.invitedRole}
                onValueChange={(v) => setInvite((s) => ({ ...s, invitedRole: v as StaffRole }))}
              >
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
    </div>
  );
}
