import { useAuthStore } from "@/stores/auth-store";
import SuperAdminDashboard from "./dashboard/super-admin-dashboard";
import CoachDashboard from "./dashboard/coach-dashboard";

export default function Dashboard() {
  const { role } = useAuthStore();

  if (role === "admin") return <SuperAdminDashboard />;
  if (role === "coach") return <CoachDashboard />;

  /* team / collab — reuse coach layout scoped to their view */
  return <CoachDashboard />;
}
