import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Video, Loader2, AlertCircle, CalendarClock, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { useAccessGrants } from "@/lib/access";
import {
  useSessions,
  useCreateSession,
  useCreateSessionZoom,
  type CoachingSession,
} from "@/lib/sessions";
import { useZoomStatus, useZoomSdkSignature } from "@/lib/zoom";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed:  "bg-green-100 text-green-700",
  completed:  "bg-gray-100 text-gray-500",
  cancelled:  "bg-red-100 text-red-700",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// =============================================================================
// ZoomMeetingEmbed — embeds a Zoom meeting inline using the Meeting SDK.
// Lazy-loads the heavy SDK bundle only when actually needed.
// =============================================================================
interface EmbedProps {
  session: CoachingSession;
  onClose: () => void;
}

function ZoomMeetingEmbed({ session, onClose }: EmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef    = useRef<any>(null);
  const sigQuery     = useZoomSdkSignature(session.zoomMeetingId ? session.id : null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [joining, setJoining]   = useState(true);

  useEffect(() => {
    if (!sigQuery.data || !containerRef.current || clientRef.current) return;
    const { signature, sdkKey, meetingNumber } = sigQuery.data;

    // Lazy-load the Zoom Meeting SDK embedded module to keep the initial bundle small.
    import("@zoom/meetingsdk/embedded").then((mod) => {
      const ZoomMtgEmbedded = mod.default;
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      client.init({
        zoomAppRoot: containerRef.current!,
        language: "en-US",
        customize: {
          video: {
            isResizable: true,
            viewSizes: { default: { width: 860, height: 480 } },
          },
        },
      });

      const coachName = "Coach"; // DPDP: no PII; Zoom shows this as display name in the meeting
      client
        .join({
          sdkKey,
          signature,
          meetingNumber,
          password: "",
          userName: coachName,
        })
        .then(() => setJoining(false))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setSdkError(`Zoom error: ${msg}`);
          setJoining(false);
        });
    }).catch(() => {
      setSdkError("Failed to load the Zoom SDK. Please refresh and try again.");
      setJoining(false);
    });

    return () => {
      clientRef.current?.leaveMeeting?.().catch(() => {});
      clientRef.current = null;
    };
  }, [sigQuery.data]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">{session.title}</span>
            <Badge className="border-0 bg-blue-100 text-blue-700 text-xs">Live</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {sigQuery.isLoading && (
          <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Connecting to Zoom…</p>
          </div>
        )}

        {sigQuery.isError && (
          <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm">
              {sigQuery.error instanceof ApiError && sigQuery.error.status === 409
                ? "Create a Zoom meeting for this session first, then try starting it."
                : "Couldn't connect to Zoom. Please try again."}
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        )}

        {sdkError && (
          <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm">{sdkError}</p>
            {session.zoomStartUrl && (
              <Button
                size="sm"
                onClick={() => { window.open(session.zoomStartUrl!, "_blank", "noopener,noreferrer"); onClose(); }}
              >
                Open in Zoom app instead
              </Button>
            )}
          </div>
        )}

        {joining && sigQuery.isSuccess && !sdkError && (
          <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Joining meeting…</p>
          </div>
        )}

        {/* The Zoom SDK renders itself into this div */}
        <div
          ref={containerRef}
          id="meetingSDKElement"
          className="w-full"
          style={{ minHeight: 500, display: sdkError || sigQuery.isError ? "none" : "block" }}
        />
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Sessions page
// =============================================================================
const EMPTY_FORM = { clientUserId: "", title: "", scheduledAt: "", durationMinutes: "45" };

export default function Sessions() {
  const organizationId = useAuthStore((s) => s.user?.organizationId) ?? "";
  const sessions       = useSessions("all");
  const grants         = useAccessGrants();
  const createSession  = useCreateSession();
  const createZoom     = useCreateSessionZoom();
  const zoomStatus     = useZoomStatus();

  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [zoomBusyId, setZoomBusyId]   = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<CoachingSession | null>(null);

  const clientOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const g of grants.data ?? []) {
      if (organizationId && g.organizationId !== organizationId) continue;
      if (g.status === "active") ids.add(g.userId);
    }
    return Array.from(ids);
  }, [grants.data, organizationId]);

  const handleCreate = async () => {
    if (!organizationId) { toast.error("No organization context."); return; }
    if (!form.clientUserId) { toast.error("Pick a client."); return; }
    if (!form.title.trim()) { toast.error("Add a session title."); return; }
    if (!form.scheduledAt) { toast.error("Pick a date and time."); return; }
    try {
      await createSession.mutateAsync({
        organizationId,
        clientUserId: form.clientUserId,
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes) || 45,
      });
      toast.success("Session scheduled.");
      setForm({ ...EMPTY_FORM });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the session.");
    }
  };

  const handleCreateZoom = async (s: CoachingSession) => {
    if (!zoomStatus.data?.connected) {
      toast.error("Connect your Zoom account first — go to Settings → Zoom Integration.");
      return;
    }
    setZoomBusyId(s.id);
    try {
      await createZoom.mutateAsync(s.id);
      toast.success("Zoom meeting created. Click Start Session to launch it.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        toast.error("No Zoom account connected. Go to Settings → Zoom Integration to connect.");
      } else if (err instanceof ApiError && err.status === 502) {
        toast.error("Couldn't reach Zoom. Please try again later.");
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error("Only a coach of this organization can create the meeting.");
      } else {
        toast.error("Could not create the Zoom meeting.");
      }
    } finally {
      setZoomBusyId(null);
    }
  };

  const handleStart = useCallback((s: CoachingSession) => {
    setActiveSession(s);
  }, []);

  const rows = sessions.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Schedule 1:1 coaching sessions and launch them inside Vitalé with Zoom.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {zoomStatus.data && !zoomStatus.data.connected && (
            <a href="/coach/zoom-integration" className="text-xs text-muted-foreground flex items-center gap-1 hover:underline">
              <LinkIcon className="w-3 h-3" /> Connect Zoom
            </a>
          )}
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Session
          </Button>
        </div>
      </div>

      {/* Session list */}
      {sessions.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sessions…
        </div>
      ) : sessions.isError ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <AlertCircle className="w-5 h-5" /> Couldn't load sessions.
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <CalendarClock className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="font-medium">No sessions yet</p>
            <p className="text-sm text-muted-foreground">
              Schedule a session, then create its Zoom meeting to start hosting.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{s.title}</span>
                    <Badge className={`border-0 text-xs capitalize ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatWhen(s.scheduledAt)} · {s.durationMinutes} min · Client …{s.clientUserId.slice(-6)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.zoomMeetingId ? (
                    <Button onClick={() => handleStart(s)}>
                      <Video className="w-4 h-4 mr-2" /> Start Session
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleCreateZoom(s)}
                      disabled={zoomBusyId === s.id}
                    >
                      {zoomBusyId === s.id
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Video className="w-4 h-4 mr-2" />}
                      Create Zoom Meeting
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New session dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              {clientOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clients yet. Share your organization ID so a client can grant access from the app.
                </p>
              ) : (
                <Select value={form.clientUserId} onValueChange={(v) => setForm((f) => ({ ...f, clientUserId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clientOptions.map((id) => (
                      <SelectItem key={id} value={id}>Client …{id.slice(-6)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="1:1 Progress Check-in"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date &amp; time</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createSession.isPending || clientOptions.length === 0}
            >
              {createSession.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Zoom meeting modal */}
      {activeSession && (
        <ZoomMeetingEmbed
          session={activeSession}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}
