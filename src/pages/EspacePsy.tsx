import { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Users, MessageSquare, DollarSign,
  User, Settings, Menu, X, LogOut, Bell, Check, Clock, TrendingUp,
  ChevronRight, MoreHorizontal, Loader2, Lock, AlertTriangle, Printer,
  Video, Plus, Trash2, Play, Square, PenTool, Volume2, Phone, Smartphone
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ChatWindow from "@/components/ChatWindow";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { SessionCalendar } from "@/components/SessionCalendar";
import { isSameDay } from "date-fns";
import { CATEGORIES } from "@/lib/categories";


type Page = "dashboard" | "sessions" | "patients" | "messages" | "earnings" | "profile" | "settings" | "content";

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

const statusColors = {
  confirmed: "bg-teal-pale text-primary",
  pending: "bg-amber-50 text-amber-700",
  done: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
};

const SESSION_OPEN_MINUTES = 15;

const getSessionTimeState = (booked_at: string, duration_minutes: number) => {
  const now = new Date();
  const start = new Date(booked_at);
  const end = new Date(start.getTime() + (duration_minutes || 60) * 60 * 1000);
  const earlyBuffer = SESSION_OPEN_MINUTES * 60 * 1000;
  if (now < new Date(start.getTime() - earlyBuffer)) return "upcoming" as const;
  if (now > end) return "ended" as const;
  return "active" as const;
};

const formatTimeUntil = (booked_at: string) => {
  const now = new Date();
  const start = new Date(booked_at);
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return "";
  const mins = Math.ceil(diffMs / 60000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`;
  return `${mins}min`;
};



// Static tab wrappers defined outside to prevent React from unmounting/remounting child components on parent re-renders
const DashboardWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const SessionsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const PatientsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const MessagesWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ContentCreatorWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const EarningsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ProfileWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const SettingsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;

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

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [selectedPatientInitials, setSelectedPatientInitials] = useState<string>("");
  const [selectedPatientSessions, setSelectedPatientSessions] = useState<number>(0);
  const [selectedPatientLastSeen, setSelectedPatientLastSeen] = useState<string>("");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");

  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`majal_settings_${user.id}`);
    if (stored) {
      try {
        setClinicSettings(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, [user]);

  // Load profile data (availability + video)
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_available_now, video_url")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setIsAvailableNow(data.is_available_now ?? false);
        if (data.video_url) {
          setVideoUrl(data.video_url);
          setVideoPreviewUrl(data.video_url);
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
        console.log("[Video] Accepting request:", requestId, "psychologist:", user?.id);
        console.log("[Video] Session token present:", !!session?.access_token);
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
        console.log("[Video] API response:", res.status, data);
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
        console.log("[Video] Declining request:", requestId);
        const { data, error } = await supabase
          .from("immediate_session_requests")
          .update({
            status: "declined",
            responded_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select();
        console.log("[Video] Decline result:", { data, error });
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
    if (user) {
      localStorage.setItem(`majal_settings_${user.id}`, JSON.stringify(updated));
    }
    toast.success("✅ Paramètre mis à jour !");
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
  const [profileData, setProfileData] = useState({
    full_name: "",
    specialty: "",
    bio: "",
    city: "",
    price_per_session: 3000,
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
      .select("full_name, specialty, bio, city, price_per_session, years_experience, phone, approval_status, avatar_url")
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
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        ...profileData,
      });
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

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: t("psy.dashboard.nav.dashboard"), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "sessions",  label: t("psy.dashboard.nav.sessions"),  icon: <Calendar className="w-4 h-4" /> },
    { id: "patients",  label: t("psy.dashboard.nav.patients"),  icon: <Users className="w-4 h-4" /> },
    { id: "messages",  label: t("psy.dashboard.nav.messages"),  icon: <MessageSquare className="w-4 h-4" />, badge: 2 },
    { id: "content",   label: t("psy.dashboard.nav.content"),   icon: <PenTool className="w-4 h-4" /> },
    { id: "earnings",  label: t("psy.dashboard.nav.earnings"),  icon: <DollarSign className="w-4 h-4" /> },
    { id: "profile",   label: t("psy.dashboard.nav.profile"),   icon: <User className="w-4 h-4" /> },
    { id: "settings",  label: t("psy.dashboard.nav.settings"),  icon: <Settings className="w-4 h-4" /> },
  ];

  const statusLabels: Record<string, string> = {
    confirmed: t("space.status.confirmed"),
    pending:   t("space.status.pending"),
    done:      t("space.status.done"),
    cancelled: t("space.status.cancelled"),
  };

  const Sidebar = () => (
    <aside className={`fixed inset-y-0 z-50 w-64 bg-white flex flex-col transform transition-transform duration-300 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} border-border/60 ${
      sidebarOpen ? "translate-x-0" : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")
    } lg:translate-x-0`}>
      {/* Brand */}
      <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center font-serif text-[13px] text-primary bg-teal-pale/30">MJ</div>
            <span className="text-base font-serif text-foreground font-semibold">Majal</span>
          </div>
          <span className="text-[10px] text-primary font-semibold tracking-wider mt-1 block">{t("psy.dashboard.spaceTitle").toUpperCase()}</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-1.5">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-transparent border-none cursor-pointer glass-nav-item ${
                  activePage === item.id
                    ? "active bg-teal-pale text-primary font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span className={`transition-transform duration-200 ${activePage === item.id ? "scale-110" : ""}`}>{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile footer */}
      <div className="px-5 py-4 border-t border-border/60 bg-teal-hero/30">
        <div className="flex items-center gap-3 mb-3">
          {profileData.avatar_url ? (
            <img src={profileData.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profileData.full_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{profileData.specialty || "Psychologue"}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all bg-transparent border-none cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );

  const TopBar = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/60 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden bg-transparent border-none cursor-pointer text-foreground hover:text-primary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-foreground leading-none">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-accent/40 flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className={`absolute top-0.5 ${dir === "rtl" ? "left-0.5" : "right-0.5"} w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm`}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className={`absolute ${dir === "rtl" ? "left-0" : "right-0"} mt-2 w-80 bg-white border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden font-sans`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-accent/20">
                <span className="text-xs font-semibold text-foreground">{t("space.notifications")}</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllAsRead();
                      setNotifDropdownOpen(false);
                    }}
                    className="text-[10px] text-primary hover:text-teal-mid font-semibold bg-transparent border-none cursor-pointer"
                  >
                    {t("space.notif.markAllRead")}
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    {t("space.notif.empty")}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={async () => {
                        await markAsRead(notif.id);
                        setNotifDropdownOpen(false);
                        if (notif.link) {
                          const match = notif.link.match(/page=([^&]+)/);
                          if (match && match[1]) {
                            setActivePage(match[1] as Page);
                          } else {
                            window.location.href = notif.link;
                          }
                        }
                      }}
                      className={`flex flex-col p-4 text-start hover:bg-accent/30 cursor-pointer transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          notif.type === 'booking' ? 'bg-blue-50 text-blue-700' :
                          notif.type === 'message' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {t(`space.notif.${notif.type}`) || notif.type}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-foreground mt-1.5 leading-snug">{notif.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-normal">{notif.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );


  // ── Dashboard ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">
            {t("psy.dashboard.welcome")}, {profileData.full_name.split(" ")[0]} 👋
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">{t("psy.dashboard.welcomeSub")}</p>
        </div>
        <div className="text-xs font-semibold px-4 py-2 bg-teal-pale text-primary rounded-full border border-primary/10">
          Statut : {approvalStatus === "approved" ? "Compte Vérifié ✓" : approvalStatus === "pending" ? "Vérification en cours..." : "Action requise"}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t("psy.dashboard.stat.totalPatients"),   value: totalUniquePatients,                                                              icon: <Users className="w-5 h-5" />,     color: "text-primary bg-teal-pale border-primary/10" },
          { label: t("psy.dashboard.stat.sessionsMonth"),   value: sessionsThisMonth,                                                                icon: <Calendar className="w-5 h-5" />,  color: "text-blue-700 bg-blue-50 border-blue-100" },
          { label: t("psy.dashboard.stat.earnings"),        value: earningsThisMonth > 0 ? `${(earningsThisMonth / 1000).toFixed(0)}k` : "0",       icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
          { label: t("psy.dashboard.stat.upcoming"),        value: upcomingBookings.length,                                                         icon: <Clock className="w-5 h-5" />,     color: "text-amber-700 bg-amber-50 border-amber-100" },
        ].map((stat) => (
          <div key={stat.label} className="dashboard-card p-6 flex items-center gap-5">
            <div className={`p-3 rounded-2xl border ${stat.color} shrink-0`}>{stat.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wider">{stat.label}</div>
              <div className="font-serif text-2xl text-foreground mt-1 font-semibold">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Incoming Immediate Requests */}
      {immediateRequests.length > 0 && (
        <div className="dashboard-card p-6 border-l-4 border-emerald-500">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-600" />
            {t("psy.incomingRequests") || "Demandes de session immédiate"}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{immediateRequests.length}</span>
          </h3>
          <div className="space-y-3">
            {immediateRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div>
                  <p className="text-sm font-medium text-foreground">Patient demande une session immédiate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(req.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequestResponse(req.id, true)}
                    disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {respondingToRequest === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("psy.accept") || "Accepter"}
                  </button>
                  <button
                    onClick={() => handleRequestResponse(req.id, false)}
                    disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {respondingToRequest === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("psy.decline") || "Refuser"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Upcoming Sessions */}
        <div className="dashboard-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.upcomingSessions")}</h3>
              <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
                {t("space.viewAll")} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {bookingsLoading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-primary"/></div>
              ) : bookings.filter(b => b.status === "confirmed" || b.status === "pending").length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  {t("psy.dashboard.noUpcoming")}
                </div>
              ) : (
                bookings.filter(b => b.status === "confirmed" || b.status === "pending").slice(0, 4).map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/50 rounded-2xl hover:border-primary/30 hover:bg-teal-hero/20 transition-all duration-300">
                    <div className="flex items-center gap-3.5">
                      {s.patient_avatar ? (
                        <img src={s.patient_avatar} alt={s.patient_name} className="w-11 h-11 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                          {getInitials(s.patient_name)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-sm text-foreground">{s.patient_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 font-sans">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/75" />
                          <span>{new Date(s.booked_at).toLocaleDateString("fr-FR")} · {new Date(s.booked_at).toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})} ({s.duration_minutes} min)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 shrink-0 self-end sm:self-center">
                      {s.status === "pending" ? (
                        <>
                          <button 
                            onClick={() => updateBookingStatus(s.id, "confirmed")} 
                            disabled={updating === s.id} 
                            className="bg-teal-pale text-primary border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-teal-mid hover:text-white transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {t("psy.dashboard.confirm")}
                          </button>
                          <button 
                            onClick={() => updateBookingStatus(s.id, "cancelled")} 
                            disabled={updating === s.id} 
                            className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t("psy.dashboard.reject")}
                          </button>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const timeState = getSessionTimeState(s.booked_at, s.duration_minutes);
                            const timeLabel = timeState === "upcoming" ? `Ouvre dans ${formatTimeUntil(s.booked_at)}` : null;
                            return (
                              <button 
                                onClick={() => handleStartCall(s.id)} 
                                disabled={startingCall === s.id || timeState !== "active"}
                                title={timeLabel || undefined}
                                className={`${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-gray-100 text-gray-400 cursor-not-allowed"} border-none rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm`}
                              >
                                {startingCall === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                                {timeState === "ended" ? "Terminée" : timeLabel || t("psy.dashboard.startVideo")}
                              </button>
                            );
                          })()}
                          <button 
                            onClick={() => updateBookingStatus(s.id, "done")} 
                            disabled={updating === s.id} 
                            className="bg-gray-100 text-gray-700 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-all disabled:opacity-50 shadow-sm"
                          >
                            {t("psy.dashboard.markDone")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Weekly Earnings Chart */}
        <div className="dashboard-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.dashboard.weeklyEarnings")}</h3>
            <div className="relative h-44 mt-6">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-border/60" />
              </div>
              
              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-2">
                {realWeeklyEarnings.map((e) => {
                  const pct = maxEarning > 0 ? (e.amount / maxEarning) * 100 : 0;
                  return (
                    <div key={e.day} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                      {/* Tooltip */}
                      <span className="absolute -top-7 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-sm z-20 whitespace-nowrap">
                        {e.amount.toLocaleString()} DA
                      </span>
                      {/* Bar fill */}
                      <div 
                        className="w-5 sm:w-6 bg-primary/10 hover:bg-primary/20 transition-all rounded-t-md relative cursor-pointer"
                        style={{ height: `${pct}%`, minHeight: e.amount > 0 ? "8px" : "4px" }}
                      >
                        {e.amount > 0 && (
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary rounded-t-md" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-2 block">{e.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.dashboard.weekTotal")}</div>
              <div className="font-serif text-2xl text-primary font-bold mt-0.5">
                {realWeeklyEarnings.reduce((s, e) => s + e.amount, 0).toLocaleString()} DA
              </div>
            </div>
            <TrendingUp className="w-7 h-7 text-primary/40" />
          </div>
        </div>
      </div>

      {/* Recent Patients */}
      <div className="dashboard-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.recentPatients")}</h3>
          <button onClick={() => setActivePage("patients")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            {t("space.viewAll")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {realPatients.length === 0 && !bookingsLoading ? (
            <div className="text-sm text-muted-foreground text-center py-6 col-span-full">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
              {t("psy.dashboard.noPatients")}
            </div>
          ) : realPatients.slice(0, 4).map((p) => {
            // Find patient avatar URL if available in bookings
            const matchingBooking = bookings.find(b => b.patient_id === p.id);
            const avatarUrl = matchingBooking?.patient_avatar;
            
            return (
              <div key={p.id} className="flex items-center gap-3.5 p-4 border border-border/40 rounded-2xl bg-teal-hero/10 hover:bg-teal-hero/30 transition-all duration-300">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                    {p.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-sans leading-none">{p.sessions} {t("psy.dashboard.sessionCount")}</div>
                  <div className="text-[10px] text-primary font-medium mt-1 font-sans leading-none">{t("psy.dashboard.lastVisit")} : {p.lastSeen}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const Sessions = () => {
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
    const [selectedCalDate, setSelectedCalDate] = useState<Date | undefined>(undefined);

    const filteredBookings = viewMode === "calendar" && selectedCalDate
      ? bookings.filter((b) => isSameDay(new Date(b.booked_at), selectedCalDate))
      : bookings;

    return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="dashboard-card overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.allSessions")}</h3>
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
                  viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >Liste</button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
                  viewMode === "calendar" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >Calendrier</button>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-teal-pale text-primary rounded-full border border-primary/5">
            {viewMode === "calendar" && selectedCalDate
              ? `${filteredBookings.length} sur ${bookings.length}`
              : `${bookings.length} ${t("psy.dashboard.nav.sessions")}`
            }
          </span>
        </div>

        {viewMode === "calendar" && (
          <SessionCalendar
            bookings={bookings}
            selected={selectedCalDate}
            onSelect={setSelectedCalDate}
          />
        )}

        <div className="divide-y divide-border/30">
          {bookingsLoading ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-primary"/></div> :
           filteredBookings.length === 0 ? <div className="text-muted-foreground text-center py-12 text-sm">{t("psy.dashboard.noSessions")}</div> :
           filteredBookings.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-teal-hero/30 transition-colors flex-wrap justify-between">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {s.patient_avatar ? (
                  <img src={s.patient_avatar} alt={s.patient_name} className="w-11 h-11 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                    {getInitials(s.patient_name)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-foreground">{s.patient_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(s.booked_at).toLocaleDateString("fr-FR")} · {s.duration_minutes} min</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground w-20 text-center font-sans">
                {new Date(s.booked_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
              </div>
              
              <div className="flex items-center gap-3.5 flex-wrap">
                <span className={`badge-pill ${
                  s.status === "confirmed" ? "badge-pill-confirmed" :
                  s.status === "pending" ? "badge-pill-pending" :
                  s.status === "done" ? "badge-pill-done" : "badge-pill-cancelled"
                }`}>
                  {statusLabels[s.status]}
                </span>
                
                <div className="flex gap-2">
                  {s.status === "pending" && (
                    <>
                      <button onClick={() => updateBookingStatus(s.id, "confirmed")} disabled={updating === s.id} className="bg-teal-pale text-primary border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm">{t("psy.dashboard.confirm")}</button>
                      <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm">{t("psy.dashboard.reject")}</button>
                    </>
                  )}
                  {s.status === "confirmed" && (
                    <>
                      {(() => {
                        const timeState = getSessionTimeState(s.booked_at, s.duration_minutes);
                        const timeLabel = timeState === "upcoming" ? `Ouvre dans ${formatTimeUntil(s.booked_at)}` : null;
                        return (
                          <button 
                            onClick={() => handleStartCall(s.id)} 
                            disabled={startingCall === s.id || timeState !== "active"}
                            title={timeLabel || undefined}
                            className={`${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-gray-100 text-gray-400 cursor-not-allowed"} border-none rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm`}
                          >
                            {startingCall === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />} 
                            {timeState === "ended" ? "Terminée" : timeLabel || t("psy.dashboard.startVideo")}
                          </button>
                        );
                      })()}
                      <button onClick={() => updateBookingStatus(s.id, "done")} disabled={updating === s.id} className="bg-gray-100 text-gray-700 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-all disabled:opacity-50 shadow-sm">{t("psy.dashboard.markDone")}</button>
                      <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 shadow-sm">{t("space.cancel")}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  };
  const PatientDetailsDrawer = () => {
    if (!selectedPatientId) return null;
    const isRtl = dir === "rtl";

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-foreground/30 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedPatientId(null)}
        />
        {/* Drawer container */}
        <div className={`relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between p-6 md:p-8 animate-in ${isRtl ? "slide-in-from-left duration-300" : "slide-in-from-right duration-300"}`}>
          <div className="space-y-6 flex-1 overflow-y-auto pr-1">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-base border border-solid border-primary/5 shadow-sm shrink-0">
                  {selectedPatientInitials}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-foreground">{selectedPatientName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-sans">Patient Majal</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPatientId(null)}
                className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-teal-hero/10 border border-solid border-primary/5 text-center font-sans">
              <div className="border-r border-solid border-border/30">
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Séances totales</div>
                <div className="text-lg font-bold text-foreground mt-1">{selectedPatientSessions}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Dernière visite</div>
                <div className="text-sm font-semibold text-primary mt-1.5">{selectedPatientLastSeen}</div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-3 flex-1 flex flex-col">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                {t("psy.patients.notes.title")}
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={12}
                placeholder={t("psy.patients.notes.placeholder")}
                className="w-full flex-1 px-4 py-3.5 border border-border/70 rounded-2xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
              />
              <span className="text-[10px] text-muted-foreground italic font-sans block">
                🔒 Ces notes cliniques sont stockées de manière sécurisée et confidentielle.
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-solid border-border/40 flex gap-3 mt-4">
            <button
              onClick={() => setSelectedPatientId(null)}
              className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all"
            >
              {t("psy.common.close")}
            </button>
            <button
              onClick={saveClinicalNotes}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all"
            >
              {t("psy.patients.notes.save")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Patients ───────────────────────────────────────────────────────────────
  const Patients = () => (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl text-foreground font-semibold">{t("psy.dashboard.myPatients")}</h3>
        <span className="text-xs font-semibold px-3 py-1 bg-teal-pale text-primary rounded-full border border-primary/5">{realPatients.length} patients</span>
      </div>

      {bookingsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : realPatients.length === 0 ? (
        <div className="dashboard-card p-10 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-sm font-medium">{t("psy.dashboard.noPatients")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {realPatients.map((p) => {
            const matchingBooking = bookings.find(b => b.patient_id === p.id);
            const avatarUrl = matchingBooking?.patient_avatar;
            
            return (
              <div key={p.id} className="dashboard-card p-6 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start gap-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-base shrink-0 border border-primary/5 shadow-sm">
                      {p.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-base text-foreground truncate">{p.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 font-sans">Patient Majal</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border/40 text-center font-sans">
                  <div className="border-r border-border/30">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Séances</div>
                    <div className="text-lg font-bold text-foreground mt-1">{p.sessions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dernier rendez-vous</div>
                    <div className="text-xs font-semibold text-primary mt-2">{p.lastSeen}</div>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-6">
                  <button 
                    onClick={() => { setActivePage("messages"); setActiveChatUserId(p.id); setActiveChatUserName(p.name); }}
                    className="flex-1 py-2.5 rounded-xl bg-teal-pale text-primary hover:bg-primary hover:text-white transition-all text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t("space.messageBtn")}
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setSelectedPatientName(p.name);
                      setSelectedPatientInitials(p.initials);
                      setSelectedPatientSessions(p.sessions);
                      setSelectedPatientLastSeen(p.lastSeen);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-accent/40 text-muted-foreground hover:bg-primary hover:text-white transition-all text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                    title={t("psy.patients.notes.title")}
                  >
                    <User className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PatientDetailsDrawer />
    </div>
  );

  // ── Messages ───────────────────────────────────────────────────────────────
  const Messages = () => {
    // Unique patients from all bookings
    const patientDetails = new Map<string, { name: string; avatar?: string }>();
    bookings.forEach(b => {
      if (b.patient_id && !patientDetails.has(b.patient_id)) {
        patientDetails.set(b.patient_id, {
          name: b.patient_name || "Patient",
          avatar: b.patient_avatar
        });
      }
    });

    const uniquePatients = Array.from(patientDetails.entries());

    return (
      <div className="flex h-full min-h-[500px] animate-in fade-in duration-500">
        {/* Contact List */}
        <div className="w-[320px] border-r border-border/60 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-border/60">
            <h3 className="font-serif text-base font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {uniquePatients.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8 font-medium">{t("psy.dashboard.noPatients")}</p>
            ) : (
              uniquePatients.map(([id, data]) => (
                <button
                  key={id}
                  onClick={() => { setActiveChatUserId(id); setActiveChatUserName(data.name || t("psy.dashboard.defaultPatientName")); }}
                  className={`w-full text-left px-4 py-3.5 border-b border-border/20 flex items-center gap-3 transition-all border-none cursor-pointer ${activeChatUserId === id ? "bg-teal-pale/70 border-l-4 border-primary" : "hover:bg-accent/40 bg-transparent"}`}
                >
                  {data.avatar ? (
                    <img src={data.avatar} alt={data.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {getInitials(data.name)}
                    </div>
                  )}
                  <div className="font-semibold text-sm text-foreground truncate">{data.name}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-accent/10">
          {activeChatUserId ? (
            <ChatWindow otherUserId={activeChatUserId} otherUserName={activeChatUserName} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">{t("psy.dashboard.selectPatientMsg")}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Receipt Modal ──────────────────────────────────────────────────────────
  const ReceiptModal = () => {
    if (!selectedReceiptBooking) return null;
    const b = selectedReceiptBooking;
    const isRtl = dir === "rtl";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-foreground/45 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedReceiptBooking(null)}
        />
        {/* Modal Content */}
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in duration-200 flex flex-col justify-between">
          <div id="receipt-print-area" className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-border/40 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary rounded flex items-center justify-center font-serif text-[10px] text-primary bg-teal-pale/35">MJ</div>
                  <span className="text-sm font-serif text-foreground font-semibold">Majal Mental Health</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-sans">Espace de consultation en ligne</p>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-solid border-emerald-100 uppercase tracking-wider font-sans">
                {t("psy.earnings.receipt.statusPaid")}
              </span>
            </div>

            {/* Title & Invoice Info */}
            <div className="space-y-1 font-sans">
              <h3 className="text-base font-serif font-bold text-foreground">{t("psy.earnings.receipt.title")}</h3>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-1.5">
                <span className="text-muted-foreground">{t("psy.earnings.receipt.invoiceNum")}</span>
                <span className="font-semibold text-right text-foreground">INV-2026-{b.id.slice(0, 5).toUpperCase()}</span>
                <span className="text-muted-foreground">{t("psy.earnings.receipt.date")}</span>
                <span className="font-semibold text-right text-foreground">{new Date(b.booked_at).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>

            {/* Bill Details */}
            <div className="space-y-2 border-t border-b border-border/40 py-4 font-sans text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("psy.earnings.receipt.therapist")}</span>
                <span className="font-semibold text-foreground">{profileData.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("psy.earnings.receipt.patient")}</span>
                <span className="font-semibold text-foreground">{b.patient_name}</span>
              </div>
            </div>

            {/* Receipt Table */}
            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between font-semibold text-muted-foreground pb-1 border-b border-border/30">
                <span>{t("psy.earnings.receipt.desc")}</span>
                <span>Total</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>{t("psy.earnings.receipt.sessionVal")}</span>
                <span className="font-bold">{(b.price || 0).toLocaleString()} DA</span>
              </div>
            </div>

            {/* Signature & Stamp simulator */}
            <div className="pt-4 flex flex-col items-center text-center space-y-2 font-sans relative">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                {t("psy.earnings.receipt.signature")}
              </div>
              
              {/* Virtual Stamp */}
              <div className="relative w-24 h-24 border-2 border-dashed border-primary/40 rounded-full flex items-center justify-center p-1 overflow-hidden opacity-85 rotate-[-8deg] pointer-events-none select-none my-1">
                <div className="border border-solid border-primary/20 w-full h-full rounded-full flex flex-col items-center justify-center text-[7px] font-bold text-primary tracking-tighter bg-teal-pale/10 leading-none">
                  <span>MAJAL CLINIC</span>
                  <span className="text-[6px] text-primary/70 my-0.5">ALGERIA</span>
                  <span>APPROUVÉ</span>
                </div>
              </div>

              {/* Simulated Signature Line */}
              <div className="w-32 border-b border-solid border-muted-foreground/40 font-serif italic text-xs text-muted-foreground pt-1">
                {profileData.full_name.split(" ").slice(-1)[0]}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-solid border-border/40 flex gap-3 mt-4">
            <button
              onClick={() => setSelectedReceiptBooking(null)}
              className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all"
            >
              {t("psy.common.close")}
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all flex items-center justify-center gap-1.5 shadow-sm font-sans"
            >
              <Printer className="w-3.5 h-3.5" />
              {t("psy.earnings.receipt.print")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Earnings ───────────────────────────────────────────────────────────────
  const Earnings = () => (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: t("psy.earnings.thisMonth"),    value: `${earningsThisMonth.toLocaleString()} DA`,                                                              sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
          { label: t("psy.earnings.pending"),       value: `${pendingPayments.toLocaleString()} DA`,                                                               sub: `${bookings.filter(b => b.status === "pending").length} ${t("psy.earnings.sessionsPending")}` },
          { label: t("psy.earnings.avgPerSession"), value: sessionsThisMonth > 0 ? `${Math.round(earningsThisMonth / sessionsThisMonth).toLocaleString()} DA` : "—", sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
        ].map((c) => (
          <div key={c.label} className="dashboard-card p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</div>
              <div className="font-serif text-3xl text-foreground mt-2 font-bold">{c.value}</div>
            </div>
            <div className="text-xs font-semibold text-primary mt-3 bg-teal-pale/50 px-2.5 py-1 rounded-full self-start border border-primary/5">{c.sub}</div>
          </div>
        ))}
      </div>
      
      <div className="dashboard-card p-6">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.earnings.dailyChart")}</h3>
        <div className="relative h-56 mt-6">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-border/60" />
          </div>
          
          {/* Chart Bars */}
          <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
            {realWeeklyEarnings.map((e) => {
              const pct = maxEarning > 0 ? (e.amount / maxEarning) * 100 : 0;
              return (
                <div key={e.day} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                  <span className="absolute -top-7 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-sm z-20 whitespace-nowrap">
                    {e.amount.toLocaleString()} DA
                  </span>
                  <div 
                    className="w-7 sm:w-8 bg-primary/10 hover:bg-primary/20 transition-all rounded-t-md relative cursor-pointer"
                    style={{ height: `${pct}%`, minHeight: e.amount > 0 ? "8px" : "4px" }}
                  >
                    {e.amount > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary rounded-t-md" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-2.5 block">{e.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.earnings.recentTx")}</h3>
        </div>
        <div className="divide-y divide-border/30">
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").slice(0, 10).map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-teal-hero/25 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{b.patient_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(b.booked_at).toLocaleDateString("fr-FR")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-emerald-600 font-sans">+{(b.price || 0).toLocaleString()} DA</div>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptBooking(b)}
                  className="px-2.5 py-1.5 rounded-lg border border-solid border-emerald-200/50 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-all text-xs font-semibold bg-transparent cursor-pointer font-sans"
                >
                  {t("psy.earnings.receipt.generate")}
                </button>
              </div>
            </div>
          ))}
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").length === 0 && (
            <p className="text-center py-10 text-sm text-muted-foreground font-medium">{t("psy.earnings.noTx")}</p>
          )}
        </div>
      </div>
      <ReceiptModal />
    </div>
  );

  // ── Profile Editor ─────────────────────────────────────────────────────────
  const ProfileEditor = () => (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6 animate-in fade-in duration-500">
      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.dashboard.profile.professionalInfo")}</h3>

        {/* Avatar Upload */}
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-border/30">
          <div className="relative group shrink-0">
            {profileData.avatar_url ? (
              <img
                src={profileData.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-md group-hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-teal-pale flex items-center justify-center text-primary text-3xl font-bold border border-primary/10 shadow-inner group-hover:bg-teal-hero transition-colors">
                {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : "P"}
              </div>
            )}
            <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white text-[11px] font-semibold text-center p-1">
              {uploadingAvatar ? "Upload..." : "Changer"}
            </label>
            <input
              type="file"
              id="avatar-upload"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </div>
          <div className="text-center sm:text-left">
            <h4 className="font-semibold text-base text-foreground leading-snug">{profileData.full_name || "Praticien"}</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-normal">Formats acceptés : JPG, PNG, WEBP (max 5 Mo)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {([
            { label: t("space.fullName"),                      key: "full_name",        type: "text" },
            { label: t("space.phone"),                         key: "phone",            type: "tel" },
            { label: t("auth.specialtyLabel"),                 key: "specialty",        type: "text" },
            { label: t("auth.cityLabel"),                      key: "city",             type: "text" },
            { label: t("complete.step1.price"),                key: "price_per_session",type: "number" },
            { label: t("psy.dashboard.profile.yearsExperience"), key: "years_experience", type: "number" },
          ] as const).map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</label>
              <input
                type={f.type}
                value={profileData[f.key]}
                onChange={(e) => setProfileData((p) => ({ ...p, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all"
              />
            </div>
          ))}
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">{t("psy.dashboard.profile.bio")}</label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            placeholder={t("psy.dashboard.profile.bioPlaceholder")}
            className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Specialization Tags */}
      <div className="dashboard-card p-6 md:p-8 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
            {t("psy.settings.specializations.title") || "Spécialisations"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t("psy.settings.specializations.desc") || "Sélectionnez les domaines dans lesquels vous intervenez. Les patients pourront vous trouver en filtrant par catégorie."}
          </p>
        </div>
        <div className="space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <span className="text-base">{cat.icon}</span> {cat.label[lang]}
              </h4>
              <div className="flex flex-wrap gap-2">
                {cat.subcategories.map((sub) => {
                  const isActive = psySpecs.some(
                    (s) => s.category_id === cat.id && s.subcategory_id === sub.id
                  );
                  return (
                    <button
                      key={sub.id}
                      onClick={() => toggleSpec(cat.id, sub.id)}
                      disabled={savingSpecs}
                      className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-foreground border-border hover:border-primary/30 hover:bg-teal-pale/30"
                      }`}
                    >
                      {sub.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-sans hover:shadow-sm"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? t("space.saving") : t("space.save")}
      </button>
    </div>
  );

  // ── Settings ───────────────────────────────────────────────────────────────
  const SettingsPage = () => (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6 animate-in fade-in duration-500">
      {/* Clinic & Availability Settings */}
      <div className="dashboard-card p-6 md:p-8 space-y-6">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
          {t("psy.settings.clinic.title")}
        </h3>
        
        {/* Toggle switches */}
        <div className="space-y-4">
          {[
            {
              title: t("psy.settings.vacation.title"),
              desc: t("psy.settings.vacation.desc"),
              key: "vacationMode",
              checked: clinicSettings.vacationMode
            },
            {
              title: t("psy.settings.autoconfirm.title"),
              desc: t("psy.settings.autoconfirm.desc"),
              key: "autoConfirm",
              checked: clinicSettings.autoConfirm
            },
            {
              title: t("psy.settings.accepting.title"),
              desc: t("psy.settings.accepting.desc"),
              key: "acceptingNew",
              checked: clinicSettings.acceptingNew
            }
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5">
              <div className="pe-4">
                <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{s.desc}</p>
              </div>
              <label className="relative w-12 h-[26px] shrink-0">
                <input
                  type="checkbox"
                  checked={s.checked}
                  onChange={(e) => updateClinicSetting(s.key, e.target.checked)}
                  className="opacity-0 w-0 h-0"
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>

        {/* Working Hours & Buffers */}
        <div className="pt-6 border-t border-border/40 space-y-5">
          <h4 className="font-serif text-base font-semibold text-foreground">{t("psy.settings.hours.title")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-sans">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.start")}</label>
              <input
                type="time"
                value={clinicSettings.startHour}
                onChange={(e) => updateClinicSetting("startHour", e.target.value)}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.end")}</label>
              <input
                type="time"
                value={clinicSettings.endHour}
                onChange={(e) => updateClinicSetting("endHour", e.target.value)}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.buffer")}</label>
              <select
                value={clinicSettings.bufferMinutes}
                onChange={(e) => updateClinicSetting("bufferMinutes", parseInt(e.target.value))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer font-sans"
              >
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          {/* Working Days */}
          <div className="flex flex-col gap-2 pt-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.days")}</label>
            <div className="flex flex-wrap gap-2.5 mt-1 font-sans">
              {[
                { val: "Sun", label: "Dim" },
                { val: "Mon", label: "Lun" },
                { val: "Tue", label: "Mar" },
                { val: "Wed", label: "Mer" },
                { val: "Thu", label: "Jeu" },
                { val: "Fri", label: "Ven" },
                { val: "Sat", label: "Sam" }
              ].map((d) => {
                const active = clinicSettings.workingDays.includes(d.val);
                return (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => {
                      const updatedDays = active
                        ? clinicSettings.workingDays.filter(day => day !== d.val)
                        : [...clinicSettings.workingDays, d.val];
                      updateClinicSetting("workingDays", updatedDays);
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border border-solid transition-all cursor-pointer ${
                      active
                        ? "bg-teal-pale border-primary/20 text-primary scale-105"
                        : "bg-transparent hover:bg-accent/40 border-border/60 text-muted-foreground scale-100"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Online Availability Toggle */}
      <div className="dashboard-card p-6 md:p-8 space-y-4">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
          {t("psy.settings.availability.title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("psy.settings.availability.desc")}</p>
        <div className="flex items-center justify-between py-2.5">
          <div className="pe-4">
            <h4 className="text-sm font-semibold text-foreground">{t("psy.availableNow")}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">
              {t("psy.settings.availability.desc")}
            </p>
          </div>
          <label className="relative w-12 h-[26px] shrink-0">
            <input
              type="checkbox"
              checked={isAvailableNow}
              onChange={(e) => setIsAvailableNow(e.target.checked)}
              className="opacity-0 w-0 h-0"
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Video Presentation Upload */}
      <div className="dashboard-card p-6 md:p-8 space-y-4">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
          {t("psy.settings.video.title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("psy.settings.video.desc")}</p>
        {videoPreviewUrl ? (
          <div className="space-y-3">
            <div className="aspect-video rounded-xl overflow-hidden border border-border">
              <video
                src={videoPreviewUrl}
                controls
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRemoveVideo}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
              >
                {t("psy.settings.video.remove")}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
            <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {lang === "ar" ? "ارفع فيديو تعريفي (حد أقصى 59 ثانية)" : "Téléchargez une vidéo de présentation (max 59 secondes)"}
            </p>
            <p className="text-xs text-muted-foreground/70 mb-4">MP4, WebM ou OGG</p>
            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-teal-mid transition-colors cursor-pointer">
              {uploadingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === "ar" ? "جارٍ الرفع..." : "Upload..."}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("psy.settings.video.upload")}
                </>
              )}
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSaveVideo(file);
                  e.target.value = "";
                }}
                disabled={uploadingVideo}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("space.notifPreferences")}</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-4 border-b border-border/30">
            <div className="pe-4">
              <h4 className="text-sm font-semibold text-foreground">{t("space.pushNotifications")}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{t("space.pushNotificationsDesc")}</p>
            </div>
            {pushSupported ? (
              <button
                type="button"
                role="switch"
                aria-checked={pushSubscribed}
                disabled={pushLoading}
                onClick={async () => {
                  console.log("toggle clicked, current state:", { pushSubscribed, pushLoading });
                  const was = pushSubscribed;
                  const ok = await pushToggle();
                  console.log("toggle result:", ok);
                  if (ok) toast.success(was ? "Notifications push désactivées." : "Notifications push activées !");
                  else toast.error("Impossible d'activer les notifications...");
                }}
                className={`relative w-12 h-[26px] rounded-full transition-colors duration-300 border-none cursor-pointer disabled:opacity-50 shrink-0 ${pushSubscribed ? "bg-primary" : "bg-gray-300"}`}
              >
                <span className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${pushSubscribed ? "translate-x-[22px]" : ""}`} />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px] font-sans">N/A</span>
              </div>
            )}
          </div>
          {[
            { title: t("psy.settings.notif.newBookingsTitle"), desc: t("psy.settings.notif.newBookingsDesc"), checked: true },
            { title: t("psy.settings.notif.remindersTitle"),   desc: t("psy.settings.notif.remindersDesc"),   checked: true },
            { title: t("psy.settings.notif.messagesTitle"),    desc: t("psy.settings.notif.messagesDesc"),    checked: false },
            { title: t("psy.settings.notif.paymentsTitle"),    desc: t("psy.settings.notif.paymentsDesc"),    checked: true },
          ].map((n, i, arr) => (
            <div key={i} className={`flex items-center justify-between py-4 ${i < arr.length - 1 ? "border-b border-border/30" : ""}`}>
              <div className="pe-4">
                <h4 className="text-sm font-semibold text-foreground">{n.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{n.desc}</p>
              </div>
              <label className="relative w-12 h-[26px] shrink-0">
                <input type="checkbox" defaultChecked={n.checked} className="opacity-0 w-0 h-0" />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.settings.security") || "Sécurité"}</h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("reset.newPassword") || "Nouveau mot de passe"}</label>
            <div className="flex items-center gap-3 border border-border/70 rounded-xl px-4 py-3 bg-teal-hero/30 focus-within:border-primary focus-within:bg-card transition-all focus-within:ring-1 focus-within:ring-primary">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="border-none bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground/60 font-sans"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 mt-2 font-sans shadow-sm"
          >
            {changingPassword ? "Mise à jour..." : t("psy.settings.changePassword") || "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Content Creator Page ───────────────────────────────────────────────────
  const ContentCreatorPage = () => {
    const [contentTab, setContentTab] = useState<"stories" | "audio" | "forum">("stories");

    // Stories Creator states
    const [storyText, setStoryText] = useState("");
    const [selectedBg, setSelectedBg] = useState("from-teal-mid to-teal-dark");
    const [publishedStories, setPublishedStories] = useState<{ id?: string; text: string; bg: string }[]>([]);

    // Audio Space Creator states
    const [audioTitle, setAudioTitle] = useState("");
    const [activeAudioRoom, setActiveAudioRoom] = useState<any | null>(null);
    const [simMute, setSimMute] = useState(false);

    // Forum Review states
    const [forumThreads, setForumThreads] = useState<any[]>([]);
    const [selectedThread, setSelectedThread] = useState<any | null>(null);
    const [replyText, setReplyText] = useState("");

    const bgPresets = [
      { name: "Teal Calme", bg: "from-teal-mid to-teal-dark" },
      { name: "Aurore Éveillée", bg: "from-rose-400 to-indigo-600" },
      { name: "Chaleur Réconfortante", bg: "from-amber-400 to-orange-600" },
      { name: "Forêt de Soin", bg: "from-emerald-400 to-teal-700" },
      { name: "Crépuscule Apaisant", bg: "from-purple-600 to-pink-500" },
    ];

    const fetchForumThreads = async () => {
      const { data: threadsData } = await (supabase as any)
        .from('forum_threads')
        .select('id, category, title, content, created_at, author_id')
        .order('created_at', { ascending: false });

      if (threadsData) {
        const threadIds = threadsData.map((t) => t.id);
        const { data: repliesData } = await (supabase as any)
          .from('forum_replies')
          .select('id, thread_id, content, created_at, author_id, profiles(full_name, user_type)')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: true });

        const mapped = threadsData.map((t) => {
          const repliesForThread = repliesData?.filter((r) => r.thread_id === t.id) || [];
          return {
            id: t.id,
            category: t.category,
            title: t.title,
            author: "Anonyme",
            content: t.content,
            date: t.created_at,
            replies: repliesForThread.map((r: any) => ({
              author: r.profiles?.user_type === "psychologue" ? r.profiles?.full_name || "Thérapeute" : "Anonyme",
              content: r.content,
              isPsy: r.profiles?.user_type === "psychologue",
              date: r.created_at,
            })),
          };
        });
        setForumThreads(mapped);
      }
    };

    const fetchDbStories = async () => {
      const { data } = await (supabase as any)
        .from('stories')
        .select('id, content, bg_gradient')
        .eq('author_id', user?.id)
        .order('created_at', { ascending: false });
      if (data) {
        setPublishedStories(data.map(s => ({
          id: s.id,
          text: s.content,
          bg: s.bg_gradient
        })));
      }
    };

    // Load database states on mount
    useEffect(() => {
      fetchDbStories();
      fetchForumThreads();

      // Check for active audio space of this therapist
      const storedAudio = localStorage.getItem("majal_active_audio");
      if (storedAudio) {
        try {
          const rooms = JSON.parse(storedAudio);
          const currentRoom = rooms.find((r: any) => r.host === profileData.full_name);
          if (currentRoom) {
            setActiveAudioRoom(currentRoom);
          }
        } catch(e) {}
      }

      // Realtime subscriptions
      const storiesChannel = supabase
        .channel("psy:stories")
        .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
          fetchDbStories();
        })
        .subscribe();

      const forumChannel = supabase
        .channel("psy:forum")
        .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, () => {
          fetchForumThreads();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies" }, () => {
          fetchForumThreads();
        })
        .subscribe();

      return () => {
        storiesChannel.unsubscribe();
        forumChannel.unsubscribe();
      };
    }, []);

    // Keep audio space synced
    useEffect(() => {
      if (!activeAudioRoom) return;
      const interval = setInterval(() => {
        const storedAudio = localStorage.getItem("majal_active_audio");
        if (storedAudio) {
          try {
            const rooms = JSON.parse(storedAudio);
            const currentRoom = rooms.find((r: any) => r.id === activeAudioRoom.id);
            if (currentRoom) {
              setActiveAudioRoom(currentRoom);
            } else {
              setActiveAudioRoom(null);
            }
          } catch(e) {}
        }
      }, 2000);
      return () => clearInterval(interval);
    }, [activeAudioRoom]);

    const handlePublishStory = async () => {
      if (!storyText.trim() || !user) return;

      const { data, error } = await (supabase as any)
        .from('stories')
        .insert({
          author_id: user.id,
          content: storyText.trim(),
          bg_gradient: selectedBg
        })
        .select()
        .single();

      if (error) {
        toast.error("Erreur lors de la publication de la réflexion.");
      } else if (data) {
        setPublishedStories(prev => [{
          id: data.id,
          text: data.content,
          bg: data.bg_gradient
        }, ...prev]);
        setStoryText("");
        toast.success("✅ Réflexion publiée avec succès ! Elle est désormais visible pour vos patients.");
      }
    };

    const handleDeleteStory = async (idx: number) => {
      const story = publishedStories[idx];
      if (!story || !story.id) return;

      const { error } = await (supabase as any)
        .from('stories')
        .delete()
        .eq('id', story.id);

      if (error) {
        toast.error("Erreur lors de la suppression de la réflexion.");
      } else {
        setPublishedStories(prev => prev.filter((_, i) => i !== idx));
        toast.success("✅ Réflexion supprimée.");
      }
    };

    // Live Audio Handlers
    const handleStartAudioRoom = () => {
      if (!audioTitle.trim()) {
        toast.error("Veuillez donner un sujet au salon.");
        return;
      }

      const newRoom = {
        id: "room-" + Date.now(),
        title: audioTitle.trim(),
        host: profileData.full_name || "Dr. Sofia Ben",
        hostAvatar: profileData.avatar_url || undefined,
        listeners: [],
        speakers: [],
      };

      const storedAudio = localStorage.getItem("majal_active_audio");
      let rooms = [];
      if (storedAudio) {
        try { rooms = JSON.parse(storedAudio); } catch(e) {}
      }

      // Remove any existing room hosted by this psy to prevent duplicates
      rooms = rooms.filter((r: any) => r.host !== (profileData.full_name || "Dr. Sofia Ben"));
      rooms.push(newRoom);

      localStorage.setItem("majal_active_audio", JSON.stringify(rooms));
      setActiveAudioRoom(newRoom);
      setAudioTitle("");
      setSimMute(false);
      toast.success("🎙️ Le salon audio en direct est lancé ! Vos patients peuvent maintenant le rejoindre.");
    };

    const handleStopAudioRoom = () => {
      if (!activeAudioRoom) return;

      const storedAudio = localStorage.getItem("majal_active_audio");
      let rooms = [];
      if (storedAudio) {
        try { rooms = JSON.parse(storedAudio); } catch(e) {}
      }

      rooms = rooms.filter((r: any) => r.id !== activeAudioRoom.id);
      localStorage.setItem("majal_active_audio", JSON.stringify(rooms));
      setActiveAudioRoom(null);
      toast.success("🛑 Le salon audio a été fermé.");
    };

    // Forum Handlers
    const handlePostForumReply = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyText.trim() || !selectedThread || !user) return;

      const { data, error } = await (supabase as any)
        .from('forum_replies')
        .insert({
          thread_id: selectedThread.id,
          author_id: user.id,
          content: replyText.trim()
        })
        .select('id, content, created_at, author_id, profiles(full_name, user_type)')
        .single();

      if (error) {
        toast.error("Erreur lors de la publication de la réponse.");
      } else if (data) {
        toast.success("✅ Votre réponse de clinicien a été publiée !");
        setReplyText("");
        const newReply = {
          author: data.profiles?.full_name || profileData.full_name || "Thérapeute",
          content: data.content,
          isPsy: true,
          date: data.created_at
        };
        const updatedReplies = [...selectedThread.replies, newReply];
        setSelectedThread({ ...selectedThread, replies: updatedReplies });
        fetchForumThreads();
      }
    };

    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl animate-in fade-in duration-500 font-sans">
        
        {/* Navigation tabs */}
        <div className="flex border-b border-border/40 pb-px gap-4 select-none">
          {[
            { id: "stories", label: t("psy.content.publishStory") || "Réflexions", icon: <PenTool className="w-4 h-4" /> },
            { id: "audio", label: t("psy.content.liveAudio") || "Salons Audio", icon: <Volume2 className="w-4 h-4" /> },
            { id: "forum", label: t("space.nav.forum") || "Forum d'entraide", icon: <Users className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setContentTab(tab.id as any);
                setSelectedThread(null);
              }}
              className={`flex items-center gap-2 pb-3.5 text-sm font-semibold border-b-2 border-solid bg-transparent cursor-pointer transition-all ${
                contentTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        {contentTab === "stories" && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
            {/* Creator form */}
            <div className="dashboard-card p-6 md:p-8 space-y-6">
              <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border/30 pb-3">
                {t("psy.content.publishStory")}
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {t("psy.content.storyText")}
                </label>
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  rows={4}
                  placeholder="Ex: Prenez conscience de votre respiration pendant 3 minutes... Vous êtes plus fort que votre anxiété."
                  className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Background preset selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {t("psy.content.storyBg")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  {bgPresets.map((preset) => (
                    <button
                      key={preset.bg}
                      onClick={() => setSelectedBg(preset.bg)}
                      className={`h-12 rounded-xl bg-gradient-to-br ${preset.bg} border-2 border-solid transition-all cursor-pointer ${
                        selectedBg === preset.bg ? "border-primary scale-105 shadow-md" : "border-transparent hover:scale-102"
                      }`}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handlePublishStory}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all"
              >
                Publier la Réflexion
              </button>
            </div>

            {/* Live Preview / Published stories list */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="dashboard-card p-6 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aperçu en Direct</h4>
                <div className="w-full aspect-[9/14] rounded-2xl overflow-hidden bg-gradient-to-br from-teal-mid to-teal-dark relative flex flex-col justify-between p-6 text-white shadow-md">
                  {/* Progress lines simulator */}
                  <div className="w-full h-[3px] bg-white/30 rounded overflow-hidden">
                    <div className="h-full bg-white w-1/3" />
                  </div>
                  {/* Story Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-[10px]">
                      {getInitials(profileData.full_name)}
                    </div>
                    <span className="text-[10px] font-semibold">{profileData.full_name || "Mon Thérapeute"}</span>
                  </div>
                  {/* Story Content */}
                  <div className={`flex-1 bg-gradient-to-br ${selectedBg} flex items-center justify-center text-center p-4 rounded-xl my-4`}>
                    <p className="font-serif text-sm leading-relaxed italic select-none break-words max-h-48 overflow-y-auto px-1">
                      {storyText || "Saisissez votre texte à gauche pour prévisualiser la carte..."}
                    </p>
                  </div>
                  <div className="text-[8px] text-white/50 text-center">Taper pour passer</div>
                </div>
              </div>

              {/* Published Stories */}
              <div className="dashboard-card p-6 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mes Réflexions Actives ({publishedStories.length})</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {publishedStories.map((story, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-solid border-border/40 rounded-xl bg-teal-hero/5 text-xs hover:bg-teal-hero/10 transition-colors font-sans">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-3.5 h-3.5 rounded bg-gradient-to-br ${story.bg} shrink-0`} />
                        <span className="truncate text-foreground/90 font-medium">{story.text}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteStory(idx)}
                        className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {publishedStories.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-2">Aucune réflexion publiée.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {contentTab === "audio" && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
            {/* Create Room or Control Room */}
            <div className="dashboard-card p-6 md:p-8 space-y-6">
              {!activeAudioRoom ? (
                <>
                  <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border/30 pb-3">
                    Lancer un Salon Audio en Direct
                  </h3>
                  <div className="p-4 rounded-xl bg-teal-pale/20 border border-solid border-primary/10 text-xs text-primary leading-relaxed">
                    🎙️ Les salons audio permettent à vos patients de vous rejoindre de façon anonyme pour vous écouter parler d'un thème bien-être spécifique. Vous pouvez leur accorder le droit de parole s'ils le demandent.
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      {t("psy.content.topicTitle")}
                    </label>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder={t("psy.content.topicPlaceholder")}
                      className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                    />
                  </div>

                  <button
                    onClick={handleStartAudioRoom}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all"
                  >
                    {t("psy.content.startAudio")}
                  </button>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-solid border-border/30 pb-3">
                    <div>
                      <span className="flex h-2.5 w-2.5 relative inline-block me-2 align-middle">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                      </span>
                      <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Cercle en Direct</span>
                      <h3 className="font-serif text-lg font-semibold text-foreground mt-1">{activeAudioRoom.title}</h3>
                    </div>
                    <button
                      onClick={handleStopAudioRoom}
                      className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all"
                    >
                      Terminer le salon
                    </button>
                  </div>

                  {/* Audio Speaker Visualization */}
                  <div className="flex flex-col items-center justify-center py-6 bg-teal-hero/5 rounded-2xl border border-solid border-primary/5">
                    <div className="relative flex items-center justify-center my-4">
                      {!simMute && (
                        <>
                          <div className="absolute w-24 h-24 rounded-full bg-primary/15 animate-ping duration-1500" />
                          <div className="absolute w-28 h-28 rounded-full bg-primary/5 animate-pulse duration-2000" />
                        </>
                      )}
                      {profileData.avatar_url ? (
                        <img src={profileData.avatar_url} alt="Host" className="w-20 h-20 rounded-full object-cover border-2 border-solid border-primary relative z-10 shadow-md" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-teal-pale border-2 border-solid border-primary flex items-center justify-center text-primary font-bold text-xl relative z-10 shadow-md">
                          {getInitials(profileData.full_name)}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 z-20 bg-primary text-primary-foreground text-[8px] font-bold px-2 py-0.5 rounded-full border border-solid border-white">
                        MIC ON
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground mt-2">{profileData.full_name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5 font-sans">Organisateur</div>

                    {/* Mute toggle button */}
                    <button
                      onClick={() => setSimMute(!simMute)}
                      className={`px-5 py-2 mt-4 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm ${
                        simMute ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-teal-pale text-primary hover:bg-primary hover:text-white"
                      }`}
                    >
                      {simMute ? "Activer le micro" : "Couper le micro"}
                    </button>
                  </div>

                  {/* Speakers and Requests */}
                  <div className="space-y-3 font-sans">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("psy.content.activeSpeakers") || "Intervenants"} ({activeAudioRoom.speakers.length + 1})
                    </h4>
                    <div className="flex flex-wrap gap-2.5">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-pale text-xs font-semibold text-primary border border-solid border-primary/10">
                        <span>🎙️ {profileData.full_name} (Moi)</span>
                      </div>
                      {activeAudioRoom.speakers.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/40 text-xs font-semibold text-foreground border border-solid border-border/20">
                          <span>{s.name}</span>
                          <button
                            onClick={() => {
                              // Revoke speech rights
                              const updatedRoom = {
                                ...activeAudioRoom,
                                speakers: activeAudioRoom.speakers.filter((x: any) => x.id !== s.id),
                                listeners: [...activeAudioRoom.listeners, { id: s.id, name: s.name }]
};
                              setActiveAudioRoom(updatedRoom);
                              
                              // Save to global local storage
                              const storedAudio = localStorage.getItem("majal_active_audio");
                              if (storedAudio) {
                                try {
                                  const rooms = JSON.parse(storedAudio);
                                  const updatedRooms = rooms.map((r: any) => r.id === activeAudioRoom.id ? updatedRoom : r);
                                  localStorage.setItem("majal_active_audio", JSON.stringify(updatedRooms));
                                } catch(e) {}
                              }
                            }}
                            className="bg-transparent border-none text-muted-foreground hover:text-red-600 font-bold cursor-pointer font-sans"
                            title="Retirer la parole"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Listeners list sidebar */}
            <div className="space-y-6">
              <div className="dashboard-card p-6 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auditeurs dans le salon</h4>
                {activeAudioRoom ? (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {activeAudioRoom.listeners.map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between p-2 rounded-xl border border-solid border-border/20 bg-teal-hero/5 font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">{getInitials(l.name)}</div>
                          <span className="text-xs font-semibold text-foreground">{l.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            // Give speech rights
                            const updatedRoom = {
                              ...activeAudioRoom,
                              listeners: activeAudioRoom.listeners.filter((x: any) => x.id !== l.id),
                              speakers: [...activeAudioRoom.speakers, { id: l.id, name: l.name }]
                            };
                            setActiveAudioRoom(updatedRoom);
                            
                            // Save to global local storage
                            const storedAudio = localStorage.getItem("majal_active_audio");
                            if (storedAudio) {
                              try {
                                  const rooms = JSON.parse(storedAudio);
                                  const updatedRooms = rooms.map((r: any) => r.id === activeAudioRoom.id ? updatedRoom : r);
                                  localStorage.setItem("majal_active_audio", JSON.stringify(updatedRooms));
                                } catch(e) {}
                            }
                            toast.success(`🎙️ Parole accordée à ${l.name}.`);
                          }}
                          className="px-2 py-1 bg-teal-pale text-primary rounded text-[9px] font-bold hover:bg-primary hover:text-white transition-all border-none cursor-pointer"
                        >
                          Inviter à parler
                        </button>
                      </div>
                    ))}
                    {activeAudioRoom.listeners.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">En attente d'auditeurs...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4 font-sans">Lancez un salon pour voir vos auditeurs.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {contentTab === "forum" && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
            {/* Thread detail drawer or listing */}
            <div className="space-y-4">
              {selectedThread ? (
                <div className="dashboard-card p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-solid border-border/30 pb-3">
                    <button
                      onClick={() => setSelectedThread(null)}
                      className="text-xs text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      ← Retour aux questions
                    </button>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-teal-pale text-primary">
                      {selectedThread.category}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground">Posée par {selectedThread.author} · {new Date(selectedThread.date).toLocaleDateString()}</span>
                    <h3 className="font-serif text-lg font-semibold text-foreground leading-snug">{selectedThread.title}</h3>
                    <p className="p-4 rounded-xl border border-solid border-border/20 bg-teal-hero/5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedThread.content}</p>
                  </div>

                  {/* Replies list */}
                  <div className="space-y-3 pt-4 border-t border-solid border-border/30">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.comments")} ({selectedThread.replies.length})</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {selectedThread.replies.map((reply: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-xl border border-solid font-sans text-xs leading-relaxed ${reply.isPsy ? "bg-teal-pale/35 border-primary/20" : "bg-accent/15 border-border/30"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold ${reply.isPsy ? "text-primary flex items-center gap-1" : "text-foreground"}`}>
                              {reply.author}
                              {reply.isPsy && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-white scale-95 leading-none">
                                  {t("space.forum.verifiedPsy") || "Psychologue Vérifié"}
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{new Date(reply.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-foreground/90 whitespace-pre-wrap">{reply.content}</p>
                        </div>
                      ))}
                      {selectedThread.replies.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2">Aucune réponse pour le moment.</p>
                      )}
                    </div>
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handlePostForumReply} className="pt-4 border-t border-solid border-border/40 flex flex-col gap-2 mt-4 font-sans text-xs">
                    <label className="font-semibold text-muted-foreground uppercase tracking-wider">Votre conseil clinique professionnel (Label Verified ✓)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t("space.forum.replyPlaceholder") || "Répondre avec professionnalisme..."}
                        className="flex-1 px-4 py-3 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                      />
                      <button
                        type="submit"
                        className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
                      >
                        {t("space.forum.reply") || "Répondre"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="p-4 rounded-xl bg-teal-pale/25 border border-solid border-primary/10 text-xs text-primary leading-relaxed">
                    💡 En tant que psychologue certifié Majal, vos réponses aux questions anonymes portent automatiquement le badge **Psychologue Vérifié**. Cela renforce la confiance des patients et la visibilité de votre expertise clinique.
                  </div>
                  {forumThreads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className="dashboard-card p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow transition-all duration-300 cursor-pointer border border-solid border-border/40 bg-white"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                            {thread.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{new Date(thread.date).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-serif text-base font-semibold text-foreground leading-snug">{thread.title}</h4>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed font-sans">{thread.content}</p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-solid border-border/30 pt-3.5 mt-4 font-sans text-xs">
                        <span className="text-muted-foreground">Par : {thread.author}</span>
                        <span className="text-primary font-semibold flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {thread.replies.length} réponses
                        </span>
                      </div>
                    </div>
                  ))}
                  {forumThreads.length === 0 && (
                    <div className="dashboard-card p-10 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">Aucun sujet publié par les patients pour le moment.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Guidelines */}
            <div className="space-y-6">
              <div className="dashboard-card p-6 space-y-4 font-sans">
                <h4 className="font-serif text-sm font-semibold text-primary">Charte du Praticien</h4>
                <ul className="space-y-3.5 text-xs text-muted-foreground leading-relaxed font-sans">
                  <li>• **Conseils Généraux** : Fournissez des explications théoriques et des pistes thérapeutiques. Évitez les prescriptions formelles en ligne.</li>
                  <li>• **Anonymat du patient** : Respectez le cadre sécurisé et confidentiel des échanges.</li>
                  <li>• **Renvoi** : Encouragez la prise de rendez-vous en cabinet ou sur Majal pour un suivi approfondi.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    );
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

  const pageContent: Record<Page, React.ReactNode> = {
    dashboard: <DashboardWrapper render={Dashboard} />,
    sessions: <SessionsWrapper render={Sessions} />,
    patients: <PatientsWrapper render={Patients} />,
    messages: <MessagesWrapper render={Messages} />,
    content:  <ContentCreatorWrapper render={ContentCreatorPage} />,
    earnings: <EarningsWrapper render={Earnings} />,
    profile: <ProfileWrapper render={ProfileEditor} />,
    settings: <SettingsWrapper render={SettingsPage} />,
  };

  return (
    <div className="flex min-h-screen bg-accent/30">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <TopBar title={pageTitle[activePage]} />

        {/* Vacation Mode Banner */}
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

        {/* Verification Status Banner */}
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
          {pageContent[activePage]}
        </div>
      </main>
    </div>
  );
}
