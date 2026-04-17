export const psyProfile = {
  name: "Dr. Amira Benali",
  specialty: "Thérapie cognitive et comportementale",
  avatar: "AB",
  rating: 4.9,
};

export const statsData = {
  totalPatients: 24,
  sessionsThisMonth: 38,
  earningsThisMonth: 76000,
  pendingPayments: 12000,
  upcomingSessions: 5,
};

export const todaySessions = [
  {
    id: "1",
    patientName: "Karim Mansouri",
    patientInitials: "KM",
    time: "09:00",
    duration: 50,
    type: "Suivi régulier",
    status: "confirmed" as const,
  },
  {
    id: "2",
    patientName: "Sara Hadj Ali",
    patientInitials: "SH",
    time: "11:00",
    duration: 50,
    type: "Première consultation",
    status: "confirmed" as const,
  },
  {
    id: "3",
    patientName: "Youcef Brahimi",
    patientInitials: "YB",
    time: "14:30",
    duration: 50,
    type: "Suivi régulier",
    status: "pending" as const,
  },
  {
    id: "4",
    patientName: "Nadia Khelif",
    patientInitials: "NK",
    time: "16:00",
    duration: 50,
    type: "Bilan de suivi",
    status: "confirmed" as const,
  },
];

export const notifications = [
  {
    id: "1",
    type: "booking" as const,
    message: "Nouvelle réservation de Youcef Brahimi pour demain à 10h00",
    time: "Il y a 10 min",
    read: false,
  },
  {
    id: "2",
    type: "message" as const,
    message: "Sara Hadj Ali vous a envoyé un message",
    time: "Il y a 1h",
    read: false,
  },
  {
    id: "3",
    type: "payment" as const,
    message: "Paiement reçu de Karim Mansouri — 3 200 DA",
    time: "Il y a 3h",
    read: true,
  },
  {
    id: "4",
    type: "booking" as const,
    message: "Rappel : session avec Nadia Khelif dans 1 heure",
    time: "Il y a 5h",
    read: true,
  },
];

export const recentPatients = [
  {
    id: "1",
    name: "Karim Mansouri",
    initials: "KM",
    sessions: 12,
    status: "improving" as const,
    lastSeen: "Aujourd'hui",
  },
  {
    id: "2",
    name: "Sara Hadj Ali",
    initials: "SH",
    sessions: 1,
    status: "stable" as const,
    lastSeen: "Aujourd'hui",
  },
  {
    id: "3",
    name: "Nadia Khelif",
    initials: "NK",
    sessions: 8,
    status: "needs-attention" as const,
    lastSeen: "Hier",
  },
  {
    id: "4",
    name: "Lyes Aoudia",
    initials: "LA",
    sessions: 5,
    status: "improving" as const,
    lastSeen: "Il y a 2 jours",
  },
];

export const weeklyEarnings = [
  { day: "Lun", amount: 9600 },
  { day: "Mar", amount: 6400 },
  { day: "Mer", amount: 12800 },
  { day: "Jeu", amount: 9600 },
  { day: "Ven", amount: 16000 },
  { day: "Sam", amount: 3200 },
  { day: "Dim", amount: 0 },
];
