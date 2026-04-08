"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { loadState, saveState, getTodayStr } from "@/lib/store";
import type { SOPState, Task } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Check } from "lucide-react";
import type { GCalEvent } from "@/app/api/gcal/events/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHeaderDate(dateStr: string) {
  const today = getTodayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrowStr) return "Mañana";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function getWeekDays(anchor: string): string[] {
  const d = new Date(anchor + "T12:00:00");
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split("T")[0];
  });
}

function timeToMins(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

const GCAL_COLORS: Record<string, string> = {
  "1": "#4285f4", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
  "5": "#f6c026", "6": "#f5511d", "7": "#039be5", "8": "#616161",
  "9": "#3f51b5", "10": "#0b8043", "11": "#d60000",
};

interface EventRow {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  allDay?: boolean;
  taskId?: string;        // if from local task
  status?: Task["status"];
}

// ── EventBlock ────────────────────────────────────────────────────────────────

function EventBlock({ event }: { event: EventRow }) {
  const dur = timeToMins(event.endTime) - timeToMins(event.startTime);
  const done = event.status === "done";
  return (
    <Link
      href={event.taskId ? `/task/${event.taskId}` : "#"}
      className="flex items-center gap-3 py-3.5 border-b last:border-0 transition-colors"
      style={{ borderColor: "rgba(35,14,255,0.1)" }}
    >
      <div className="w-16 flex-shrink-0 text-right">
        <p className="text-xs font-semibold" style={{ color: "#818BA6" }}>{event.startTime || "Todo el día"}</p>
        {!event.allDay && event.endTime && (
          <p className="text-xs" style={{ color: "#3D4466" }}>{event.endTime}</p>
        )}
      </div>
      <div
        className="w-0.5 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: done ? "#3D4466" : event.color, minHeight: "2rem", opacity: done ? 0.5 : 1 }}
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{
              color: done ? "#3D4466" : "#EAEBEF",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {event.title}
          </p>
          {!event.allDay && dur > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "#3D4466" }}>
              {dur < 60 ? `${dur} min` : `${Math.floor(dur / 60)}h${dur % 60 ? ` ${dur % 60}min` : ""}`}
            </p>
          )}
        </div>
        {done && <Check size={13} style={{ color: "#230EFF", flexShrink: 0 }} />}
      </div>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [loadingGcal, setLoadingGcal] = useState(false);
  const fetchedWeeks = useRef(new Set<string>());
  const today = getTodayStr();

  useEffect(() => { setState(loadState()); }, []);

  const fetchGCalWeek = useCallback(async (anchor: string) => {
    const week = getWeekDays(anchor);
    const weekKey = week[0];
    if (fetchedWeeks.current.has(weekKey)) return;
    fetchedWeeks.current.add(weekKey);
    setLoadingGcal(true);
    try {
      const res = await fetch(`/api/gcal/events?from=${week[0]}&to=${week[6]}`);
      const data = await res.json();
      if (Array.isArray(data.events)) {
        setGcalEvents((prev) => [
          ...prev.filter((e) => e.date < week[0] || e.date > week[6]),
          ...data.events,
        ]);
      }
    } catch { /* silent */ } finally {
      setLoadingGcal(false);
    }
  }, []);

  useEffect(() => { fetchGCalWeek(selectedDate); }, [selectedDate, fetchGCalWeek]);

  if (!state) return null;

  const weekDays = getWeekDays(selectedDate);

  // Local task events for selected date
  const localTaskEvents: EventRow[] = state.tasks
    .filter((t) => t.scheduledDate === selectedDate && t.status !== "cancelled")
    .map((t): EventRow => ({
      id: t.id,
      title: t.title,
      startTime: t.scheduledStart ?? "",
      endTime: t.scheduledEnd ?? "",
      color: "#230EFF",
      taskId: t.id,
      status: t.status,
    }));

  // GCal events — deduplicate tasks already synced
  const localGcalIds = new Set(state.tasks.filter((t) => t.gcalEventId).map((t) => t.gcalEventId!));
  const gcalRows: EventRow[] = gcalEvents
    .filter((e) => e.date === selectedDate && !localGcalIds.has(e.gcalId))
    .map((e): EventRow => ({
      id: e.gcalId,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      color: e.colorId ? (GCAL_COLORS[e.colorId] ?? "#4285f4") : "#4285f4",
      allDay: e.allDay,
    }));

  const scheduledEvents = [...localTaskEvents.filter((e) => e.startTime), ...gcalRows]
    .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
  const unscheduledEvents = localTaskEvents.filter((e) => !e.startTime);
  const allEvents = [...scheduledEvents, ...unscheduledEvents];

  // Week event counts
  const weekEventCounts = weekDays.reduce((acc, d) => {
    acc[d] = state.tasks.filter((t) => t.scheduledDate === d).length +
             gcalEvents.filter((e) => e.date === d).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14 proximity-gradient">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#EAEBEF" }}>Calendario</h1>
          <div className="flex items-center gap-3">
            {loadingGcal && <RefreshCw size={13} className="animate-spin" style={{ color: "#818BA6" }} />}
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
              style={{ background: "#230EFF", color: "#EAEBEF" }}
            >
              <Plus size={14} /> Agregar
            </Link>
          </div>
        </div>

        {/* Week strip */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(13,16,53,0.8)", border: "1px solid rgba(35,14,255,0.15)" }}>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() - 7);
                setSelectedDate(d.toISOString().split("T")[0]);
              }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#3D4466" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium capitalize" style={{ color: "#818BA6" }}>
              {new Date(weekDays[0] + "T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() + 7);
                setSelectedDate(d.toISOString().split("T")[0]);
              }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#3D4466" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["L","M","X","J","V","S","D"].map((d) => (
              <div key={d} className="text-center text-xs pb-1.5" style={{ color: "#3D4466" }}>{d}</div>
            ))}
            {weekDays.map((d) => {
              const count = weekEventCounts[d] ?? 0;
              const isSelected = d === selectedDate;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className="flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
                  style={{
                    background: isSelected ? "#230EFF" : isToday ? "rgba(35,14,255,0.1)" : "transparent",
                    color: isSelected ? "#EAEBEF" : isToday ? "#EAEBEF" : "#818BA6",
                    border: isToday && !isSelected ? "1px solid rgba(35,14,255,0.3)" : "1px solid transparent",
                  }}
                >
                  <span className="text-sm font-semibold">{new Date(d + "T12:00:00").getDate()}</span>
                  {count > 0 && (
                    <div className="w-1 h-1 rounded-full" style={{ background: isSelected ? "#FFB900" : "#230EFF" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day events */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(13,16,53,0.8)", border: "1px solid rgba(35,14,255,0.15)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold capitalize" style={{ color: "#EAEBEF" }}>{formatHeaderDate(selectedDate)}</h2>
            <span className="text-xs" style={{ color: "#3D4466" }}>{allEvents.length} eventos</span>
          </div>

          {allEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm mb-3" style={{ color: "#3D4466" }}>Sin eventos para este día.</p>
              <Link href="/chat" className="text-sm font-medium hover:underline" style={{ color: "#230EFF" }}>
                Agregar evento →
              </Link>
            </div>
          ) : (
            <>
              {scheduledEvents.map((event) => <EventBlock key={event.id} event={event} />)}
              {unscheduledEvents.length > 0 && (
                <>
                  {scheduledEvents.length > 0 && (
                    <div className="py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#3D4466" }}>
                      Sin hora asignada
                    </div>
                  )}
                  {unscheduledEvents.map((event) => <EventBlock key={event.id} event={event} />)}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
