"use client";
import { useEffect, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import TimelineView from "@/components/TimelineView";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import { rescheduleBlock } from "@/lib/scheduler";
import type { SOPState } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import Link from "next/link";

function formatHeaderDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = getTodayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrowStr) return "Mañana";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}

function getWeekDays(anchorDate: string): string[] {
  const d = new Date(anchorDate + "T12:00:00");
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split("T")[0];
  });
}

export default function CalendarPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const today = getTodayStr();

  useEffect(() => {
    setState(loadState());
    setSelectedDate(today);
  }, [today]);

  const update = useCallback((s: SOPState) => {
    setState(s);
    saveState(s);
  }, []);

  const completeBlock = useCallback(
    (blockId: string) => {
      if (!state) return;
      const newBlocks = state.timeBlocks.map((b) =>
        b.id === blockId
          ? { ...b, completed: true, completedAt: new Date().toISOString() }
          : b
      );
      let newTasks = state.tasks;
      const block = state.timeBlocks.find((b) => b.id === blockId);
      if (block?.taskId) {
        newTasks = state.tasks.map((t) =>
          t.id === block.taskId
            ? { ...t, status: "completed" as const, lastCompletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            : t
        );
      }
      update({ ...state, timeBlocks: newBlocks, tasks: newTasks });
    },
    [state, update]
  );

  const skipBlock = useCallback(
    (blockId: string) => {
      if (!state) return;
      const block = state.timeBlocks.find((b) => b.id === blockId);
      if (!block) return;
      const newBlocks = state.timeBlocks.map((b) =>
        b.id === blockId ? { ...b, skipped: true } : b
      );
      if (block.taskId && state.preferences.reschedulePolicy.autoRescheduleOnMiss) {
        const task = state.tasks.find((t) => t.id === block.taskId);
        if (task) {
          const { blocks: rescheduled, reducedMinutes } = rescheduleBlock(
            block,
            task,
            state.preferences,
            newBlocks
          );
          const newTasks = state.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "rescheduled" as const,
                  missCount: t.missCount + 1,
                  lastMissedAt: new Date().toISOString(),
                  estimatedMinutes: reducedMinutes ?? t.estimatedMinutes,
                  updatedAt: new Date().toISOString(),
                }
              : t
          );
          const withIds = rescheduled.map((b) => ({ ...b, id: generateId() }));
          update({ ...state, timeBlocks: [...newBlocks, ...withIds], tasks: newTasks });
          return;
        }
      }
      update({ ...state, timeBlocks: newBlocks });
    },
    [state, update]
  );

  if (!state) return null;

  const weekDays = getWeekDays(selectedDate);
  const selectedBlocks = state.timeBlocks
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <Link
            href="/chat"
            className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> Agregar
          </Link>
        </div>

        {/* Week strip */}
        <div className="glass rounded-xl p-3 mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() - 7);
                setSelectedDate(d.toISOString().split("T")[0]);
              }}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-gray-300 font-medium capitalize">
              {new Date(weekDays[0] + "T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() + 7);
                setSelectedDate(d.toISOString().split("T")[0]);
              }}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <div key={d} className="text-center text-xs text-gray-600 pb-1">{d}</div>
            ))}
            {weekDays.map((d) => {
              const dayBlocks = state.timeBlocks.filter((b) => b.date === d && b.type === "task");
              const completed = dayBlocks.filter((b) => b.completed).length;
              const hasBlocks = dayBlocks.length > 0;
              const isSelected = d === selectedDate;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : isToday
                      ? "bg-white/8 text-white"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {new Date(d + "T12:00:00").getDate()}
                  </span>
                  {hasBlocks && (
                    <div className={`w-1 h-1 rounded-full ${
                      completed === dayBlocks.length ? "bg-green-400" : "bg-indigo-400"
                    } ${isSelected ? "bg-white" : ""}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day view */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white capitalize">{formatHeaderDate(selectedDate)}</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {selectedBlocks.filter((b) => b.type === "task" && b.completed).length}/
                {selectedBlocks.filter((b) => b.type === "task").length} completadas
              </span>
            </div>
          </div>

          {selectedBlocks.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Sin tareas agendadas para este día.</p>
              <Link href="/chat" className="text-indigo-400 text-sm mt-2 inline-block hover:underline">
                Agregar tareas →
              </Link>
            </div>
          ) : (
            <TimelineView
              blocks={selectedBlocks}
              tasks={state.tasks}
              startHour={state.preferences.schedule.workStartHour}
              endHour={state.preferences.schedule.workEndHour}
              onComplete={completeBlock}
              onSkip={skipBlock}
            />
          )}
        </div>
      </main>
    </div>
  );
}
