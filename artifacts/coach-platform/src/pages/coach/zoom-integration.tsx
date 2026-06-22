import { useEffect, useMemo } from "react";
import { Video, CheckCircle2, XCircle, Loader2, LinkIcon, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useZoomStatus, useZoomConnect, useZoomDisconnect } from "@/lib/zoom";
import { ApiError } from "@/lib/api";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params:       "Zoom didn't return the expected parameters. Please try again.",
  invalid_state:        "The Zoom connection link expired or was tampered with. Please try again.",
  token_exchange_failed:"Zoom couldn't verify the connection. Please try again.",
  store_failed:         "We connected to Zoom but couldn't save your credentials. Please try again.",
  access_denied:        "You cancelled the Zoom authorization. Click Connect to try again.",
};

export default function ZoomIntegration() {
  const status      = useZoomStatus();
  const startOAuth  = useZoomConnect();
  const disconnect  = useZoomDisconnect();

  // Read the query string Zoom (or the callback redirect) sends back.
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const connected  = params.get("connected") === "true";
  const oauthError = params.get("error");

  useEffect(() => {
    if (connected) {
      toast.success("Zoom account connected successfully!");
      // Remove query params from the URL without a page reload.
      window.history.replaceState({}, "", window.location.pathname);
      status.refetch();
    }
    if (oauthError) {
      toast.error(ERROR_MESSAGES[oauthError] ?? `Zoom connection failed: ${oauthError}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Zoom account disconnected.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't disconnect Zoom.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Zoom Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Zoom account so sessions are created under your identity and appear in your
          Zoom calendar. Clients join via the same link from the Vitalé mobile app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Zoom Account</CardTitle>
              <CardDescription>
                {status.isLoading ? "Checking connection…" : status.data?.connected
                  ? "Your Zoom account is connected."
                  : "No Zoom account connected yet."}
              </CardDescription>
            </div>
            {status.data && (
              <Badge
                className={`border-0 ${status.data.connected
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"}`}
              >
                {status.data.connected ? "Connected" : "Not connected"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking status…
            </div>
          ) : status.data?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>
                  Connected as <strong>{status.data.email}</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                New sessions you create will automatically generate Zoom meetings under this account.
                The meeting will appear in your Zoom app and calendar.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Unlink className="w-4 h-4 mr-2" />}
                Disconnect Zoom
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4" />
                <span>No account connected. Connect to create meetings under your identity.</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Meetings appear in your personal Zoom calendar and app</li>
                <li>Clients join directly from the Vitalé mobile app</li>
                <li>You can embed the meeting inside Vitalé without leaving the platform</li>
                <li>You can disconnect and reconnect a different account at any time</li>
              </ul>
              <Button onClick={startOAuth}>
                <LinkIcon className="w-4 h-4 mr-2" />
                Connect Zoom Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            ["1. Connect", "Click Connect and log in with your Zoom account. Vitalé stores your OAuth credentials securely."],
            ["2. Schedule a session", "Go to Sessions and create a new coaching session with a client."],
            ["3. Create the Zoom meeting", "Click Create Zoom Meeting on the session card. The meeting is created in your Zoom account."],
            ["4. Start the session", "Click Start Session — the full Zoom meeting opens inside Vitalé. Your client joins from the mobile app."],
          ].map(([step, desc]) => (
            <div key={step} className="flex gap-3">
              <span className="font-semibold w-28 shrink-0 text-foreground">{step}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
