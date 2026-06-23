import { useEffect, lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { configureApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";

import { useAuthStore } from "./stores/auth-store";
import ProtectedLayout from "./components/layout/ProtectedLayout";

/** Centered full-screen spinner — shown while the persisted session restores. */
function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Auth pages stay eager — they're the unauthenticated entry point, so a fast
// first paint matters and they carry little weight.
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signup";
import ForgotPassword from "./pages/auth/forgot-password";

// Every authenticated page is lazy-loaded: each route ships as its own chunk,
// fetched on first navigation (Suspense renders a spinner meanwhile). This keeps
// the initial bundle small instead of bundling all ~60 pages up front.

// Shared
const Dashboard = lazy(() => import("./pages/dashboard"));
const Settings = lazy(() => import("./pages/settings"));
const Messages = lazy(() => import("./pages/messages"));

// Admin
const Coaches = lazy(() => import("./pages/admin/coaches"));
const Programs = lazy(() => import("./pages/admin/programs"));
const ProgramCreate = lazy(() => import("./pages/admin/program-create"));
const ProgramDetail = lazy(() => import("./pages/admin/program-detail"));
const Users = lazy(() => import("./pages/admin/users"));
const Services = lazy(() => import("./pages/admin/services"));
const ServiceCreate = lazy(() => import("./pages/admin/service-create"));
const ServiceDetail = lazy(() => import("./pages/admin/service-detail"));
const Workshops = lazy(() => import("./pages/admin/workshops"));
const Events = lazy(() => import("./pages/admin/events"));
const EventCreate = lazy(() => import("./pages/coach/event-create"));
const EventDetail = lazy(() => import("./pages/coach/event-detail"));
const Community = lazy(() => import("./pages/admin/community"));
const CommunityChannel = lazy(() => import("./pages/admin/community-channel"));
const Analytics = lazy(() => import("./pages/admin/analytics"));
const AuditLogs = lazy(() => import("./pages/admin/audit-logs"));

// Coach
const MyPrograms = lazy(() => import("./pages/coach/my-programs"));
const DietCharts = lazy(() => import("./pages/coach/diet-charts"));
const DietChartBuilder = lazy(() => import("./pages/coach/diet-chart-builder"));
const DietChartView = lazy(() => import("./pages/coach/diet-chart-view"));
const DietChartTemplates = lazy(() => import("./pages/coach/diet-chart-templates"));
const Recipes = lazy(() => import("./pages/coach/recipes"));
const RecipeCreate = lazy(() => import("./pages/coach/recipe-create"));
const RecipeDetail = lazy(() => import("./pages/coach/recipe-detail"));
const RecipeCollections = lazy(() => import("./pages/coach/recipe-collections"));
const ZoomIntegration = lazy(() => import("./pages/coach/zoom-integration"));
const Resources = lazy(() => import("./pages/coach/resources"));
const MyTeam = lazy(() => import("./pages/coach/my-team"));
const Collaborations = lazy(() => import("./pages/coach/collaborations"));
const CollaborationDetail = lazy(() => import("./pages/coach/collaboration-detail"));
const Clients = lazy(() => import("./pages/coach/clients"));
const ClientDetail = lazy(() => import("./pages/coach/client-detail"));
const Storefront = lazy(() => import("./pages/coach/storefront"));
const Leaderboard = lazy(() => import("./pages/coach/leaderboard"));
const HabitsPage = lazy(() => import("./pages/coach/HabitsPage"));
const BookingsPage = lazy(() => import("./pages/coach/BookingsPage"));
const Sessions = lazy(() => import("./pages/coach/sessions"));
const CoachCommunityPage = lazy(() => import("./pages/coach/CoachCommunityPage"));
const GamificationPage = lazy(() => import("./pages/admin/GamificationPage"));
const NotificationsPage = lazy(() => import("./pages/admin/NotificationsPage"));
const MessagesBroadcast = lazy(() => import("./pages/messages-broadcast"));

// Team
const AssignedPrograms = lazy(() => import("./pages/team/assigned-programs"));

// Collab
const SharedPrograms = lazy(() => import("./pages/collab/shared-programs"));

// Point the shared transport at the API base once, at module load.
configureApi();

function ProtectedRoute({ path, component: Component }: { path: string; component: ComponentType }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state.hydrated);

  return (
    <Route path={path}>
      {() => {
        // Wait for the persisted Supabase session to restore before deciding —
        // otherwise a page refresh bounces an authenticated user to /login.
        if (!hydrated) return <FullScreenSpinner />;
        if (!isAuthenticated) return <Redirect to="/login" />;
        return (
          <ProtectedLayout>
            <Component />
          </ProtectedLayout>
        );
      }}
    </Route>
  );
}

/** Root path: send authenticated users straight to the dashboard, others to login. */
function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state.hydrated);
  if (!hydrated) return <FullScreenSpinner />;
  return <Redirect to={isAuthenticated ? "/admin/dashboard" : "/login"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Shared */}
      <ProtectedRoute path="/admin/dashboard" component={Dashboard} />
      <ProtectedRoute path="/admin/settings" component={Settings} />
      <ProtectedRoute path="/admin/messages" component={Messages} />

      {/* Admin */}
      <ProtectedRoute path="/admin/coaches" component={Coaches} />
      <ProtectedRoute path="/admin/programs/new" component={ProgramCreate} />
      <ProtectedRoute path="/admin/programs/:id/edit" component={ProgramCreate} />
      <ProtectedRoute path="/admin/programs/:id" component={ProgramDetail} />
      <ProtectedRoute path="/admin/programs" component={Programs} />
      <ProtectedRoute path="/admin/users" component={Users} />
      <ProtectedRoute path="/admin/services" component={Services} />
      <ProtectedRoute path="/admin/services/new" component={ServiceCreate} />
      <ProtectedRoute path="/admin/services/:id/edit" component={ServiceCreate} />
      <ProtectedRoute path="/admin/services/:id" component={ServiceDetail} />
      <ProtectedRoute path="/admin/workshops" component={Workshops} />
      <ProtectedRoute path="/admin/events/new" component={EventCreate} />
      <ProtectedRoute path="/admin/events/:id" component={EventDetail} />
      <ProtectedRoute path="/admin/events" component={Events} />
      <ProtectedRoute path="/admin/community/:channelId" component={CommunityChannel} />
      <ProtectedRoute path="/admin/community" component={Community} />
      <ProtectedRoute path="/admin/analytics" component={Analytics} />
      <ProtectedRoute path="/admin/gamification" component={GamificationPage} />
      <ProtectedRoute path="/admin/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/admin/audit-logs" component={AuditLogs} />

      {/* Coach */}
      <ProtectedRoute path="/admin/my-programs" component={MyPrograms} />
      <ProtectedRoute path="/admin/diet-charts/new" component={DietChartBuilder} />
      <ProtectedRoute path="/admin/diet-charts/templates" component={DietChartTemplates} />
      <ProtectedRoute path="/admin/diet-charts/:id/edit" component={DietChartBuilder} />
      <ProtectedRoute path="/admin/diet-charts/:id" component={DietChartView} />
      <ProtectedRoute path="/admin/diet-charts" component={DietCharts} />
      <ProtectedRoute path="/admin/recipes/new" component={RecipeCreate} />
      <ProtectedRoute path="/admin/recipes/collections" component={RecipeCollections} />
      <ProtectedRoute path="/admin/recipes/:id/edit" component={RecipeCreate} />
      <ProtectedRoute path="/admin/recipes/:id" component={RecipeDetail} />
      <ProtectedRoute path="/admin/recipes" component={Recipes} />
      <ProtectedRoute path="/admin/zoom" component={ZoomIntegration} />
      <ProtectedRoute path="/admin/my-team" component={MyTeam} />
      <ProtectedRoute path="/admin/collaborations" component={Collaborations} />
      <ProtectedRoute path="/admin/clients/:id" component={ClientDetail} />
      <ProtectedRoute path="/admin/clients" component={Clients} />
      <ProtectedRoute path="/admin/storefront" component={Storefront} />
      <ProtectedRoute path="/admin/leaderboard" component={Leaderboard} />
      <ProtectedRoute path="/admin/habits" component={HabitsPage} />
      <ProtectedRoute path="/admin/sessions" component={Sessions} />
      <ProtectedRoute path="/admin/bookings" component={BookingsPage} />
      <ProtectedRoute path="/admin/coach-community" component={CoachCommunityPage} />
      <ProtectedRoute path="/admin/resources" component={Resources} />

      {/* Team */}
      <ProtectedRoute path="/admin/assigned-programs" component={AssignedPrograms} />

      {/* Collab */}
      <ProtectedRoute path="/admin/shared-programs" component={SharedPrograms} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Hydrate any persisted Supabase session on load, and keep the access token +
  // store in sync on sign-in / token-refresh / sign-out.
  useEffect(() => {
    void useAuthStore.getState().hydrate();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void useAuthStore.getState().applySession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Suspense fallback={<FullScreenSpinner />}>
              <Router />
            </Suspense>
          </WouterRouter>
        </ErrorBoundary>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
