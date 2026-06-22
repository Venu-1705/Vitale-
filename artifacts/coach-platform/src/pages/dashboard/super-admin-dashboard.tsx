import { useState } from "react";
import { useLocation } from "wouter";
import {
  Users, BookOpen, UserCircle, IndianRupee, Handshake,
  ChevronDown, Download, Plus, BarChart3, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { usePrograms } from "@/lib/programs";
import { useOrgMembers } from "@/lib/organizations";
import { useMerchantRevenue } from "@/lib/storefront";
import { useCollaborationAgreements } from "@/lib/collaboration";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── DATE RANGE ────────────────────────────────────────────────────── */
const DATE_OPTIONS = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "Last 3 Months", "Custom Range"];

function DateRangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-medium bg-white border border-border px-3 py-2 rounded-xl hover:border-primary/50 transition-all shadow-sm"
      >
        {value}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            {DATE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                  opt === value && "font-semibold text-primary bg-primary/5"
                )}
              >{opt}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── STAT CARD ─────────────────────────────────────────────────────── */
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
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ── COMPONENT ─────────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const [dateRange, setDateRange] = useState("This Month");
  const [, navigate] = useLocation();

  const { user } = useAuthStore();
  const organizationId = user?.organizationId;

  const programs = usePrograms(organizationId ? { organizationId } : {});
  const members = useOrgMembers(organizationId);
  const revenue = useMerchantRevenue(organizationId);
  const agreements = useCollaborationAgreements();

  const programCount = programs.data?.filter(p => p.status === "published").length;
  const memberCount = members.data?.length;
  const revenuePaise = revenue.data?.revenue.revenuePaise;
  const revenueStr = revenuePaise != null
    ? `₹${(revenuePaise / 100).toLocaleString("en-IN")}`
    : undefined;
  const collabCount = agreements.data?.filter(a => a.status === "active").length;

  return (
    <div className="space-y-6 pb-10">

      {/* ── TOP: Date range + quick actions ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-sm"
            onClick={() => navigate(BASE + "/admin/coaches")}
          >
            <Plus className="w-4 h-4" /> Add Coach
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shadow-sm"
            onClick={() => navigate(BASE + "/admin/programs/new")}
          >
            <Plus className="w-4 h-4" /> Create Program
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => toast.info("Report export isn't available yet")}
          >
            <Download className="w-4 h-4" /> Generate Report
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Team Members"
          value={memberCount != null ? String(memberCount) : "—"}
          sub="active staff in org"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          loading={members.isLoading}
          onClick={() => navigate(BASE + "/admin/coaches")}
        />
        <StatCard
          label="Published Programs"
          value={programCount != null ? String(programCount) : "—"}
          sub={`${programs.data?.length ?? 0} total (incl. drafts)`}
          icon={BookOpen}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          loading={programs.isLoading}
          onClick={() => navigate(BASE + "/admin/programs")}
        />
        <StatCard
          label="Total Clients"
          value="—"
          sub="no ambient client list (DPDP)"
          icon={UserCircle}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Revenue (confirmed)"
          value={revenueStr ?? "—"}
          sub="confirmed + fulfilled orders"
          icon={IndianRupee}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={revenue.isLoading}
        />
        <StatCard
          label="Active Collaborations"
          value={collabCount != null ? String(collabCount) : "—"}
          sub="live agreements"
          icon={Handshake}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          loading={agreements.isLoading}
        />
      </div>

      {/* ── ANALYTICS PLACEHOLDER ───────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Analytics
          </CardTitle>
          <CardDescription className="text-xs">
            Aggregation APIs (growth trends, revenue splits, programme funnels, cohort analysis) aren't in the current phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
            <BarChart3 className="w-12 h-12 opacity-20" />
            <div>
              <p className="font-medium text-sm">Analytics dashboards aren't available yet</p>
              <p className="text-xs mt-1 max-w-sm">
                User growth, revenue by category, programme enrollment breakdowns, and activity logs
                will appear here once the analytics backend is built.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => navigate(BASE + "/admin/programs")}>
                View Programs
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(BASE + "/admin/coaches")}>
                View Team
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
