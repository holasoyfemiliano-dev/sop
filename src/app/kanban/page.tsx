"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import type { SOPState, Task, TaskStatus, TaskPriority } from "@/lib/types";
import {
  STATUS_LABELS, KANBAN_COLUMNS, PRIORITY_COLORS, PROJECT_COLORS,
} from "@/lib/types";
import { Plus, Check, ChevronDown, Trash2, ArrowRight, X } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY_MAX = 3;

function priorityDot(priority: TaskPriority) {
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
      style={{ background: PRIORITY_COLORS[priority] }}
    />
  );
}

// ── MoveMenu ──────────────────────────────────────────────────────────────────

function MoveMenu({
  current,
  todayCount,
  onMove,
  onClose,
}: {
  current: TaskStatus;
  todayCount: number;
  onMove: (s: TaskStatus) => void;
  onClose: () => void;
}) {
  const cols = KANBAN_COLUMNS.filter((c) => c !== current && c !== "cancelled");
  return (
    <div
      className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-xl"
      style={{ background: "#0D1035", border: "1px solid rgba(35,14,255,0.3)", minWidth: 160 }}
    >
      {cols.map((col) => {
        const blocked = col === "today" && todayCount >= TODAY_MAX;
        return (
          <button
            key={col}
            disabled={blocked}
            onClick={() => { onMove(col); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
            style={{
              color: blocked ? "#3D4466" : "#EAEBEF",
              cursor: blocked ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!blocked) (e.currentTarget as HTMLButtonElement).style.background = "rgba(35,14,255,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <ArrowRight size={13} style={{ color: blocked ? "#3D4466" : "#230EFF" }} />
            {STATUS_LABELS[col]}
            {blocked && <span className="text-xs ml-auto" style={{ color: "#3D4466" }}>3/3</span>}
          </button>
        );
      })}
      <button
        onClick={onClose}
        className="w-full text-left px-4 py-2.5 text-sm border-t"
        style={{ color: "#818BA6", borderColor: "rgba(35,14,255,0.15)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(35,14,255,0.1)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        Cancelar
      </button>
    </div>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  projects,
  todayCount,
  onMove,
  onDelete,
  onDone,
}: {
  task: Task;
  projects: SOPState["projects"];
  todayCount: number;
  onMove: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onDone: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const project = projects.find((p) => p.id === task.projectId);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="rounded-xl px-4 py-3 mb-2"
      style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.15)" }}
    >
      <div className="flex items-start gap-2.5">
        {/* Done button */}
        <button
          onClick={() => onDone(task.id)}
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all"
          style={{
            borderColor: task.status === "done" ? "#230EFF" : "rgba(35,14,255,0.3)",
            background: task.status === "done" ? "#230EFF" : "transparent",
          }}
        >
          {task.status === "done" && <Check size={10} style={{ color: "#EAEBEF" }} />}
        </button>

        {/* Content */}
        <Link href={`/task/${task.id}`} className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-snug"
            style={{
              color: task.status === "done" ? "#3D4466" : "#EAEBEF",
              textDecoration: task.status === "done" ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {priorityDot(task.priority)}
            {project && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${project.color}20`, color: project.color, border: `1px solid ${project.color}40` }}
              >
                {project.name}
              </span>
            )}
            {task.scheduledDate && (
              <span className="text-xs" style={{ color: "#3D4466" }}>
                {task.scheduledDate === getTodayStr() ? "Hoy" : task.scheduledDate}
                {task.scheduledStart ? ` · ${task.scheduledStart}` : ""}
              </span>
            )}
            {task.dueDate && !task.scheduledDate && (
              <span className="text-xs" style={{ color: "#818BA6" }}>
                Límite {task.dueDate}
              </span>
            )}
          </div>
        </Link>

        {/* Menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#3D4466" }}
          >
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-xl"
              style={{ background: "#0D1035", border: "1px solid rgba(35,14,255,0.3)", minWidth: 160 }}
            >
              <div className="py-1">
                <div
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#3D4466" }}
                >
                  Mover a
                </div>
                {KANBAN_COLUMNS.filter((c) => c !== task.status && c !== "cancelled").map((col) => {
                  const blocked = col === "today" && todayCount >= TODAY_MAX;
                  return (
                    <button
                      key={col}
                      disabled={blocked}
                      onClick={() => { onMove(task.id, col); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2"
                      style={{ color: blocked ? "#3D4466" : "#EAEBEF" }}
                    >
                      <ArrowRight size={12} style={{ color: blocked ? "#3D4466" : "#230EFF" }} />
                      {STATUS_LABELS[col]}
                      {blocked && <span className="text-xs ml-auto" style={{ color: "#3D4466" }}>3/3</span>}
                    </button>
                  );
                })}
                <div className="border-t my-1" style={{ borderColor: "rgba(35,14,255,0.15)" }} />
                <button
                  onClick={() => { onDelete(task.id); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2"
                  style={{ color: "#FF3B3B" }}
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── QuickAdd ──────────────────────────────────────────────────────────────────

function QuickAdd({
  activeColumn,
  todayCount,
  onAdd,
}: {
  activeColumn: TaskStatus;
  todayCount: number;
  onAdd: (title: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    if (activeColumn === "today" && todayCount >= TODAY_MAX) {
      setError("Ya tienes 3 tareas hoy. Mueve o completa una primero.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    onAdd(value.trim());
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="px-4 pb-safe">
      {error && (
        <p className="text-xs mb-2 px-1" style={{ color: "#FF3B3B" }}>{error}</p>
      )}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3"
        style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)" }}
      >
        <Plus size={15} style={{ color: "#3D4466" }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={`Agregar en ${STATUS_LABELS[activeColumn]}…`}
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: "#EAEBEF" }}
        />
        {value.trim() && (
          <button
            onClick={submit}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "#230EFF" }}
          >
            <ArrowRight size={13} style={{ color: "#EAEBEF" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-slide-up"
      style={{
        background: "rgba(255,59,59,0.9)",
        color: "#EAEBEF",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
      }}
    >
      {msg}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [activeCol, setActiveCol] = useState<TaskStatus>("today");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setState(loadState()); }, []);

  const update = useCallback((s: SOPState) => { setState(s); saveState(s); }, []);

  const todayCount = state?.tasks.filter((t) => t.status === "today").length ?? 0;

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    if (!state) return;
    if (status === "today" && todayCount >= TODAY_MAX) {
      setToast("Ya tienes 3 tareas en '3 de hoy'. Completa o mueve una primero.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const now = new Date().toISOString();
    update({
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status, updatedAt: now } : t
      ),
    });
  }, [state, todayCount, update]);

  const doneTask = useCallback((id: string) => {
    if (!state) return;
    const now = new Date().toISOString();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus = task.status === "done" ? "today" : "done";
    if (newStatus === "today" && todayCount >= TODAY_MAX) {
      setToast("Ya tienes 3 tareas en '3 de hoy'.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    update({
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: newStatus, updatedAt: now, completedAt: newStatus === "done" ? now : undefined }
          : t
      ),
    });
  }, [state, todayCount, update]);

  const deleteTask = useCallback((id: string) => {
    if (!state) return;
    update({
      ...state,
      tasks: state.tasks.filter((t) => t.id !== id),
      steps: state.steps.filter((s) => s.taskId !== id),
    });
  }, [state, update]);

  const addTask = useCallback((title: string) => {
    if (!state) return;
    if (activeCol === "today" && todayCount >= TODAY_MAX) {
      setToast("Ya tienes 3 tareas en '3 de hoy'. Completa o mueve una primero.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const now = new Date().toISOString();
    const newTask: Task = {
      id: generateId(),
      title,
      status: activeCol,
      priority: "medium",
      urgency: activeCol === "today" ? "high" : "medium",
      importance: activeCol === "today" ? "high" : "medium",
      source: "manual",
      createdAt: now,
      updatedAt: now,
      scheduledDate: activeCol === "today" ? getTodayStr() : undefined,
    };
    update({ ...state, tasks: [newTask, ...state.tasks] });
  }, [state, activeCol, todayCount, update]);

  if (!state) return null;

  const colTasks = state.tasks.filter((t) => t.status === activeCol);

  const todayActive = state.tasks.filter((t) => t.status === "today").length;

  return (
    <div className="min-h-screen flex flex-col pb-32 md:pb-4 md:pt-14 proximity-gradient">
      {toast && <Toast msg={toast} />}
      <Nav />

      {/* Column tabs */}
      <div className="sticky top-0 md:top-14 z-40 px-4 pt-4 pb-2" style={{ background: "rgba(8,11,18,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {KANBAN_COLUMNS.map((col) => {
            const count = state.tasks.filter((t) => t.status === col).length;
            const active = col === activeCol;
            const isToday = col === "today";
            const full = isToday && count >= TODAY_MAX;
            return (
              <button
                key={col}
                onClick={() => setActiveCol(col)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? "#230EFF" : "rgba(13,16,53,0.8)",
                  color: active ? "#EAEBEF" : "#818BA6",
                  border: active ? "1px solid rgba(35,14,255,0.5)" : "1px solid rgba(35,14,255,0.15)",
                }}
              >
                {STATUS_LABELS[col]}
                {count > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: active ? "rgba(255,255,255,0.2)" : full ? "rgba(255,59,59,0.2)" : "rgba(35,14,255,0.2)",
                      color: active ? "#EAEBEF" : full ? "#FF3B3B" : "#818BA6",
                    }}
                  >
                    {isToday ? `${count}/${TODAY_MAX}` : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* "3 de hoy" special header */}
      {activeCol === "today" && (
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base" style={{ color: "#EAEBEF" }}>Foco del día</h2>
            <p className="text-xs mt-0.5" style={{ color: "#818BA6" }}>
              {todayActive === 0
                ? "Elige tus 3 tareas más importantes de hoy"
                : todayActive >= TODAY_MAX
                ? "Máximo alcanzado. Completa una para agregar otra."
                : `${TODAY_MAX - todayActive} espacio${TODAY_MAX - todayActive !== 1 ? "s" : ""} disponible${TODAY_MAX - todayActive !== 1 ? "s" : ""}`}
            </p>
          </div>
          <span className="text-2xl font-black" style={{ color: todayActive >= TODAY_MAX ? "#FF3B3B" : "#230EFF" }}>
            {todayActive}/{TODAY_MAX}
          </span>
        </div>
      )}

      {/* Column header for other cols */}
      {activeCol !== "today" && (
        <div className="px-4 pt-3 pb-2">
          <h2 className="font-bold text-base" style={{ color: "#EAEBEF" }}>{STATUS_LABELS[activeCol]}</h2>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 px-4 overflow-y-auto">
        {colTasks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "#3D4466" }}>
              {activeCol === "backlog"
                ? "Sin ideas capturadas. Agrega lo que tengas en mente."
                : activeCol === "today"
                ? "Agrega tus 3 tareas más importantes del día."
                : "Sin tareas en esta columna."}
            </p>
          </div>
        ) : (
          colTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={state.projects}
              todayCount={todayActive}
              onMove={moveTask}
              onDelete={deleteTask}
              onDone={doneTask}
            />
          ))
        )}
      </div>

      {/* Quick add — sticks above bottom nav */}
      <div
        className="sticky bottom-20 md:bottom-0 z-40 mt-auto pt-2"
        style={{ background: "rgba(8,11,18,0.9)", backdropFilter: "blur(12px)" }}
      >
        <QuickAdd activeColumn={activeCol} todayCount={todayActive} onAdd={addTask} />
      </div>
    </div>
  );
}
