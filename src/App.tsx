import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AdminRoute from "@/components/AdminRoute";
import { Analytics } from "@vercel/analytics/react";

// Pages (code-split via React.lazy)
const Index = lazy(() => import("./pages/Index.tsx"));
const Psychologues = lazy(() => import("./pages/Psychologues.tsx"));
const Profil = lazy(() => import("./pages/Profil.tsx"));
const Reservation = lazy(() => import("./pages/Reservation.tsx"));
const MonEspace = lazy(() => import("./pages/MonEspace.tsx"));
const Connexion = lazy(() => import("./pages/Connexion.tsx"));
const Inscription = lazy(() => import("./pages/Inscription.tsx"));
const MotDePasseOublie = lazy(() => import("./pages/MotDePasseOublie.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const EspacePsy = lazy(() => import("./pages/EspacePsy"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn.tsx"));
const PaymentMock = lazy(() => import("./pages/PaymentMock.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
// Support & Legal
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const CentreAide = lazy(() => import("./pages/CentreAide.tsx"));
const Confidentialite = lazy(() => import("./pages/Confidentialite.tsx"));
const Conditions = lazy(() => import("./pages/Conditions.tsx"));

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
    }}
    role="status"
    aria-label="Chargement"
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: "4px solid #e2e8f0",
        borderTopColor: "#2A7C6F",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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
          <Analytics mode="auto" />
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
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
                  path="/payment/return"
                  element={
                    <ProtectedRoute>
                      <PaymentReturn />
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
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
