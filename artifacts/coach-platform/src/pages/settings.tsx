import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useOrgProfile, useUpsertOrgProfile, type KycStatus } from '@/lib/organizations';
import { toast } from 'sonner';

// Session management requires real authentication (D1, deferred). The fabricated
// device/IP list was removed — sessions are surfaced honestly as unavailable.
const SESSION_DATA: { id: string; device: string; ip: string; location: string; lastSeen: string; current: boolean }[] = [];

const KYC_BADGE: Record<KycStatus, string> = {
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

/**
 * Organization Profile — the one genuinely D0-backed section of settings.
 * Reads/writes /organizations/:id/profile. PAN/bank ciphertext fields are
 * intentionally NOT edited here (handled by a dedicated KYC flow upstream).
 */
function OrgProfileSection({ organizationId }: { organizationId: string | undefined }) {
  const { data: profile, isLoading, isError, refetch } = useOrgProfile(organizationId);
  const upsert = useUpsertOrgProfile(organizationId ?? '');
  const [form, setForm] = useState({ legalName: '', description: '', websiteUrl: '', gstin: '' });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the form once the profile arrives.
  if (profile && !hydrated) {
    setForm({
      legalName: profile.legalName ?? '',
      description: profile.description ?? '',
      websiteUrl: profile.websiteUrl ?? '',
      gstin: profile.gstin ?? '',
    });
    setHydrated(true);
  }

  function save() {
    upsert.mutate(
      {
        legalName: form.legalName || undefined,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        gstin: form.gstin || undefined,
      },
      {
        onSuccess: () => toast.success('Organization profile saved'),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not save profile'),
      },
    );
  }

  if (isLoading) {
    return <Card><CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading organization…</CardContent></Card>;
  }
  if (isError) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground space-y-3">Couldn't load organization profile.<div><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Organization Profile</span>
          {profile && <Badge className={`border-0 text-xs capitalize ${KYC_BADGE[profile.kycStatus]}`}>KYC: {profile.kycStatus}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Legal Name</Label>
            <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} placeholder="Registered business name" />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN</Label>
            <Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
        </div>
        <p className="text-xs text-muted-foreground">PAN &amp; bank details are managed through the dedicated KYC flow (app-encrypted) and are never edited here.</p>
        <div className="flex justify-end">
          <Button onClick={save} disabled={upsert.isPending || !organizationId}>
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Organization'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const NOTIFICATION_EVENTS = [
  { key: 'new_client', label: 'New client enrollment' },
  { key: 'message', label: 'New message received' },
  { key: 'checkin', label: 'Client check-in submitted' },
  { key: 'diet_view', label: 'Client viewed diet chart' },
  { key: 'collab_req', label: 'Collaboration request' },
  { key: 'payment', label: 'Payment received' },
  { key: 'zoom', label: 'Zoom session starting (15 min)' },
  { key: 'badge', label: 'Client earned a badge' },
  { key: 'low_engagement', label: 'Client low engagement alert' },
];

const DEFAULT_MEAL_SLOTS = [
  { name: 'Early Morning', time: '06:30 AM' },
  { name: 'Breakfast', time: '08:00 AM' },
  { name: 'Mid-Morning Snack', time: '10:30 AM' },
  { name: 'Lunch', time: '01:00 PM' },
  { name: 'Evening Snack', time: '04:30 PM' },
  { name: 'Dinner', time: '07:30 PM' },
  { name: 'Post-Dinner', time: '09:00 PM' },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const organizationId = user?.organizationId;

  const [showPass, setShowPass] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAConfirm, setTwoFAConfirm] = useState(false);
  const [sessions, setSessions] = useState(SESSION_DATA);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Record<string, { email: boolean; push: boolean }>>(
    Object.fromEntries(NOTIFICATION_EVENTS.map(e => [e.key, { email: true, push: e.key !== 'badge' && e.key !== 'diet_view' }]))
  );
  const [mealSlots, setMealSlots] = useState(DEFAULT_MEAL_SLOTS);
  const [profileForm, setProfileForm] = useState({
    firstName: 'Dr. Radha', lastName: 'Krishnan',
    email: isAdmin ? 'admin@vitale.com' : 'dr.radha@vitale.com',
    phone: '+91 98765 43210',
    bio: 'Certified Clinical Nutritionist and Functional Medicine practitioner with 12+ years of experience.',
    specializations: 'Weight Management, PCOS, Diabetes, Gut Health, Sports Nutrition',
    certifications: 'MSc Clinical Nutrition, Certified Functional Medicine Practitioner, IIN Health Coach',
  });

  const adminTabs = ['General', 'Profile', 'Notifications', 'Diet Defaults', 'Gamification', 'Integrations', 'Security'];
  const coachTabs = ['Profile', 'Notifications', 'Diet Defaults', 'Team Preferences', 'Security', 'Billing'];

  const tabList = isAdmin ? adminTabs : coachTabs;

  function saveSection(section: string) {
    toast.success(`${section} settings saved`);
  }

  function revokeSession(id: string) {
    setSessions(s => s.filter(x => x.id !== id));
    setRevokeId(null);
    toast.success('Session revoked');
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-0.5">Manage your account and platform preferences</p>
      </div>

      <Tabs defaultValue={tabList[0].toLowerCase().replace(' ', '-')}>
        <TabsList className="flex-wrap h-auto gap-1">
          {tabList.map(t => (
            <TabsTrigger key={t} value={t.toLowerCase().replace(/\s+/g, '-')}>{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* General (admin only) — real D0 organization profile */}
        {isAdmin && (
          <TabsContent value="general" className="space-y-6">
            <OrgProfileSection organizationId={organizationId} />
          </TabsContent>
        )}

        {/* Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold">DR</div>
                <div>
                  <Button variant="outline" size="sm" onClick={() => toast.info('Photo upload coming soon')}>Change Photo</Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={profileForm.firstName} onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={profileForm.lastName} onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Specializations</Label>
                <Input value={profileForm.specializations} onChange={e => setProfileForm(p => ({ ...p, specializations: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Certifications</Label>
                <Input value={profileForm.certifications} onChange={e => setProfileForm(p => ({ ...p, certifications: e.target.value }))} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection('Profile')}>Save Profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Event</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIFICATION_EVENTS.map(event => (
                      <tr key={event.key} className="border-b">
                        <td className="py-3">{event.label}</td>
                        <td className="py-3 text-center">
                          <Switch checked={notifications[event.key]?.email}
                            onCheckedChange={v => setNotifications(n => ({ ...n, [event.key]: { ...n[event.key], email: v } }))} />
                        </td>
                        <td className="py-3 text-center">
                          <Switch checked={notifications[event.key]?.push}
                            onCheckedChange={v => setNotifications(n => ({ ...n, [event.key]: { ...n[event.key], push: v } }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => saveSection('Notification')}>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diet Defaults */}
        <TabsContent value="diet-defaults" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Default Meal Slots</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {mealSlots.map((slot, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{i + 1}</div>
                  <Input value={slot.name} onChange={e => setMealSlots(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1" />
                  <Input value={slot.time} onChange={e => setMealSlots(s => s.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} className="w-32" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMealSlots(s => s.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMealSlots(s => [...s, { name: 'New Meal', time: '12:00 PM' }])}>
                <Plus className="w-4 h-4 mr-1" /> Add Meal Slot
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Default Targets</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Default Calorie Target (kcal)</Label>
                  <Input type="number" defaultValue={1600} />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Water Target (L)</Label>
                  <Input type="number" defaultValue={2.5} step={0.5} />
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Default Macronutrient Split</Label>
                <div className="grid grid-cols-3 gap-4">
                  {[['Carbohydrates', 50], ['Protein', 25], ['Fats', 25]].map(([name, val]) => (
                    <div key={name as string} className="space-y-1.5">
                      <Label className="text-xs">{name} (%)</Label>
                      <Input type="number" defaultValue={val} min={0} max={100} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection('Diet Defaults')}>Save Diet Defaults</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gamification (admin) */}
        {isAdmin && (
          <TabsContent value="gamification" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Gamification Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Enable Leaderboard', desc: 'Show client rankings across programs', defaultOn: true },
                  { label: 'Enable Badges', desc: 'Auto-award badges based on milestones', defaultOn: true },
                  { label: 'Enable Challenges', desc: 'Allow coaches to create group challenges', defaultOn: true },
                  { label: 'Public Leaderboard', desc: 'Allow clients to see each other\'s rankings', defaultOn: false },
                  { label: 'Streak Tracking', desc: 'Track and reward daily check-in streaks', defaultOn: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.defaultOn} onCheckedChange={() => toast.success(`${item.label} updated`)} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Points per diet adherence day</Label>
                    <Input type="number" defaultValue={50} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Streak multiplier bonus (per week)</Label>
                    <Input type="number" defaultValue={10} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => saveSection('Gamification')}>Save Gamification</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Integrations (admin) */}
        {isAdmin && (
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Connected Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Zoom', desc: 'Video consultations and group sessions', connected: true, icon: '🎥' },
                  { name: 'Razorpay', desc: 'Payment processing for Indian clients', connected: true, icon: '💳' },
                  { name: 'WhatsApp Business', desc: 'Message clients via WhatsApp', connected: false, icon: '💬' },
                  { name: 'Google Calendar', desc: 'Sync sessions to calendar', connected: false, icon: '📅' },
                ].map(intg => (
                  <div key={intg.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{intg.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{intg.name}</p>
                        <p className="text-xs text-muted-foreground">{intg.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {intg.connected && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Connected</Badge>}
                      <Button variant={intg.connected ? 'ghost' : 'outline'} size="sm"
                        onClick={() => toast.success(intg.connected ? `${intg.name} disconnected` : `${intg.name} connected`)}>
                        {intg.connected ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Team Preferences (coach) */}
        {!isAdmin && (
          <TabsContent value="team-preferences" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Team Collaboration Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Require approval for diet chart changes', desc: 'Team members must get your approval before publishing diet charts', on: true },
                  { label: 'Copy me on all team messages', desc: 'Receive a copy of every message sent by team members', on: false },
                  { label: 'Team member activity notifications', desc: 'Get notified when team members create or update content', on: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.on} onCheckedChange={() => toast.success('Preference updated')} />
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button onClick={() => saveSection('Team Preferences')}>Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Billing (coach, read-only) */}
        {!isAdmin && (
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Billing Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Revenue, payout, and commission figures aren't available yet. Subscriptions, payments,
                  and billing (D8) are not implemented, so no financial numbers are shown here rather than
                  fabricated ones. Banking details are managed through the KYC flow.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showPass ? 'text' : 'password'} placeholder="Enter current password" />
                  <button className="absolute right-2.5 top-2.5 text-muted-foreground" onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="Min 8 characters" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <Input type="password" placeholder="Repeat new password" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast.success('Password updated successfully')}>Update Password</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Two-Factor Authentication</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security with authenticator app or SMS</p>
                  {twoFAEnabled && <Badge className="mt-1 bg-green-100 text-green-700 border-0 text-xs">Active</Badge>}
                </div>
                <Switch checked={twoFAEnabled} onCheckedChange={v => { if (v) setTwoFAConfirm(true); else { setTwoFAEnabled(false); toast.success('2FA disabled'); } }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Active Sessions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Session management requires real authentication, which isn't implemented yet (D1).
                  Active devices will appear here once login is wired — no fabricated sessions are shown.
                </p>
              )}
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{s.device}</p>
                      {s.current && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.location} · {s.ip} · {s.lastSeen}</p>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRevokeId(s.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 2FA Confirm Modal */}
      <Dialog open={twoFAConfirm} onOpenChange={v => { if (!v) setTwoFAConfirm(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Enable Two-Factor Authentication</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="w-32 h-32 bg-muted mx-auto rounded-lg flex items-center justify-center">
              <div className="grid grid-cols-4 gap-0.5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm ${Math.random() > 0.5 ? 'bg-foreground' : 'bg-transparent'}`} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Verification Code</Label>
              <Input placeholder="Enter 6-digit code" maxLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFAConfirm(false)}>Cancel</Button>
            <Button onClick={() => { setTwoFAEnabled(true); setTwoFAConfirm(false); toast.success('2FA enabled successfully!'); }}>Verify & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Session Confirm */}
      <Dialog open={!!revokeId} onOpenChange={v => !v && setRevokeId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Revoke Session?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will immediately sign out the device. They will need to log in again.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeId && revokeSession(revokeId)}>Revoke Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
