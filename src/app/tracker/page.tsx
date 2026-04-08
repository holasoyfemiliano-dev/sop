"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { loadState, getTodayStr } from "@/lib/store";
import { CATEGORY_COLORS, CATEGORY_HEX, type SOPState } from "@/lib/types";
import { CheckCircle2, XCircle, Clock, Calendar, SkipForward } from "lucide-react";

function getPastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === yStr) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export default function TrackerPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [selectedDay, setSelectedDay] = useState(getTodayStr());

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) return null;

  const days = getPastDays(30);

  const getDayStats = (dateStr: string) => {
    const blocks = state.timeBlocks.filter((b) => b.date === dateStr && b.type === "task");
    if (blocks.length > 0) {
      const done = blocks.filter((b) => b.completed).length;
      return { total: blocks.length, done, pct: Math.round((done / blocks.length) * 100) };
    }
    // Fall back to legacy
    const log = state.logs.find((l) => l.date === dateStr);
    const actions = state.actions.filter((a) => {
      const g = state.goals.find((g) => g.id === a.goalId);
      return g?.active && a.frequency === "diario";
    });
    const done = log ? log.actions.filter((a) => a.completed).length : 0;
    return { total: actions.length, done, pct: actions.length > 0 ? Math.round((done / actions.length) * 100) : 0 };
  };

  const selectedBlocks = state.timeBlocks
    .filter((b) => b.date === selectedDay && b.type === "task")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tracker</h1>
          <p className="text-gray-400 text-sm mt-0.5">Historial de ejecución — últimos 30 días</p>
        </div>

        {/* Heatmap */}
        <div className="glass rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} className="text-gray-400" />
            <span className="text-xs text-gray-400">Selecciona un día</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[...days].reverse().map((d) => {
              const { pct, total } = getDayStats(d);
              const selected = d === selectedDay;
              const color =
                total === 0
                  ? "bg-white/5"
                  : pct >= 80
                  ? "bg-green-500"
                  : pct >= 50
                  ? "bg-yellow-500"
                  : pct > 0
                  ? "bg-orange-500/70"
                  : "bg-red-500/30";
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  title={`${formatDay(d)}: ${pct}%`}
                  className={`w-7 h-7 rounded-md transition-all ${color} ${
                    selected ? "ring-2 ring-white scale-110" : "hover:scale-105"
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-gray-600">Menos</span>
            <div className="flex gap-1">
              {["bg-white/5", "bg-orange-500/70", "bg-yellow-500", "bg-green-500"].map((c) => (
                <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
              ))}
            </div>
            <span className="text-xs text-gray-600">Más</span>
          </div>
        </div>

        {/* Day detail */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white capitalize">{formatDay(selectedDay)}</h2>
            {(() => {
              const { done, total, pct } = getDayStats(selectedDay);
              return (
                <span className={`text-sm font-medium ${pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-gray-400"}`}>
                  {done}/{total} · {pct}%
                </span>
              );
            })()}
          </div>

          {selectedBlocks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              Sin bloques registrados para este día.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedBlocks.map((block) => {
                const task = state.tasks.find((t) => t.id === block.taskId);
                const done = block.completed;
                const skipped = block.skipped;
                const isMissed = !done && !skipped;
                const color = task?.category ? CATEGORY_HEX[task.category] : "#6366f1";

                return (
                  <div
                    key={block.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/3"
                    style={{ borderLeft: `3px solid ${color}30` }}
                  >
                    {done ? (
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                    ) : skipped ? (
                      <SkipForward size={16} className="text-yellow-400 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-400/50 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${done ? "text-white" : skipped ? "text-gray-500 line-through" : "text-gray-400"}`}>
                        {block.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task?.category && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[task.category]}`}>
                            {task.category}
                          </span>
                        )}
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Clock size={9} /> {block.startTime} · {block.durationMinutes} min
                        </span>
                      </div>
                    </div>
                    {done && block.completedAt && (
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        ✓ {new Date(block.completedAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {block.rescheduleCount > 0 && (
                      <span className="text-xs text-yellow-500/70 flex-shrink-0">
                        ×{block.rescheduleCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
