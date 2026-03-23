import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import { lazy, Suspense } from "react";

// Eagerly loaded (landing + auth)
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Matches = lazy(() => import("./pages/Matches"));
const NewMatch = lazy(() => import("./pages/NewMatch"));
const MatchReport = lazy(() => import("./pages/MatchReport"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const CameraTrackingPage = lazy(() => import("./pages/CameraTrackingPage"));
const Players = lazy(() => import("./pages/Players"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Fields = lazy(() => import("./pages/Fields"));
const FieldCalibration = lazy(() => import("./pages/FieldCalibration"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const InstallGuide = lazy(() => import("./pages/InstallGuide"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min
      gcTime: 10 * 60 * 1000, // 10 min (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
                <Route path="/matches/new" element={<ProtectedRoute><NewMatch /></ProtectedRoute>} />
                <Route path="/matches/:id" element={<ProtectedRoute><MatchReport /></ProtectedRoute>} />
                <Route path="/matches/:id/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
                <Route path="/camera/:id/track" element={<CameraTrackingPage />} />
                <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
                <Route path="/players/:id" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
                <Route path="/fields" element={<ProtectedRoute><Fields /></ProtectedRoute>} />
                <Route path="/fields/:id/calibrate" element={<ProtectedRoute><FieldCalibration /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/install" element={<InstallGuide />} />
                <Route path="/legal/:slug" element={<LegalPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
