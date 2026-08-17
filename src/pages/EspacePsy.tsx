import { useState, useEffect } from "react";
import { Menu, X, Bell, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import PsySidebar, { type Page } from "@/components/pages/PsySidebar";
import PsyTopBar from "@/components/pages/PsyTopBar";
import PsyDashboard from "@/components/pages/PsyDashboard";
import PsySessions from "@/components/pages/PsySessions";
import PsyPatients from "@/components/pages/PsyPatients";
import PsyMessages from "@/components/pages/PsyMessages";
import PsyEarnings from "@/components/pages/PsyEarnings";
import PsyProfileEditor from "@/components/pages/PsyProfileEditor";
import PsySettingsPage from "@/components/pages/PsySettingsPage";
import ContentCreatorPage from "@/components/pages/ContentCreatorPage";

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done" | "no-show";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

export default function EspacePsy() {
  const { user, signOut } = useAuth();
  const { t, lang, dir } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { isSupported: pushSupported, preferenceEnabled: pushSubscribed, loading: pushLoading, togglePreference: pushToggle } = usePushNotifications(user?.id ?? null);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [startingCall, setStartingCall] = useState<string | null>(null);
  const [isAvailableNow, setIsAvailableNow] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [psySpecs, setPsySpecs] = useState<{ category_id: string; subcategory_id: string }[]>([]);
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [respondingToRequest, setRespondingToRequest] = useState<string | null>(null);
  const [immediateRequests, setImmediateRequests] = useState<{
    id: string;
    patient_id: string;
    status: string;
    created_at: string;
  }[]>([]);

  const handleStartCall = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Time-based gate
    const now = new Date();
    const sessionStart = new Date(booking.booked_at);
    const durationMs = (booking.duration_minutes || 60) * 60 * 1000;
    const sessionEnd = new Date(sessionStart.getTime() + durationMs);
    const earlyBuffer = 15 * 60 * 1000;

    if (now < new Date(sessionStart.getTime() - earlyBuffer)) {
      toast.info("La session n'est pas encore ouverte. Vous pourrez démarrer l'appel 15 minutes avant l'heure prévue.");
      return;
    }
    if (now > sessionEnd) {
      toast.info("Cette session est terminée.");
      return;
    }

    if (booking.video_room_url) {
      window.open(booking.video_room_url, "_blank");
      return;
    }

    setStartingCall(bookingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/calls/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ booking_id: bookingId })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, video_room_url: data.url } : b));
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error || "Erreur lors de la création du salon.");
      }
    } catch (err: any) {
      console.error("Start call error:", err);
      toast.error(err.message || "Impossible de lancer le salon vidéo.");
    } finally {
      setStartingCall(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅ Mot de passe mis à jour avec succès !");
      setNewPassword("");
    }
  };
  // Clinic and Patient Notes configurations
  const [clinicSettings, setClinicSettings] = useState({
    vacationMode: false,
    autoConfirm: false,
    acceptingNew: true,
    startHour: "08:00",
    endHour: "18:00",
    bufferMinutes: 15,
    workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
  });

  const [notificationPreferences, setNotificationPreferences] = useState({
    newBookings: true,
    reminders: true,
    messages: false,
    payments: true,
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [selectedPatientInitials, setSelectedPatientInitials] = useState<string>("");
  const [selectedPatientSessions, setSelectedPatientSessions] = useState<number>(0);
  const [selectedPatientLastSeen, setSelectedPatientLastSeen] = useState<string>("");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");

  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  // Load profile data (availability + video + clinic settings + notification prefs)
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_available_now, video_url, clinic_settings, notification_preferences")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setIsAvailableNow(data.is_available_now ?? false);
        if (data.video_url) {
          setVideoUrl(data.video_url);
          setVideoPreviewUrl(data.video_url);
        }
        if (data.clinic_settings) {
          setClinicSettings(prev => ({ ...prev, ...data.clinic_settings }));
        }
        if (data.notification_preferences) {
          setNotificationPreferences(prev => ({ ...prev, ...data.notification_preferences }));
        }
      }
    };
    loadProfile();
  }, [user]);

  // Persist availability toggle
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_available_now: isAvailableNow })
        .eq("user_id", user.id);
      if (error) {
        console.error("Failed to update availability:", error);
        toast.error("Erreur lors de la mise à jour. Veuillez exécuter la migration SQL d'abord.");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [isAvailableNow, user]);

  const handleSaveVideo = async (file: File) => {
    if (!user) return;

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez MP4, WebM ou OGG.");
      return;
    }

    // Validate duration (max 59 seconds)
    setUploadingVideo(true);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.onerror = () => reject(new Error("Impossible de lire le fichier vidéo."));
        video.src = URL.createObjectURL(file);
      });

      if (duration > 59) {
        setUploadingVideo(false);
        toast.error(`Vidéo trop longue (${Math.round(duration)}s). Maximum autorisé : 59 secondes.`);
        return;
      }

      // Upload to Supabase Storage
      const filePath = `${user.id}/presentation-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("presentation_videos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("presentation_videos")
        .getPublicUrl(filePath);

      // Save to profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ video_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setVideoUrl(publicUrl);
      setVideoPreviewUrl(publicUrl);
      toast.success("✅ Vidéo enregistrée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!user || !videoPreviewUrl) return;
    // Try to delete from storage
    try {
      const urlParts = videoPreviewUrl.split("/");
      const storagePath = urlParts.slice(urlParts.indexOf("presentation_videos") + 1).join("/");
      if (storagePath) {
        await supabase.storage.from("presentation_videos").remove([storagePath]);
      }
    } catch (e) { /* ignore */ }
    const { error } = await supabase
      .from("profiles")
      .update({ video_url: null })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erreur lors de la suppression.");
    } else {
      setVideoUrl("");
      setVideoPreviewUrl(null);
      toast.success("✅ Vidéo supprimée.");
    }
  };

  // Load specializations
  useEffect(() => {
    if (!user) return;
    const loadSpecs = async () => {
      try {
        const { data } = await supabase
          .from("psy_specializations")
          .select("category_id, subcategory_id")
          .eq("psychologist_id", user.id);
        if (data) setPsySpecs(data);
      } catch (e) {
        // Table may not exist yet — migration pending
      }
    };
    loadSpecs();
  }, [user]);

  // Load and subscribe to incoming immediate session requests
  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadRequests = async () => {
      try {
        const { data } = await supabase
          .from("immediate_session_requests")
          .select("id, patient_id, status, created_at")
          .eq("psychologist_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (data) setImmediateRequests(data);

        channel = supabase
          .channel("immediate-requests")
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "immediate_session_requests",
            filter: `psychologist_id=eq.${user.id}`,
          }, (payload) => {
            const req = payload.new;
            setImmediateRequests((prev) => [{ id: req.id, patient_id: req.patient_id, status: req.status, created_at: req.created_at }, ...prev]);
            toast.info("Nouvelle demande de session immédiate !");
          })
          .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "immediate_session_requests",
            filter: `psychologist_id=eq.${user.id}`,
          }, (payload) => {
            const req = payload.new;
            setImmediateRequests((prev) => prev.filter((r) => r.id !== req.id || req.status === "pending"));
          })
          .subscribe();
      } catch (e) {
        // Table may not exist yet — migration pending
      }
    };
    loadRequests();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const handleRequestResponse = async (requestId: string, accept: boolean) => {
    setRespondingToRequest(requestId);
    if (accept) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/calls/create-instant-room", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            psychologist_id: user?.id,
            request_id: requestId,
          }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setImmediateRequests((prev) => prev.filter((r) => r.id !== requestId));
          toast.success("Session ouverte !");
          window.open(data.url, "_blank");
        } else {
          toast.error(data.error || "Erreur lors de la création du salon.");
        }
      } catch (err: any) {
        console.error("[Video] Accept error:", err);
        toast.error(err.message || "Impossible de créer la session.");
      }
    } else {
      try {
        const { data, error } = await supabase
          .from("immediate_session_requests")
          .update({
            status: "declined",
            responded_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select();
        if (error) {
          toast.error("Erreur lors du refus: " + error.message);
        } else {
          setImmediateRequests((prev) => prev.filter((r) => r.id !== requestId));
          toast.success("Demande refusée.");
        }
      } catch (err: any) {
        console.error("[Video] Decline error:", err);
        toast.error("Erreur de connexion: " + (err.message || err));
      }
    }
    setRespondingToRequest(null);
  };

  const toggleSpec = async (categoryId: string, subcategoryId: string) => {
    if (!user) return;
    const exists = psySpecs.some(
      (s) => s.category_id === categoryId && s.subcategory_id === subcategoryId
    );
    setSavingSpecs(true);
    try {
      if (exists) {
        const { error } = await supabase
          .from("psy_specializations")
          .delete()
          .eq("psychologist_id", user.id)
          .eq("category_id", categoryId)
          .eq("subcategory_id", subcategoryId);
        if (!error) {
          setPsySpecs((prev) => prev.filter(
            (s) => !(s.category_id === categoryId && s.subcategory_id === subcategoryId)
          ));
        }
      } else {
        const { error } = await supabase
          .from("psy_specializations")
          .insert({
            psychologist_id: user.id,
            category_id: categoryId,
            subcategory_id: subcategoryId,
          });
        if (!error) {
          setPsySpecs((prev) => [...prev, { category_id: categoryId, subcategory_id: subcategoryId }]);
        }
      }
    } catch (e) {
      toast.error("Veuillez exécuter la migration SQL des spécialisations.");
    }
    setSavingSpecs(false);
  };

  const updateClinicSetting = (key: string, value: any) => {
    const updated = { ...clinicSettings, [key]: value };
    setClinicSettings(updated);
    if (!user) return;
    setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ clinic_settings: updated })
        .eq("user_id", user.id);
      if (error) {
        console.error("Failed to update clinic settings:", error);
        toast.error("Erreur lors de la mise à jour. Veuillez exécuter la migration SQL d'abord.");
      }
    }, 500);
  };

  const updateNotificationPreference = (key: string, value: boolean) => {
    const updated = { ...notificationPreferences, [key]: value };
    setNotificationPreferences(updated);
    if (!user) return;
    setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: updated })
        .eq("user_id", user.id);
      if (error) {
        console.error("Failed to update notification preferences:", error);
        toast.error("Erreur lors de la mise à jour. Veuillez exécuter la migration SQL d'abord.");
      }
    }, 500);
  };

  useEffect(() => {
    if (!user || !selectedPatientId) {
      setClinicalNotes("");
      return;
    }
    // Load notes from Supabase
    const loadNotes = async () => {
      const { data } = await supabase
        .from("clinical_notes")
        .select("notes")
        .eq("psychologist_id", user.id)
        .eq("patient_id", selectedPatientId)
        .maybeSingle();
      setClinicalNotes(data?.notes || "");
    };
    loadNotes();
  }, [user, selectedPatientId]);

  const saveClinicalNotes = async () => {
    if (!user || !selectedPatientId) return;
    const { error } = await supabase
      .from("clinical_notes")
      .upsert(
        {
          psychologist_id: user.id,
          patient_id: selectedPatientId,
          notes: clinicalNotes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "psychologist_id,patient_id" }
      );
    if (error) {
      console.error("Error saving clinical notes:", error);
      toast.error("Erreur lors de la sauvegarde des notes.");
    } else {
      toast.success(t("psy.patients.notes.success"));
    }
  };

  const [approvalStatus, setApprovalStatus] = useState<string>("approved");

  // Live Bookings State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string>("");

  // Profile form state
  const BIO_MAX_LENGTH = 1000;
  const [profileData, setProfileData] = useState({
    full_name: "",
    specialty: "",
    bio: "",
    city: "",
    price_per_session: 3000,
    price_individual: null as number | null,
    price_couples: null as number | null,
    price_adolescents: null as number | null,
    years_experience: 0,
    phone: "",
    avatar_url: "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfileData((p) => ({ ...p, avatar_url: publicUrl }));
      toast.success("✅ Photo de profil mise à jour !");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err.message || "Erreur lors de l'upload de l'avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Fetch real profile data
  useEffect(() => {
    if (!user) return;
      supabase
        .from("profiles")
        .select("full_name, specialty, bio, city, price_per_session, price_individual, price_couples, price_adolescents, years_experience, phone, approval_status, avatar_url")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfileData({
              full_name: data.full_name ?? "",
              specialty: data.specialty ?? "",
              bio: data.bio ?? "",
              city: data.city ?? "",
              price_per_session: data.price_per_session ?? 3000,
              price_individual: data.price_individual ?? null,
              price_couples: data.price_couples ?? null,
              price_adolescents: data.price_adolescents ?? null,
              years_experience: data.years_experience ?? 0,
              phone: data.phone ?? "",
              avatar_url: data.avatar_url ?? "",
            });
          if (data.approval_status) {
            setApprovalStatus(data.approval_status);
          }
        }
      });
  }, [user]);

  // Fetch real bookings
  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      setBookingsLoading(true);
      const { data: bData } = await (supabase as any)
        .from("bookings")
        .select("id, booked_at, status, duration_minutes, patient_id, price, video_room_url")
        .eq("psychologist_id", user.id)
        .order("booked_at", { ascending: true });
        
      if (bData && bData.length > 0) {
        const patientIds = [...new Set(bData.map((b: any) => b.patient_id as string))] as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", patientIds);
          
        const mapped = bData.map((b) => {
          const profile = profiles?.find((p) => p.user_id === b.patient_id);
          return {
            ...b,
            patient_name: profile?.full_name || "Patient",
            patient_avatar: profile?.avatar_url || undefined,
          } as Booking;
        });
        setBookings(mapped);
      }
      setBookingsLoading(false);
    };
    fetchBookings();

    const bookingsChannel = supabase
      .channel(`public:bookings:psy:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      bookingsChannel.unsubscribe();
    };
  }, [user]);

  // ── Derived real-time stats from bookings ──────────────────────────────────
  const now = new Date();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingBookings = bookings.filter(b => {
    const isUpcomingOrActiveStatus = b.status === "pending" || b.status === "confirmed";
    const sessionEndTime = new Date(new Date(b.booked_at).getTime() + b.duration_minutes * 60 * 1000);
    return isUpcomingOrActiveStatus && sessionEndTime >= now;
  });
  const totalUniquePatients = new Set(bookings.map(b => b.patient_id)).size;
  const sessionsThisMonth = bookings.filter(b => b.booked_at >= monthStart).length;
  const earningsThisMonth = bookings
    .filter(b => (b.status === "confirmed" || b.status === "done") && b.booked_at >= monthStart)
    .reduce((sum, b) => sum + (b.price || 0), 0);
  const pendingPayments = bookings
    .filter(b => b.status === "pending")
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const realWeeklyEarnings = dayLabels.map((day, i) => ({
    day,
    amount: bookings
      .filter(b => {
        const d = new Date(b.booked_at);
        return d.getDay() === i && b.booked_at >= weekAgo &&
          (b.status === "confirmed" || b.status === "done");
      })
      .reduce((sum, b) => sum + (b.price || 0), 0),
  }));
  const maxEarning = Math.max(...realWeeklyEarnings.map(e => e.amount), 0);

  const patientMap = new Map<string, { name: string; sessions: number; lastSeen: string }>();
  bookings.forEach(b => {
    const ex = patientMap.get(b.patient_id);
    if (!ex) {
      patientMap.set(b.patient_id, { name: b.patient_name || "Patient", sessions: 1, lastSeen: b.booked_at });
    } else {
      ex.sessions++;
      if (b.booked_at > ex.lastSeen) ex.lastSeen = b.booked_at;
    }
  });
  const realPatients = Array.from(patientMap.entries()).map(([id, d]) => ({
    id,
    name: d.name,
    initials: d.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
    sessions: d.sessions,
    lastSeen: new Date(d.lastSeen).toLocaleDateString("fr-FR"),
  }));

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    // Always filter by user_id (the unique column) so the existing profile row
    // is updated in place. An upsert without onConflict would generate a new
    // primary key and violate the user_id UNIQUE constraint, silently failing.
    const { bio, price_individual, ...rest } = profileData;
    const { error } = await supabase
      .from("profiles")
      .update({
        ...rest,
        // Keep price_per_session in sync as the headline "individual" price.
        price_per_session: price_individual,
        bio: (bio ?? "").trim().slice(0, BIO_MAX_LENGTH),
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde.");
    } else {
      toast.success("✅ Profil mis à jour !");
    }
  };

  const updateBookingStatus = async (id: string, newStatus: Booking["status"]) => {
    setUpdating(id);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch("/api/bookings/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ booking_id: id, status: newStatus })
      });
      const data = await response.json();
      setUpdating(null);

      if (!response.ok || data.error) {
        toast.error(data.error || "Erreur lors de la mise à jour.");
      } else {
        toast.success("✅ Statut mis à jour !");
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
        );
      }
    } catch (err) {
      setUpdating(null);
      toast.error("Erreur de connexion.");
    }
  };


  const getInitials = (name?: string) => {
    if (!name) return "P";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const initials = profileData.full_name
    ? profileData.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AB";

  const statusLabels: Record<string, string> = {
    confirmed: t("space.status.confirmed"),
    pending:   t("space.status.pending"),
    done:      t("space.status.done"),
    cancelled: t("space.status.cancelled"),
    "no-show": "Absent",
  };

  const pageTitle: Record<Page, string> = {
    dashboard: t("psy.dashboard.nav.dashboard"),
    sessions:  t("psy.dashboard.nav.sessions"),
    patients:  t("psy.dashboard.nav.patients"),
    messages:  t("psy.dashboard.nav.messages"),
    content:   t("psy.dashboard.nav.content"),
    earnings:  t("psy.dashboard.nav.earnings"),
    profile:   t("psy.dashboard.nav.profile"),
    settings:  t("psy.dashboard.nav.settings"),
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return (
        <PsyDashboard
          profileData={profileData}
          approvalStatus={approvalStatus}
          totalUniquePatients={totalUniquePatients}
          sessionsThisMonth={sessionsThisMonth}
          earningsThisMonth={earningsThisMonth}
          upcomingBookings={upcomingBookings}
          immediateRequests={immediateRequests}
          handleRequestResponse={handleRequestResponse}
          respondingToRequest={respondingToRequest}
          bookings={bookings}
          bookingsLoading={bookingsLoading}
          updateBookingStatus={updateBookingStatus}
          updating={updating}
          handleStartCall={handleStartCall}
          startingCall={startingCall}
          realWeeklyEarnings={realWeeklyEarnings}
          maxEarning={maxEarning}
          realPatients={realPatients}
          setActivePage={setActivePage}
        />
      );
      case "sessions": return (
        <PsySessions
          bookings={bookings}
          bookingsLoading={bookingsLoading}
          updateBookingStatus={updateBookingStatus}
          updating={updating}
          handleStartCall={handleStartCall}
          startingCall={startingCall}
          statusLabels={statusLabels}
        />
      );
      case "patients": return (
        <PsyPatients
          realPatients={realPatients}
          bookingsLoading={bookingsLoading}
          bookings={bookings}
          setActivePage={setActivePage}
          setActiveChatUserId={setActiveChatUserId}
          setActiveChatUserName={setActiveChatUserName}
        />
      );
      case "messages": return (
        <PsyMessages
          bookings={bookings}
          activeChatUserId={activeChatUserId}
          setActiveChatUserId={setActiveChatUserId}
          activeChatUserName={activeChatUserName}
          setActiveChatUserName={setActiveChatUserName}
        />
      );
      case "content": return (
        <ContentCreatorPage t={t} user={user} profileData={profileData} getInitials={getInitials} />
      );
      case "earnings": return (
        <PsyEarnings
          earningsThisMonth={earningsThisMonth}
          sessionsThisMonth={sessionsThisMonth}
          pendingPayments={pendingPayments}
          bookings={bookings}
          realWeeklyEarnings={realWeeklyEarnings}
          maxEarning={maxEarning}
          profileData={profileData}
        />
      );
      case "profile": return (
        <PsyProfileEditor
          profileData={profileData}
          setProfileData={setProfileData}
          uploadingAvatar={uploadingAvatar}
          handleAvatarUpload={handleAvatarUpload}
          saveProfile={saveProfile}
          saving={saving}
          psySpecs={psySpecs}
          savingSpecs={savingSpecs}
          toggleSpec={toggleSpec}
        />
      );
      case "settings": return (
        <PsySettingsPage
          clinicSettings={clinicSettings}
          updateClinicSetting={updateClinicSetting}
          notificationPreferences={notificationPreferences}
          updateNotificationPreference={updateNotificationPreference}
          isAvailableNow={isAvailableNow}
          setIsAvailableNow={setIsAvailableNow}
          videoPreviewUrl={videoPreviewUrl}
          handleRemoveVideo={handleRemoveVideo}
          uploadingVideo={uploadingVideo}
          handleSaveVideo={handleSaveVideo}
          pushSupported={pushSupported}
          pushSubscribed={pushSubscribed}
          pushLoading={pushLoading}
          pushToggle={pushToggle}
        />
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-accent/30">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <PsySidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
        profileData={profileData}
        initials={initials}
        signOut={signOut}
      />

      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <PsyTopBar
          title={pageTitle[activePage]}
          setSidebarOpen={setSidebarOpen}
          notifDropdownOpen={notifDropdownOpen}
          setNotifDropdownOpen={setNotifDropdownOpen}
          unreadCount={unreadCount}
          notifications={notifications}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          setActivePage={setActivePage}
        />

        {clinicSettings.vacationMode && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-solid border-amber-200/50 bg-amber-50/60 backdrop-blur-md shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-lg bg-amber-100/80 text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-amber-900">{t("psy.settings.vacation.title")}</h4>
              <p className="text-xs text-amber-800/85 mt-0.5 leading-relaxed font-sans">
                {t("psy.settings.vacationBanner")}
              </p>
            </div>
          </div>
        )}

        {approvalStatus === "pending" && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-amber-200/50 bg-amber-50/60 backdrop-blur-md shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-lg bg-amber-100/80 text-amber-700 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-amber-900">{t("psy.dashboard.pendingTitle")}</h4>
              <p className="text-xs text-amber-800/85 mt-0.5 leading-relaxed">
                {t("psy.dashboard.pendingDesc")}
              </p>
            </div>
          </div>
        )}
        {approvalStatus === "rejected" && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-red-200/50 bg-red-50/60 backdrop-blur-md shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-lg bg-red-100/80 text-red-700 shrink-0">
              <X className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-red-900">{t("psy.dashboard.rejectedTitle")}</h4>
              <p className="text-xs text-red-800/85 mt-0.5 leading-relaxed">
                {t("psy.dashboard.rejectedDesc")}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
