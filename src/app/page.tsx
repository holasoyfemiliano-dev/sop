"use client";
import { useEffect, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import RingProgress from "@/components/RingProgress";
import TimelineView from "@/components/TimelineView";
import {
  loadState,
  saveState,
  getTodayStr,
  getCompletionRate,
  getStreak,
  generateId,
} from "@/lib/store";
import { rescheduleBlock } from "@/lib/scheduler";
import type { SOPState, TimeBlock, Task } from "@/lib/types";
import { Flame, TrendingUp, Clock, Zap, List, CalendarDays } from "lucide-react";
import Link from "next/link";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate() {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function TodayPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
  const today = getTodayStr();

  useEffect(() => {
    setState(loadState());
  }, []);

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
      // Also mark task as completed if all its blocks for today are done
      const block = state.timeBlocks.find((b) => b.id === blockId);
      let newTasks = state.tasks;
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

      // Attempt to reschedule
      if (block.taskId && state.preferences.reschedulePolicy.autoRescheduleOnMiss) {
        const task = state.tasks.find((t) => t.id === block.taskId);
        if (task) {
          const { blocks: rescheduledBlocks, reducedMinutes } = rescheduleBlock(
            block,
            task,
            state.preferences,
            [...newBlocks]
          );

          let newTasks = state.tasks.map((t) =>
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

          const addedBlocks = rescheduledBlocks.map((b) => ({ ...b, id: generateId() }));
          update({ ...state, timeBlocks: [...newBlocks, ...addedBlocks], tasks: newTasks });
          return;
        }
      }

      update({ ...state, timeBlocks: newBlocks });
    },
    [state, update]
  );

  if (!state) return null;

  const todayBlocks = state.timeBlocks
    .filter((b) => b.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const taskBlocks = todayBlocks.filter((b) => b.type === "task");
  const completedCount = taskBlocks.filter((b) => b.completed).length;
  const totalCount = taskBlocks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const streak = getStreak(state);
  const weekRate = getCompletionRate(state, 7);

  const remainingMinutes = taskBlocks
    .filter((b) => !b.completed && !b.skipped)
    .reduce((s, b) => s + b.durationMinutes, 0);

  const hasContent = todayBlocks.length > 0 || state.tasks.length > 0;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-gray-500 text-sm capitalize">{formatDate()}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {getGreeting()} <span className="text-indigo-400">⚡</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass rounded-xl p-3 text-center">
            <Flame size={16} className="text-orange-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{streak}</div>
            <div className="text-xs text-gray-500">racha</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{weekRate}%</div>
            <div className="text-xs text-gray-500">7 días</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Clock size={16} className="text-blue-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{remainingMinutes}</div>
            <div className="text-xs text-gray-500">min rest.</div>
          </div>
        </div>

        {!hasContent ? (
          /* Empty state */
          <div className="glass rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap size={28} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Tu día está vacío</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              Cuéntame qué necesitas hacer hoy y lo organizo automáticamente en tu agenda.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Ir al chat →
            </Link>
          </div>
        ) : (
          <>
            {/* Progress + view toggle */}
            <div className="glass rounded-xl p-4 mb-5 flex items-center gap-4">
              <RingProgress
                value={completionPct}
                size={72}
                stroke={6}
                color={completionPct >= 70 ? "#22c55e" : completionPct >= 40 ? "#f59e0b" : "#6366f1"}
                label={`${completionPct}%`}
              />
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">
                  {completedCount}/{totalCount} tareas completadas hoy
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {completionPct === 100
                    ? "¡Día completado! 🔥"
                    : completionPct >= 70
                    ? "Excelente ritmo"
                    : completionPct >= 40
                    ? "Sigue adelante"
                    : "Empieza ahora"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`p-2 rounded-lg transition-colors ${viewMode === "timeline" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:text-white"}`}
                >
                  <CalendarDays size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:text-white"}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>

            {viewMode === "timeline" ? (
              <div className="glass rounded-xl p-4">
                <TimelineView
                  blocks={todayBlocks}
                  tasks={state.tasks}
                  startHour={state.preferences.schedule.workStartHour}
                  endHour={state.preferences.schedule.workEndHour}
                  onComplete={completeBlock}
                  onSkip={skipBlock}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {taskBlocks.map((block) => {
                  const task = state.tasks.find((t) => t.id === block.taskId);
                  const done = block.completed;
                  const skipped = block.skipped;
                  return (
                    <div
                      key={block.id}
                      className={`glass rounded-xl p-4 flex items-center gap-3 transition-all ${done || skipped ? "opacity-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${done ? "line-through text-gray-500" : "text-white"}`}>
                          {block.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {block.startTime} – {block.endTime} · {block.durationMinutes} min
                        </p>
                      </div>
                      {!done && !skipped && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => completeBlock(block.id)}
                            className="text-xs px-3 py-1 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-lg transition-colors"
                          >
                            Hecho
                          </button>
                          <button
                            onClick={() => skipBlock(block.id)}
                            className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
                          >
                            Omitir
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
