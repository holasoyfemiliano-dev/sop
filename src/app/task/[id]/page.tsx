"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Nav from "@/components/Nav";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import type { SOPState, Task, Step, TaskStatus, TaskPriority, LevelValue } from "@/lib/types";
import {
  STATUS_LABELS, KANBAN_COLUMNS, PRIORITY_LABELS, PRIORITY_COLORS, PROJECT_COLORS,
} from "@/lib/types";
import {
  ArrowLeft, Check, Plus, Trash2, Calendar, Clock,
  ChevronDown, Circle, CheckCircle2, AlertCircle,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY_MAX = 3;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#3D4466" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  colorFn,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  colorFn?: (v: T) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none"
      style={{
        background: "rgba(13,16,53,0.9)",
        border: "1px solid rgba(35,14,255,0.2)",
        color: colorFn ? colorFn(value) : "#EAEBEF",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#0D1035" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepItem({
  step,
  onToggle,
  onDelete,
  onRename,
}: {
  step: Step;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(step.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    if (val.trim()) onRename(step.id, val.trim());
    else setVal(step.title);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: "rgba(35,14,255,0.08)" }}>
      <button
        onClick={() => onToggle(step.id)}
        className="flex-shrink-0 transition-all"
        style={{ color: step.status === "done" ? "#230EFF" : "#3D4466" }}
      >
        {step.status === "done" ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      {editing ? (
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(step.title); setEditing(false); } }}
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: "#EAEBEF", borderBottom: "1px solid rgba(35,14,255,0.4)" }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className="flex-1 text-sm cursor-text"
          style={{
            color: step.status === "done" ? "#3D4466" : "#EAEBEF",
            textDecoration: step.status === "done" ? "line-through" : "none",
          }}
        >
          {step.title}
        </span>
      )}
      <button onClick={() => onDelete(step.id)} className="flex-shrink-0 p-1" style={{ color: "#3D4466" }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.id as string;

  const [state, setState] = useState<SOPState | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [newStep, setNewStep] = useState("");
  const [newStepOpen, setNewStepOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [limitError, setLimitError] = useState(false);
  const newStepRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadState();
    setState(s);
    const found = s.tasks.find((t) => t.id === taskId);
    if (!found) { router.replace("/kanban"); return; }
    setTask(found);
    setSteps(s.steps.filter((st) => st.taskId === taskId).sort((a, b) => a.order - b.order));
  }, [taskId, router]);

  useEffect(() => {
    if (newStepOpen) newStepRef.current?.focus();
  }, [newStepOpen]);

  const persist = useCallback((updatedTask: Task, updatedSteps: Step[]) => {
    if (!state) return;
    const newState: SOPState = {
      ...state,
      tasks: state.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      steps: [
        ...state.steps.filter((s) => s.taskId !== updatedTask.id),
        ...updatedSteps,
      ],
    };
    setState(newState);
    saveState(newState);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [state]);

  const updateTask = useCallback((patch: Partial<Task>) => {
    if (!task || !state) return;
    // Enforce "today" limit
    if (patch.status === "today") {
      const todayCount = state.tasks.filter((t) => t.status === "today" && t.id !== task.id).length;
      if (todayCount >= TODAY_MAX) {
        setLimitError(true);
        setTimeout(() => setLimitError(false), 3000);
        return;
      }
    }
    const updated = { ...task, ...patch, updatedAt: new Date().toISOString() };
    if (patch.status === "done" && !task.completedAt) updated.completedAt = new Date().toISOString();
    if (patch.status !== "done") updated.completedAt = undefined;
    setTask(updated);
    persist(updated, steps);
  }, [task, state, steps, persist]);

  const toggleStep = useCallback((id: string) => {
    if (!task) return;
    const updated = steps.map((s) =>
      s.id === id ? { ...s, status: s.status === "done" ? "pending" : "done" as Step["status"] } : s
    );
    setSteps(updated);
    persist(task, updated);
  }, [task, steps, persist]);

  const renameStep = useCallback((id: string, title: string) => {
    if (!task) return;
    const updated = steps.map((s) => s.id === id ? { ...s, title } : s);
    setSteps(updated);
    persist(task, updated);
  }, [task, steps, persist]);

  const deleteStep = useCallback((id: string) => {
    if (!task) return;
    const updated = steps.filter((s) => s.id !== id);
    setSteps(updated);
    persist(task, updated);
  }, [task, steps, persist]);

  const addStep = () => {
    if (!newStep.trim() || !task) return;
    const step: Step = {
      id: generateId(),
      taskId: task.id,
      title: newStep.trim(),
      status: "pending",
      order: steps.length,
    };
    const updated = [...steps, step];
    setSteps(updated);
    persist(task, updated);
    setNewStep("");
    newStepRef.current?.focus();
  };

  const deleteTask = () => {
    if (!state || !task) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    saveState({
      ...state,
      tasks: state.tasks.filter((t) => t.id !== task.id),
      steps: state.steps.filter((s) => s.taskId !== task.id),
    });
    router.replace("/kanban");
  };

  if (!task) return null;

  const completedSteps = steps.filter((s) => s.status === "done").length;

  const statusOptions = KANBAN_COLUMNS.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  const priorityOptions: { value: TaskPriority; label: string }[] = [
    { value: "low", label: "Baja" },
    { value: "medium", label: "Media" },
    { value: "high", label: "Alta" },
    { value: "critical", label: "Crítica" },
  ];
  const levelOptions: { value: LevelValue; label: string }[] = [
    { value: "low", label: "Baja" },
    { value: "medium", label: "Media" },
    { value: "high", label: "Alta" },
  ];

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pt-14 proximity-gradient">
      {limitError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-slide-up"
          style={{ background: "rgba(255,59,59,0.9)", color: "#EAEBEF", backdropFilter: "blur(12px)" }}
        >
          Ya tienes 3 tareas en &ldquo;3 de hoy&rdquo;. Completa o mueve una primero.
        </div>
      )}
      <Nav />

      {/* Header */}
      <div
        className="sticky top-0 md:top-14 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(8,11,18,0.95)", backdropFilter: "blur(16px)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "#818BA6" }}
        >
          <ArrowLeft size={16} /> Kanban
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs flex items-center gap-1" style={{ color: "#22c55e" }}>
              <Check size={12} /> Guardado
            </span>
          )}
          <button onClick={deleteTask} className="p-2 rounded-lg" style={{ color: "#FF3B3B" }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        {/* Title */}
        <div>
          <textarea
            value={task.title}
            onChange={(e) => updateTask({ title: e.target.value })}
            className="w-full bg-transparent text-xl font-bold resize-none focus:outline-none leading-snug"
            style={{ color: "#EAEBEF" }}
            rows={2}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado">
            <Select
              value={task.status}
              options={statusOptions}
              onChange={(v) => updateTask({ status: v })}
            />
          </Field>
          <Field label="Prioridad">
            <Select
              value={task.priority}
              options={priorityOptions}
              onChange={(v) => updateTask({ priority: v })}
              colorFn={(v) => PRIORITY_COLORS[v]}
            />
          </Field>
        </div>

        {/* Project */}
        <Field label="Proyecto">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateTask({ projectId: undefined })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: !task.projectId ? "#230EFF" : "rgba(13,16,53,0.9)",
                color: !task.projectId ? "#EAEBEF" : "#818BA6",
                border: "1px solid rgba(35,14,255,0.2)",
              }}
            >
              Sin proyecto
            </button>
            {state?.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => updateTask({ projectId: p.id })}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: task.projectId === p.id ? `${p.color}25` : "rgba(13,16,53,0.9)",
                  color: task.projectId === p.id ? p.color : "#818BA6",
                  border: `1px solid ${task.projectId === p.id ? p.color + "60" : "rgba(35,14,255,0.2)"}`,
                }}
              >
                {p.name}
              </button>
            ))}
            <NewProjectButton
              onAdd={(name, color) => {
                if (!state) return;
                const proj = { id: generateId(), name, color, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                const ns = { ...state, projects: [...state.projects, proj] };
                setState(ns);
                saveState(ns);
                updateTask({ projectId: proj.id });
              }}
            />
          </div>
        </Field>

        {/* Schedule */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(13,16,53,0.8)", border: "1px solid rgba(35,14,255,0.15)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "#3D4466" }}>
            <Calendar size={13} /> Programación
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                value={task.scheduledDate ?? ""}
                onChange={(e) => updateTask({ scheduledDate: e.target.value || undefined })}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", color: "#EAEBEF" }}
              />
            </Field>
            <Field label="Fecha límite">
              <input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) => updateTask({ dueDate: e.target.value || undefined })}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", color: "#EAEBEF" }}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora inicio">
              <input
                type="time"
                value={task.scheduledStart ?? ""}
                onChange={(e) => updateTask({ scheduledStart: e.target.value || undefined })}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", color: "#EAEBEF" }}
              />
            </Field>
            <Field label="Hora fin">
              <input
                type="time"
                value={task.scheduledEnd ?? ""}
                onChange={(e) => updateTask({ scheduledEnd: e.target.value || undefined })}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", color: "#EAEBEF" }}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración (min)">
              <input
                type="number"
                value={task.estimatedMinutes ?? ""}
                onChange={(e) => updateTask({ estimatedMinutes: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="60"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", color: "#EAEBEF" }}
              />
            </Field>
            <Field label="Multi-día">
              <button
                onClick={() => updateTask({ requiresMultipleDays: !task.requiresMultipleDays })}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium flex items-center gap-2 transition-all"
                style={{
                  background: task.requiresMultipleDays ? "rgba(35,14,255,0.2)" : "rgba(13,16,53,0.9)",
                  border: `1px solid ${task.requiresMultipleDays ? "rgba(35,14,255,0.5)" : "rgba(35,14,255,0.2)"}`,
                  color: task.requiresMultipleDays ? "#EAEBEF" : "#818BA6",
                }}
              >
                {task.requiresMultipleDays ? <Check size={13} /> : <Circle size={13} />}
                {task.requiresMultipleDays ? "Sí" : "No"}
              </button>
            </Field>
          </div>
        </div>

        {/* Urgency / Importance */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urgencia">
            <Select value={task.urgency} options={levelOptions} onChange={(v) => updateTask({ urgency: v })} />
          </Field>
          <Field label="Importancia">
            <Select value={task.importance} options={levelOptions} onChange={(v) => updateTask({ importance: v })} />
          </Field>
        </div>

        {/* Notes */}
        <Field label="Descripción / Notas">
          <textarea
            value={task.notes ?? ""}
            onChange={(e) => updateTask({ notes: e.target.value || undefined })}
            placeholder="Agrega contexto, links, notas…"
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{
              background: "rgba(13,16,53,0.9)",
              border: "1px solid rgba(35,14,255,0.2)",
              color: "#EAEBEF",
            }}
          />
        </Field>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "#3D4466" }}>
              <Check size={13} />
              Pasos
              {steps.length > 0 && (
                <span className="font-normal" style={{ color: "#3D4466" }}>
                  {completedSteps}/{steps.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => setNewStepOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: "rgba(35,14,255,0.15)",
                color: "#230EFF",
                border: "1px solid rgba(35,14,255,0.3)",
              }}
            >
              <Plus size={12} /> Agregar paso
            </button>
          </div>

          {steps.length > 0 && (
            <div className="rounded-xl px-4" style={{ background: "rgba(13,16,53,0.8)", border: "1px solid rgba(35,14,255,0.15)" }}>
              {steps.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  onToggle={toggleStep}
                  onDelete={deleteStep}
                  onRename={renameStep}
                />
              ))}
            </div>
          )}

          {newStepOpen && (
            <div
              className="mt-2 flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.3)" }}
            >
              <Circle size={15} style={{ color: "#3D4466" }} />
              <input
                ref={newStepRef}
                type="text"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addStep();
                  if (e.key === "Escape") { setNewStepOpen(false); setNewStep(""); }
                }}
                placeholder="Nombre del paso…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: "#EAEBEF" }}
              />
              <button
                onClick={addStep}
                disabled={!newStep.trim()}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                style={{ background: "#230EFF", color: "#EAEBEF" }}
              >
                Agregar
              </button>
            </div>
          )}
        </div>

        {/* Mark done / Move actions */}
        <div className="flex gap-3 pt-2 pb-4">
          <button
            onClick={() => updateTask({ status: task.status === "done" ? "today" : "done" })}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98"
            style={{
              background: task.status === "done" ? "rgba(35,14,255,0.15)" : "#230EFF",
              color: "#EAEBEF",
              border: task.status === "done" ? "1px solid rgba(35,14,255,0.3)" : "none",
            }}
          >
            <Check size={15} />
            {task.status === "done" ? "Reactivar tarea" : "Marcar como hecha"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NewProjectButton ──────────────────────────────────────────────────────────

function NewProjectButton({ onAdd }: { onAdd: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), color);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5"
        style={{ background: "rgba(13,16,53,0.9)", color: "#3D4466", border: "1px solid rgba(35,14,255,0.15)" }}
      >
        <Plus size={11} /> Nuevo
      </button>
    );
  }

  return (
    <div
      className="w-full rounded-xl p-3 mt-1 space-y-2"
      style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.3)" }}
    >
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Nombre del proyecto…"
        className="w-full bg-transparent text-sm focus:outline-none"
        style={{ color: "#EAEBEF" }}
      />
      <div className="flex gap-2 flex-wrap">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full transition-all"
            style={{
              background: c,
              outline: color === c ? `2px solid ${c}` : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 text-xs py-1.5 rounded-lg" style={{ color: "#818BA6" }}>
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 text-xs py-1.5 rounded-lg font-medium disabled:opacity-40"
          style={{ background: "#230EFF", color: "#EAEBEF" }}
        >
          Crear
        </button>
      </div>
    </div>
  );
}
