export interface Doctor {
  id: number;
  name: string;
  emoji: string;
  specialty: string;
  rating: number;
  reviews: number;
  price: number;
  exp: number;
  langs: string[];
  dispo: string;
}

export const doctors: Doctor[] = [
  { id: 1, name: "Dr. Amina Benali", emoji: "👩‍⚕️", specialty: "Anxiété & Stress", rating: 4.9, reviews: 127, price: 3000, exp: 8, langs: ["Français", "Arabe"], dispo: "Disponible cette semaine" },
  { id: 2, name: "Dr. Karim Messaoudi", emoji: "👨‍⚕️", specialty: "Dépression", rating: 4.8, reviews: 95, price: 3500, exp: 12, langs: ["Français", "Arabe"], dispo: "Disponible demain" },
  { id: 3, name: "Dr. Sarah Larbi", emoji: "👩‍⚕️", specialty: "Relations", rating: 4.9, reviews: 143, price: 2800, exp: 6, langs: ["Français"], dispo: "Disponible aujourd'hui" },
  { id: 4, name: "Dr. Youssef Hamdi", emoji: "👨‍⚕️", specialty: "Traumatisme", rating: 5.0, reviews: 89, price: 4000, exp: 15, langs: ["Arabe", "Français"], dispo: "Disponible cette semaine" },
  { id: 5, name: "Dr. Leila Bouazza", emoji: "👩‍⚕️", specialty: "Thérapie familiale", rating: 4.7, reviews: 76, price: 3200, exp: 10, langs: ["Français", "Arabe"], dispo: "Disponible demain" },
  { id: 6, name: "Dr. Mohamed Cherif", emoji: "👨‍⚕️", specialty: "Anxiété & Stress", rating: 4.8, reviews: 112, price: 2500, exp: 7, langs: ["Arabe"], dispo: "Disponible cette semaine" },
];

export const getDoctorById = (id: number): Doctor => {
  return doctors.find((d) => d.id === id) || doctors[0];
};
