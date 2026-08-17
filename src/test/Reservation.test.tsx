import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Reservation from "../pages/Reservation";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      user_id: "12345678-1234-1234-1234-123456789012",
      full_name: "Dr. Karim Benz",
      specialty: "Psychologue Clinicien",
      price_individual: 3000,
      price_couples: 4500,
      price_adolescents: 2000,
      avatar_url: null,
      approval_status: "approved",
    },
    error: null,
  });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      }),
    },
  };
});

// Mock contexts to avoid context provider issues in test env
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "fr",
    dir: "ltr",
    t: (key: string) => {
      const keys: Record<string, string> = {
        "res.back": "Retour",
        "res.title": "Réserver une séance",
        "res.with": "Avec",
        "res.selectDate": "Sélectionner une date",
        "res.selectTime": "Sélectionner un horaire",
        "res.recap": "Récapitulatif de la séance",
        "res.date": "Date",
        "res.time": "Heure",
        "res.duration": "Durée",
        "res.minutes": "60 minutes",
        "res.price": "Tarif",
        "res.confirm": "Confirmer la réservation",
        "cal.months": "Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre",
        "cal.days": "Di,Lu,Ma,Me,Je,Ve,Sa",
        "nav.home": "Accueil",
        "nav.find": "Trouver un psychologue",
        "nav.space": "Mon espace",
        "nav.langSwitch": "العربية",
        "nav.logout": "Déconnexion",
      };
      return keys[key] || key;
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "patient-123" },
    loading: false,
    session: {},
  }),
}));

describe("Reservation Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to directory when the psychologist ID is invalid", async () => {
    render(
      <MemoryRouter initialEntries={["/reservation/invalid-uuid"]}>
        <Routes>
          <Route path="/reservation/:id" element={<Reservation />} />
          <Route path="/psychologues" element={<div>Directory Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Directory Page/i)).toBeInTheDocument();
    });
  });

  it("should load database psychologist profile dynamically when ID is a UUID", async () => {
    render(
      <MemoryRouter initialEntries={["/reservation/12345678-1234-1234-1234-123456789012"]}>
        <Routes>
          <Route path="/reservation/:id" element={<Reservation />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify loading and transition to profile loaded from mocked Supabase
    await waitFor(() => {
      expect(screen.getAllByText(/Karim Benz/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Psychologue Clinicien/i)).toBeInTheDocument();
  });
});
