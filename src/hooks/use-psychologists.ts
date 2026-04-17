import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { doctors, type Doctor } from "@/data/doctors";

export interface PsyProfile {
  id: string;            // supabase user_id (UUID)
  staticId?: number;     // fallback for static data routing
  name: string;
  specialty: string;
  city: string | null;
  bio: string | null;
  price: number;
  exp: number;
  langs: string[];
  dispo: string;
  emoji: string;
  avatar_url: string | null;
  // These come from the psychologist_ratings view
  rating: number;
  reviews: number;
}

/** Map a Supabase profile row → PsyProfile */
function mapProfile(row: {
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  city: string | null;
  bio: string | null;
  price_per_session: number | null;
  years_experience: number | null;
  language: string | null;
  avatar_url: string | null;
}): PsyProfile {
  return {
    id: row.user_id,
    name: row.full_name ?? "Psychologue",
    specialty: row.specialty ?? "Psychologie clinique",
    city: row.city,
    bio: row.bio,
    price: row.price_per_session ?? 3000,
    exp: row.years_experience ?? 0,
    langs: row.language ? [row.language] : ["Français"],
    dispo: "Disponible cette semaine",
    emoji: "🧑‍⚕️",
    avatar_url: row.avatar_url,
    rating: 0,
    reviews: 0,
  };
}

/**
 * Fetches psychologist profiles from Supabase.
 * Falls back to static mock data if the DB returns 0 results
 * (useful during development before any psy accounts are registered).
 */
export function usePsychologists() {
  return useQuery({
    queryKey: ["psychologists"],
    queryFn: async (): Promise<PsyProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, specialty, city, bio, price_per_session, years_experience, language, avatar_url")
        .eq("user_type", "psychologue")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // If no real psychologists are registered yet, show the static demo data
      if (!data || data.length === 0) {
        return doctors.map(
          (d): PsyProfile => ({
            id: `static-${d.id}`,
            staticId: d.id,
            name: d.name,
            specialty: d.specialty,
            city: null,
            bio: null,
            price: d.price,
            exp: d.exp,
            langs: d.langs,
            dispo: d.dispo,
            emoji: d.emoji,
            avatar_url: null,
            rating: d.rating,
            reviews: d.reviews,
          })
        );
      }

      return data.map(mapProfile);
    },
    staleTime: 1000 * 60 * 5,
  });
}
