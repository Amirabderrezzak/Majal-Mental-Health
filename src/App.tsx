import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Pages
import Index from "./pages/Index.tsx";
import Psychologues from "./pages/Psychologues.tsx";
import Profil from "./pages/Profil.tsx";
import Reservation from "./pages/Reservation.tsx";
import MonEspace from "./pages/MonEspace.tsx";
import Connexion from "./pages/Connexion.tsx";
import Inscription from "./pages/Inscription.tsx";
import MotDePasseOublie from "./pages/MotDePasseOublie.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import EspacePsy from "./pages/EspacePsy";
import PaymentMock from "./pages/PaymentMock.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminRoute from "@/components/AdminRoute";
import AdminLogin from "./pages/AdminLogin.tsx";
// Support & Legal
import FAQ from "./pages/FAQ.tsx";
import Contact from "./pages/Contact.tsx";
import CentreAide from "./pages/CentreAide.tsx";
import Confidentialite from "./pages/Confidentialite.tsx";
import Conditions from "./pages/Conditions.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <Routes>
              {/* ── Public ─────────────────────────────────── */}
              <Route path="/" element={<Index />} />
              <Route path="/psychologues" element={<Psychologues />} />
              <Route path="/profil/:id" element={<Profil />} />
              <Route path="/connexion" element={<Connexion />} />
              <Route path="/inscription" element={<Inscription />} />
              <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* ── Support & Legal ─────────────────────────── */}
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/aide" element={<CentreAide />} />
              <Route path="/confidentialite" element={<Confidentialite />} />
              <Route path="/conditions" element={<Conditions />} />
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* ── Protected: patients ─────────────────────── */}
              <Route
                path="/mon-espace"
                element={
                  <ProtectedRoute requiredRole="patient">
                    <MonEspace />
                  </ProtectedRoute>
                }
              />

              {/* ── Protected: any logged-in user ───────────── */}
              <Route
                path="/reservation/:id"
                element={
                  <ProtectedRoute>
                    <Reservation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/mock"
                element={
                  <ProtectedRoute>
                    <PaymentMock />
                  </ProtectedRoute>
                }
              />

              {/* ── Protected: psychologists only ───────────── */}
              <Route
                path="/espace-psy"
                element={
                  <ProtectedRoute requiredRole="psychologue">
                    <EspacePsy />
                  </ProtectedRoute>
                }
              />

              {/* ── Protected: admin only ────────────────────── */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
