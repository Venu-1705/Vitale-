import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { configureApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { useAuthStore } from "./stores/auth-store";
import ProtectedLayout from "./components/layout/ProtectedLayout";

// Auth
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signup";
import ForgotPassword from "./pages/auth/forgot-password";

// Shared
import Dashboard from "./pages/dashboard";
import Settings from "./pages/settings";
import Messages from "./pages/messages";

// Admin
import Coaches from "./pages/admin/coaches";
import Programs from "./pages/admin/programs";
import ProgramCreate from "./pages/admin/program-create";
import ProgramDetail from "./pages/admin/program-detail";
import Users from "./pages/admin/users";
import Services from "./pages/admin/services";
import ServiceCreate from "./pages/admin/service-create";
import ServiceDetail from "./pages/admin/service-detail";
import Workshops from "./pages/admin/workshops";
import Events from "./pages/admin/events";
import EventCreate from "./pages/coach/event-create";
import EventDetail from "./pages/coach/event-detail";
import Community from "./pages/admin/community";
import CommunityChannel from "./pages/admin/community-channel";
import Analytics from "./pages/admin/analytics";
import AuditLogs from "./pages/admin/audit-logs";

// Coach
import MyPrograms from "./pages/coach/my-programs";
import DietCharts from "./pages/coach/diet-charts";
import DietChartBuilder from "./pages/coach/diet-chart-builder";
import DietChartView from "./pages/coach/diet-chart-view";
import DietChartTemplates from "./pages/coach/diet-chart-templates";
import Recipes from "./pages/coach/recipes";
import RecipeCreate from "./pages/coach/recipe-create";
import RecipeDetail from "./pages/coach/recipe-detail";
import RecipeCollections from "./pages/coach/recipe-collections";
import ZoomIntegration from "./pages/coach/zoom-integration";
import Resources from "./pages/coach/resources";
import MyTeam from "./pages/coach/my-team";
import Collaborations from "./pages/coach/collaborations";
import CollaborationDetail from "./pages/coach/collaboration-detail";
import Clients from "./pages/coach/clients";
import ClientDetail from "./pages/coach/client-detail";
import Storefront from "./pages/coach/storefront";
import Leaderboard from "./pages/coach/leaderboard";
import HabitsPage from "./pages/coach/HabitsPage";
import BookingsPage from "./pages/coach/BookingsPage";
import Sessions from "./pages/coach/sessions";
import CoachCommunityPage from "./pages/coach/CoachCommunityPage";
import GamificationPage from "./pages/admin/GamificationPage";
import NotificationsPage from "./pages/admin/NotificationsPage";
import MessagesBroadcast from "./pages/messages-broadcast";

// Team
import AssignedPrograms from "./pages/team/assigned-programs";

// Collab
import SharedPrograms from "./pages/collab/shared-programs";

// Point the shared transport at the API base once, at module load.
configureApi();

function ProtectedRoute({ path, component: Component }: { path: string; component: any }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state.hydrated);

  return (
    <Route path={path}>
      {() => {
        // Wait for the persisted Supabase session to restore before deciding —
        // otherwise a page refresh bounces an authenticated user to /login.
        if (!hydrated) return null;
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

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => <Redirect to="/login" />}
      </Route>
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
