"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Nav from "@/components/Nav";
import RingProgress from "@/components/RingProgress";
import {
  loadState,
  saveState,
  getTodayStr,
  getCompletionRate,
  getStreak,
  generateId,
} from "@/lib/store";
import { rescheduleBlock, timeToMinutes } from "@/lib/scheduler";
import type { SOPState, TimeBlock } from "@/lib/types";
import { CATEGORY_HEX, CATEGORY_COLORS } from "@/lib/types";
import {
  Flame,
  TrendingUp,
  Clock,
  Zap,
  CheckCircle2,
  SkipForward,
  ChevronRight,
  Send,
  Loader2,
  MapPin,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatMinutesLeft(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getCurrentBlock(blocks: TimeBlock[], nowMinutes: number) {
  return blocks
    .filter((b) => b.type === "task" && !b.completed && !b.skipped)
    .find((b) => {
      const start = timeToMinutes(b.startTime);
      const end = timeToMinutes(b.endTime);
      return nowMinutes >= start && nowMinutes < end;
    }) ?? null;
}

function getNextBlock(blocks: TimeBlock[], nowMinutes: number) {
  const upcoming = blocks
    .filter((b) => b.type === "task" && !b.completed && !b.skipped)
    .filter((b) => timeToMinutes(b.startTime) > nowMinutes)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return upcoming[0] ?? null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<SOPState | null>(null);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes());
  const [quickInput, setQuickInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = getTodayStr();

  useEffect(() => {
    setState(loadState());
    const interval = setInterval(() => setNowMinutes(getNowMinutes()), 30000);
    return () => clearInterval(interval);
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
      const block = state.timeBlocks.find((b) => b.id === blockId);
      let newTasks = state.tasks;
      if (block?.taskId) {
        newTasks = state.tasks.map((t) =>
          t.id === block.taskId
            ? {
                ...t,
                status: "completed" as const,
                lastCompletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
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
          const { blocks: rescheduledBlocks, reducedMinutes } = rescheduleBlock(
            block,
            task,
            state.preferences,
            [...newBlocks]
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
          const addedBlocks = rescheduledBlocks.map((b) => ({ ...b, id: generateId() }));
          update({ ...state, timeBlocks: [...newBlocks, ...addedBlocks], tasks: newTasks });
          return;
        }
      }
      update({ ...state, timeBlocks: newBlocks });
    },
    [state, update]
  );

  const handleQuickSend = useCallback(async () => {
    const msg = quickInput.trim();
    if (!msg || sending) return;
    setSending(true);
    setQuickInput("");
    // Navigate to chat with pre-filled message via query param
    router.push(`/chat?q=${encodeURIComponent(msg)}`);
  }, [quickInput, sending, router]);

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
  const remainingBlocks = taskBlocks.filter((b) => !b.completed && !b.skipped);
  const remainingMinutes = remainingBlocks.reduce((s, b) => s + b.durationMinutes, 0);

  const currentBlock = getCurrentBlock(todayBlocks, nowMinutes);
  const nextBlock = currentBlock ? null : getNextBlock(todayBlocks, nowMinutes);
  const focusBlock = currentBlock ?? nextBlock;
  const isCurrent = !!currentBlock;

  const upcomingBlocks = todayBlocks
    .filter(
      (b) =>
        b.type === "task" &&
        !b.completed &&
        !b.skipped &&
        b.id !== focusBlock?.id &&
        timeToMinutes(b.startTime) >= nowMinutes
    )
    .slice(0, 4);

  const missedBlocks = taskBlocks.filter(
    (b) => !b.completed && !b.skipped && timeToMinutes(b.endTime) < nowMinutes
  );

  const hasContent = todayBlocks.length > 0 || state.tasks.length > 0;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-gray-500 capitalize">{formatDate()}</p>
            <h1 className="text-xl font-bold text-white mt-0.5">{getGreeting()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">racha</div>
              <div className="flex items-center gap-1 justify-end">
                <Flame size={14} className="text-orange-400" />
                <span className="font-bold text-white">{streak}d</span>
              </div>
            </div>
            <RingProgress
              value={completionPct}
              size={52}
              stroke={5}
              color={completionPct >= 70 ? "#22c55e" : completionPct >= 40 ? "#f59e0b" : "#6366f1"}
              label={`${completionPct}%`}
            />
          </div>
        </div>

        {!hasContent ? (
          /* ── Empty state ── */
          <div className="glass rounded-2xl p-8 text-center mb-5">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap size={24} className="text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-white mb-1">Tu día está vacío</h2>
            <p className="text-gray-400 text-sm mb-5 max-w-xs mx-auto">
              Cuéntame qué necesitas hacer hoy y lo organizo automáticamente.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Abrir chat <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            {/* ── Focus Card: Ahora / Próximo ── */}
            {focusBlock && (
              <FocusCard
                block={focusBlock}
                task={state.tasks.find((t) => t.id === focusBlock.taskId)}
                isCurrent={isCurrent}
                nowMinutes={nowMinutes}
                onComplete={completeBlock}
                onSkip={skipBlock}
              />
            )}

            {/* All done */}
            {!focusBlock && completedCount === totalCount && totalCount > 0 && (
              <div className="glass rounded-2xl p-6 text-center mb-4">
                <div className="text-3xl mb-2">🔥</div>
                <p className="font-bold text-white">¡Día completo!</p>
                <p className="text-gray-400 text-sm mt-1">
                  {totalCount} tareas · {streak} días de racha
                </p>
              </div>
            )}

            {/* Missed blocks warning */}
            {missedBlocks.length > 0 && (
              <div className="glass rounded-xl p-3 mb-3 flex items-center gap-2.5 border border-red-500/20">
                <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-gray-300 flex-1">
                  <span className="text-red-400 font-medium">{missedBlocks.length} tarea{missedBlocks.length > 1 ? "s" : ""} sin ejecutar.</span>
                  {" "}Se reagendarán automáticamente.
                </p>
              </div>
            )}

            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{completedCount}/{totalCount}</div>
                <div className="text-xs text-gray-500">hoy</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="flex items-center gap-1 justify-center">
                  <TrendingUp size={12} className="text-green-400" />
                  <span className="text-lg font-bold text-white">{weekRate}%</span>
                </div>
                <div className="text-xs text-gray-500">7 días</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="flex items-center gap-1 justify-center">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-lg font-bold text-white">{formatMinutesLeft(remainingMinutes)}</span>
                </div>
                <div className="text-xs text-gray-500">restante</div>
              </div>
            </div>

            {/* ── Upcoming blocks ── */}
            {upcomingBlocks.length > 0 && (
              <div className="glass rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Próximas</p>
                <div className="space-y-2">
                  {upcomingBlocks.map((block) => {
                    const task = state.tasks.find((t) => t.id === block.taskId);
                    const color = task?.category ? CATEGORY_HEX[task.category] : "#6366f1";
                    const minsUntil = timeToMinutes(block.startTime) - nowMinutes;
                    return (
                      <div
                        key={block.id}
                        className="flex items-center gap-3"
                        style={{ borderLeft: `2px solid ${color}40` }}
                      >
                        <div className="pl-3 flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{block.title}</p>
                          <p className="text-xs text-gray-500">
                            {block.startTime} · {block.durationMinutes} min
                            {minsUntil <= 30 && (
                              <span className="text-yellow-500 ml-1">· en {minsUntil} min</span>
                            )}
                          </p>
                        </div>
                        {task?.category && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${CATEGORY_COLORS[task.category]}`}>
                            {task.category}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {remainingBlocks.length > upcomingBlocks.length + (focusBlock ? 1 : 0) && (
                  <Link href="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 block text-right">
                    Ver agenda completa →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Quick capture ── */}
        <div className="glass rounded-xl p-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickSend()}
            placeholder="¿Qué necesito agregar? → al chat"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
          {sending ? (
            <Loader2 size={16} className="text-indigo-400 animate-spin flex-shrink-0" />
          ) : (
            <button
              onClick={handleQuickSend}
              disabled={!quickInput.trim()}
              className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Focus Card Component ── */
function FocusCard({
  block,
  task,
  isCurrent,
  nowMinutes,
  onComplete,
  onSkip,
}: {
  block: TimeBlock;
  task: ReturnType<SOPState["tasks"]["find"]>;
  isCurrent: boolean;
  nowMinutes: number;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const color = task?.category ? CATEGORY_HEX[task.category] : "#6366f1";
  const startMins = timeToMinutes(block.startTime);
  const endMins = timeToMinutes(block.endTime);

  const minsUntilStart = startMins - nowMinutes;
  const minsElapsed = nowMinutes - startMins;
  const progressPct = isCurrent
    ? Math.min(100, Math.round((minsElapsed / block.durationMinutes) * 100))
    : 0;

  let statusLabel = "";
  let statusColor = "text-gray-400";
  if (isCurrent) {
    const minsLeft = endMins - nowMinutes;
    statusLabel = `En progreso · ${minsLeft} min restantes`;
    statusColor = "text-green-400";
  } else if (minsUntilStart <= 15) {
    statusLabel = `Empieza en ${minsUntilStart} min`;
    statusColor = "text-yellow-400";
  } else {
    statusLabel = `Próxima · ${block.startTime}`;
    statusColor = "text-gray-400";
  }

  return (
    <div
      className="rounded-2xl p-5 mb-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}14, ${color}06)`,
        border: `1px solid ${color}30`,
      }}
    >
      {/* Progress bar at top */}
      {isCurrent && (
        <div className="absolute top-0 left-0 h-0.5 bg-white/10 w-full">
          <div
            className="h-full transition-all duration-1000"
            style={{ width: `${progressPct}%`, background: color }}
          />
        </div>
      )}

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: isCurrent ? `0 0 6px ${color}` : "none" }}
        />
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        {task?.category && (
          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[task.category]}`}>
            {task.category}
          </span>
        )}
      </div>

      {/* Task title */}
      <h2 className="text-xl font-bold text-white mb-1 leading-tight">{block.title}</h2>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={11} />
          {block.startTime} – {block.endTime}
        </span>
        <span className="text-xs text-gray-500">{block.durationMinutes} min</span>
        {task?.hasLocation && task.location && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={11} />
            {task.location}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onComplete(block.id)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: `${color}20`, color }}
        >
          <CheckCircle2 size={15} />
          Hecho
        </button>
        <button
          onClick={() => onSkip(block.id)}
          className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-1.5"
        >
          <SkipForward size={14} />
          Omitir
        </button>
      </div>
    </div>
  );
}
