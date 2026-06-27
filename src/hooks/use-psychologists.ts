import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PsyProfile {
  id: string;            // supabase user_id (UUID)
  staticId?: number;     // kept for backward compatibility if any
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
  video_url: string | null;
  is_available_now: boolean;
  specializations: { category_id: string; subcategory_id: string }[];
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
  video_url: string | null;
  is_available_now: boolean | null;
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
    video_url: row.video_url ?? null,
    is_available_now: row.is_available_now ?? false,
    specializations: [],
    rating: 0,
    reviews: 0,
  };
}

/**
 * Fetches approved psychologist profiles from Supabase.
 */
export function usePsychologists() {
  return useQuery({
    queryKey: ["psychologists"],
    queryFn: async (): Promise<PsyProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, specialty, city, bio, price_per_session, years_experience, language, avatar_url, video_url, is_available_now")
        .eq("user_type", "psychologue")
        .eq("approval_status", "approved")
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data) return [];

      // Fetch psychologist ratings view
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("psychologist_ratings")
        .select("psychologist_id, avg_rating, review_count");

      const ratingsMap = new Map<string, { avg_rating: number; review_count: number }>();
      if (!ratingsError && ratingsData) {
        for (const r of ratingsData) {
          ratingsMap.set(r.psychologist_id, {
            avg_rating: Number(r.avg_rating || 0),
            review_count: Number(r.review_count || 0),
          });
        }
      }

      // Fetch specializations
      const { data: specsData } = await supabase
        .from("psy_specializations")
        .select("psychologist_id, category_id, subcategory_id");

      const specsMap = new Map<string, { category_id: string; subcategory_id: string }[]>();
      if (specsData) {
        for (const s of specsData) {
          const existing = specsMap.get(s.psychologist_id) ?? [];
          existing.push({ category_id: s.category_id, subcategory_id: s.subcategory_id });
          specsMap.set(s.psychologist_id, existing);
        }
      }

      return data.map((row) => {
        const profile = mapProfile(row);
        const ratingInfo = ratingsMap.get(row.user_id);
        if (ratingInfo) {
          profile.rating = ratingInfo.avg_rating;
          profile.reviews = ratingInfo.review_count;
        }
        profile.specializations = specsMap.get(row.user_id) ?? [];
        return profile;
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}
