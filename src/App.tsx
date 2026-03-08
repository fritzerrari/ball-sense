import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import NewMatch from "./pages/NewMatch";
import MatchReport from "./pages/MatchReport";
import TrackingPage from "./pages/TrackingPage";
import Players from "./pages/Players";
import PlayerProfile from "./pages/PlayerProfile";
import Fields from "./pages/Fields";
import FieldCalibration from "./pages/FieldCalibration";
import SettingsPage from "./pages/Settings";
import Admin from "./pages/Admin";
import Assistant from "./pages/Assistant";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import LegalPage from "./pages/LegalPage";
import InstallGuide from "./pages/InstallGuide";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
              <Route path="/matches/new" element={<ProtectedRoute><NewMatch /></ProtectedRoute>} />
              <Route path="/matches/:id" element={<ProtectedRoute><MatchReport /></ProtectedRoute>} />
              <Route path="/matches/:id/track" element={<TrackingPage />} />
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
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
