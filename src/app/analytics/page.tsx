"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import RingProgress from "@/components/RingProgress";
import { loadState, getCompletionRate, getStreak } from "@/lib/store";
import type { SOPState } from "@/lib/types";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_HEX,
  EISENHOWER_LABELS,
  type Category,
  type EisenhowerQuadrant,
} from "@/lib/types";
import { Flame, TrendingUp, Target, Award, Clock, BarChart2, Zap } from "lucide-react";

function getWeeklyData(state: SOPState) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const blocks = state.timeBlocks.filter((b) => b.date === dateStr && b.type === "task");
    const done = blocks.filter((b) => b.completed).length;
    const total = blocks.length;
    return {
      label: d.toLocaleDateString("es-ES", { weekday: "short" }),
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      done,
      total,
    };
  });
}

function getHourlyStats(state: SOPState) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: 0,
    done: 0,
    rate: 0,
  }));
  state.timeBlocks.forEach((b) => {
    if (b.type !== "task") return;
    const h = parseInt(b.startTime.split(":")[0]);
    buckets[h].total++;
    if (b.completed) buckets[h].done++;
  });
  return buckets.map((b) => ({
    ...b,
    rate: b.total > 0 ? Math.round((b.done / b.total) * 100) : 0,
  }));
}

function getCategoryBreakdown(state: SOPState) {
  const cats = [...new Set(state.tasks.map((t) => t.category))] as Category[];
  return cats.map((cat) => {
    const catTasks = state.tasks.filter((t) => t.category === cat);
    const catBlocks = state.timeBlocks.filter(
      (b) => b.type === "task" && catTasks.some((t) => t.id === b.taskId)
    );
    const done = catBlocks.filter((b) => b.completed).length;
    const total = catBlocks.length;
    return {
      category: cat,
      total,
      done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }).sort((a, b) => b.pct - a.pct);
}

function getEisenhowerBreakdown(state: SOPState) {
  const quadrants: EisenhowerQuadrant[] = ["do_first", "schedule", "delegate", "eliminate"];
  return quadrants.map((q) => {
    const tasks = state.tasks.filter((t) => t.eisenhower === q);
    const completed = tasks.filter((t) => t.status === "completed").length;
    return { quadrant: q, total: tasks.length, completed };
  });
}

function getTotalMinutesExecuted(state: SOPState) {
  return state.timeBlocks
    .filter((b) => b.completed && b.type === "task")
    .reduce((s, b) => s + b.durationMinutes, 0);
}

export default function AnalyticsPage() {
  const [state, setState] = useState<SOPState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) return null;

  const rate7 = getCompletionRate(state, 7);
  const rate30 = getCompletionRate(state, 30);
  const streak = getStreak(state);
  const weekData = getWeeklyData(state);
  const hourlyStats = getHourlyStats(state);
  const categoryBreakdown = getCategoryBreakdown(state);
  const eisBreakdown = getEisenhowerBreakdown(state);
  const totalMinutes = getTotalMinutesExecuted(state);
  const maxWeekPct = Math.max(...weekData.map((d) => d.pct), 1);

  const hasData = state.timeBlocks.length > 0;

  // Best hour (most completed)
  const bestHour = hourlyStats
    .filter((h) => h.total >= 2)
    .sort((a, b) => b.rate - a.rate)[0];

  // Worst hour
  const worstHour = hourlyStats
    .filter((h) => h.total >= 2)
    .sort((a, b) => a.rate - b.rate)[0];

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Análisis</h1>
          <p className="text-gray-400 text-sm mt-0.5">Métricas de ejecución y comportamiento</p>
        </div>

        {!hasData ? (
          <div className="glass rounded-2xl p-12 text-center">
            <BarChart2 size={40} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">Aún no hay datos suficientes.</p>
            <p className="text-gray-500 text-sm">Agrega tareas desde el chat y complétalas para ver tu análisis.</p>
          </div>
        ) : (
          <>
            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="glass rounded-xl p-4 text-center">
                <Flame size={18} className="text-orange-400 mx-auto mb-1.5" />
                <div className="text-3xl font-bold text-white">{streak}</div>
                <div className="text-xs text-gray-400 mt-0.5">racha</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <TrendingUp size={18} className="text-green-400 mx-auto mb-1.5" />
                <div className="text-3xl font-bold text-white">{rate7}%</div>
                <div className="text-xs text-gray-400 mt-0.5">7 días</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Target size={18} className="text-blue-400 mx-auto mb-1.5" />
                <div className="text-3xl font-bold text-white">{rate30}%</div>
                <div className="text-xs text-gray-400 mt-0.5">30 días</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Clock size={18} className="text-purple-400 mx-auto mb-1.5" />
                <div className="text-3xl font-bold text-white">
                  {totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">ejecutadas</div>
              </div>
            </div>

            {/* Weekly bar */}
            <div className="glass rounded-xl p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-400 mb-4">Esta semana</h2>
              <div className="flex items-end gap-2 h-24">
                {weekData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">{d.pct > 0 ? `${d.pct}%` : ""}</span>
                    <div
                      className={`w-full rounded-md transition-all ${
                        d.pct >= 80 ? "bg-green-500" : d.pct >= 50 ? "bg-yellow-500" : d.pct > 0 ? "bg-indigo-500" : "bg-white/5"
                      }`}
                      style={{ height: `${Math.max((d.pct / maxWeekPct) * 72, d.pct > 0 ? 6 : 3)}px` }}
                    />
                    <span className="text-xs text-gray-500 capitalize">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly performance (only show active hours) */}
            {hourlyStats.some((h) => h.total > 0) && (
              <div className="glass rounded-xl p-5 mb-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-4">
                  Rendimiento por hora del día
                </h2>
                <div className="flex items-end gap-0.5 h-20">
                  {hourlyStats.slice(6, 23).map((h) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-sm transition-all ${
                          h.total === 0
                            ? "bg-white/3"
                            : h.rate >= 70
                            ? "bg-green-500"
                            : h.rate >= 40
                            ? "bg-yellow-500"
                            : "bg-red-500/70"
                        }`}
                        style={{ height: `${h.total > 0 ? Math.max((h.rate / 100) * 64, 4) : 4}px` }}
                        title={`${h.hour}:00 — ${h.done}/${h.total} (${h.rate}%)`}
                      />
                      {h.hour % 3 === 0 && (
                        <span className="text-xs text-gray-600" style={{ fontSize: "9px" }}>{h.hour}h</span>
                      )}
                    </div>
                  ))}
                </div>
                {(bestHour || worstHour) && (
                  <div className="flex gap-4 mt-3">
                    {bestHour && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Mejor hora: <span className="text-green-400 font-medium">{bestHour.hour}:00 ({bestHour.rate}%)</span>
                      </div>
                    )}
                    {worstHour && worstHour.hour !== bestHour?.hour && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Peor hora: <span className="text-red-400 font-medium">{worstHour.hour}:00 ({worstHour.rate}%)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Category breakdown */}
            {categoryBreakdown.length > 0 && (
              <div className="glass rounded-xl p-5 mb-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-4">Por categoría</h2>
                <div className="space-y-3">
                  {categoryBreakdown.map(({ category, pct, done, total }) => (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category]}`}>
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className={`text-sm font-semibold ${pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                          {done}/{total} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: CATEGORY_HEX[category],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Eisenhower matrix */}
            {state.tasks.length > 0 && (
              <div className="glass rounded-xl p-5 mb-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-yellow-400" /> Matriz Eisenhower
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {eisBreakdown.map(({ quadrant, total, completed }) => {
                    const info = EISENHOWER_LABELS[quadrant];
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div key={quadrant} className="bg-white/3 rounded-xl p-3">
                        <p className={`text-xs font-semibold ${info.color}`}>{info.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{info.sub}</p>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-xl font-bold text-white">{total}</span>
                          <span className="text-xs text-gray-500">tareas</span>
                        </div>
                        {total > 0 && (
                          <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-indigo-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Best day */}
            {state.timeBlocks.length > 0 && (() => {
              const byDay = new Map<string, { done: number; total: number }>();
              state.timeBlocks.filter(b => b.type === "task").forEach(b => {
                const e = byDay.get(b.date) ?? { done: 0, total: 0 };
                e.total++;
                if (b.completed) e.done++;
                byDay.set(b.date, e);
              });
              let best = { date: "", pct: 0 };
              byDay.forEach((v, k) => {
                const pct = Math.round((v.done / v.total) * 100);
                if (pct > best.pct) best = { date: k, pct };
              });
              if (!best.date) return null;
              return (
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={16} className="text-yellow-400" />
                    <span className="text-sm font-semibold text-white">Mejor día</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{best.pct}%</p>
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {new Date(best.date + "T12:00:00").toLocaleDateString("es-ES", {
                      weekday: "long", day: "numeric", month: "long"
                    })}
                  </p>
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
