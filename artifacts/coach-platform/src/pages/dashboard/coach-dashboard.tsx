import { useLocation } from "wouter";
import {
  BookOpen, Users, UtensilsCrossed, MessageCircle, Handshake,
  Plus, BarChart3, CalendarClock, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { usePrograms } from "@/lib/programs";
import { useDietCharts } from "@/lib/nutrition";
import { useUnreadCount } from "@/lib/notifications";
import { useCollaborationAgreements } from "@/lib/collaboration";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor, onClick, loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <Card
      className={cn("shadow-sm transition-all", onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CoachDashboard() {
  const { user } = useAuthStore();
  const [, navigate] = useLocation();
  const firstName = user?.name?.split(" ")[0] ?? "Coach";
  const organizationId = user?.organizationId;

  const programs = usePrograms(organizationId ? { organizationId } : {});
  const dietCharts = useDietCharts(organizationId ? { organizationId } : {});
  const unreadCount = useUnreadCount();
  const agreements = useCollaborationAgreements();

  const programCount = programs.data?.length;
  const activeCharts = dietCharts.data?.filter(c => c.status === "active").length;
  const unread = unreadCount.data;
  const collabCount = agreements.data?.filter(a => a.status === "active").length;

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6 pb-10">

      {/* ── GREETING + QUICK ACTIONS ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {greeting()}, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your overview for today, {todayStr}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-sm"
            onClick={() => navigate(BASE + "/admin/programs/new")}
          >
            <Plus className="w-4 h-4" /> New Program
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shadow-sm"
            onClick={() => navigate(BASE + "/admin/diet-charts")}
          >
            <Plus className="w-4 h-4" /> Diet Chart
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground relative"
            onClick={() => navigate(BASE + "/admin/messages")}
          >
            <MessageCircle className="w-4 h-4" /> View Messages
            {unread != null && unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="My Programs"
          value={programCount != null ? String(programCount) : "—"}
          sub="total (all statuses)"
          icon={BookOpen}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          loading={programs.isLoading}
          onClick={() => navigate(BASE + "/admin/programs")}
        />
        <StatCard
          label="Active Clients"
          value="—"
          sub="no ambient client list (DPDP)"
          icon={Users}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Active Diet Charts"
          value={activeCharts != null ? String(activeCharts) : "—"}
          sub={`${dietCharts.data?.length ?? 0} total`}
          icon={UtensilsCrossed}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          loading={dietCharts.isLoading}
          onClick={() => navigate(BASE + "/admin/diet-charts")}
        />
        <StatCard
          label="Unread Messages"
          value={unread != null ? String(unread) : "—"}
          sub="tap to view inbox"
          icon={MessageCircle}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          loading={unreadCount.isLoading}
          onClick={() => navigate(BASE + "/admin/messages")}
        />
        <StatCard
          label="Active Collaborations"
          value={collabCount != null ? String(collabCount) : "—"}
          sub="live agreements"
          icon={Handshake}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          loading={agreements.isLoading}
          onClick={() => navigate(BASE + "/admin/collaborations")}
        />
      </div>

      {/* ── TODAY'S SCHEDULE (no scheduling backend) ─────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            Today's Schedule
          </CardTitle>
          <CardDescription className="text-xs">
            Session scheduling isn't available yet — bookings, slots, and live session management need a scheduling backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
            <CalendarClock className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No sessions scheduled</p>
            <p className="text-xs max-w-xs">
              Once a booking/scheduling domain is available, today's appointments will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── ANALYTICS PLACEHOLDER ───────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Analytics
          </CardTitle>
          <CardDescription className="text-xs">
            Enrollment trends, completion rates, client adherence, and revenue stats need aggregation APIs that aren't in the current phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
            <BarChart3 className="w-10 h-10 opacity-20" />
            <div>
              <p className="text-sm font-medium">Analytics aren't available yet</p>
              <p className="text-xs mt-1 max-w-sm">
                Enrollment trends, completion rates, client activity, and quick stats will appear here once the analytics backend is built.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => navigate(BASE + "/admin/programs")}>
                View Programs
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(BASE + "/admin/diet-charts")}>
                View Diet Charts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
