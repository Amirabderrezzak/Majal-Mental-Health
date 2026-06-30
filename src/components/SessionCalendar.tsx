import { Calendar } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";

interface SessionCalendarProps {
  bookings: { booked_at: string }[];
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

export function SessionCalendar({ bookings, selected, onSelect }: SessionCalendarProps) {
  const datesWithBookings = bookings.reduce<Date[]>((acc, b) => {
    const d = new Date(b.booked_at);
    d.setHours(0, 0, 0, 0);
    if (!acc.some((a) => a.getTime() === d.getTime())) acc.push(d);
    return acc;
  }, []);

  return (
    <>
      <style>{`
        .rdp-day_hasBooking::after {
          content: "•";
          position: absolute;
          bottom: 1px;
          left: 50%;
          transform: translateX(-50%);
          color: hsl(var(--primary));
          font-size: 10px;
        }
      `}</style>
      <div className="flex justify-center py-4">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onSelect}
          locale={fr}
          modifiers={{
            hasBooking: (date) =>
              datesWithBookings.some(
                (d) =>
                  d.getFullYear() === date.getFullYear() &&
                  d.getMonth() === date.getMonth() &&
                  d.getDate() === date.getDate()
              ),
          }}
          modifiersClassNames={{
            hasBooking: "rdp-day_hasBooking",
          }}
        />
      </div>
    </>
  );
}
