"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import {
  loadState,
  saveState,
  generateId,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  PRIORITY_COLORS,
  type SOPState,
  type Goal,
  type DailyAction,
  type Category,
  type Priority,
  type Frequency,
} from "@/lib/store";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";

const categories: Category[] = ["negocio", "salud", "aprendizaje", "relaciones", "finanzas", "personal"];
const priorities: Priority[] = ["alta", "media", "baja"];
const frequencies: Frequency[] = ["diario", "semanal", "mensual"];

const SUGGESTED_ACTIONS: Record<Category, string[]> = {
  negocio: ["Publicar 1 pieza de contenido", "Responder DMs y comentarios", "Grabar 1 video o reel", "Revisar métricas del negocio", "Prospectar 5 nuevos leads"],
  salud: ["Ejercicio 30 min", "Meditar 10 min", "Tomar suficiente agua", "Dormir 7-8 horas", "Preparar comida saludable"],
  aprendizaje: ["Leer 20 páginas", "Ver 1 video educativo", "Practicar habilidad específica", "Tomar notas de aprendizaje", "Revisar flashcards"],
  relaciones: ["Conectar con 1 persona clave", "Responder mensajes pendientes", "Llamar a familiar o amigo", "Asistir a evento networking", "Agradecer a alguien"],
  finanzas: ["Revisar gastos del día", "Actualizar registro de ingresos", "Estudiar 1 concepto financiero", "Revisar inversiones", "Buscar nueva fuente de ingreso"],
  personal: ["Journaling 10 min", "Planificar el día siguiente", "Revisar metas semanales", "Celebrar un logro del día", "Desconectarse 30 min"],
};

function GoalCard({
  goal,
  actions,
  onDeleteGoal,
  onToggleGoal,
  onAddAction,
  onDeleteAction,
}: {
  goal: Goal;
  actions: DailyAction[];
  onDeleteGoal: (id: string) => void;
  onToggleGoal: (id: string) => void;
  onAddAction: (action: Omit<DailyAction, "id">) => void;
  onDeleteAction: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [frequency, setFrequency] = useState<Frequency>("diario");

  const submit = () => {
    if (!title.trim()) return;
    onAddAction({ goalId: goal.id, title: title.trim(), duration, time, priority, frequency });
    setTitle("");
    setDuration(30);
    setTime("");
    setPriority("media");
    setFrequency("diario");
    setShowForm(false);
  };

  return (
    <div className={`glass rounded-2xl overflow-hidden transition-all ${!goal.active ? "opacity-50" : ""}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button onClick={() => onToggleGoal(goal.id)} className="mt-0.5 flex-shrink-0">
              {goal.active ? (
                <CheckCircle2 size={20} className="text-green-400" />
              ) : (
                <Circle size={20} className="text-gray-600" />
              )}
            </button>
            <div className="min-w-0">
              <h3 className="font-semibold text-white">{goal.title}</h3>
              {goal.description && (
                <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{goal.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[goal.category]}`}>
                  {CATEGORY_LABELS[goal.category]}
                </span>
                <span className={`text-xs font-medium ${PRIORITY_COLORS[goal.priority]}`}>
                  {goal.priority}
                </span>
                {goal.deadline && (
                  <span className="text-xs text-gray-500">hasta {goal.deadline}</span>
                )}
                <span className="text-xs text-gray-500">
                  {actions.length} acciones
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <button
              onClick={() => onDeleteGoal(goal.id)}
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/6 px-5 pb-5">
          {/* Actions list */}
          {actions.length > 0 && (
            <div className="mt-4 space-y-2">
              {actions.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 px-3 bg-white/3 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{a.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> {a.duration} min
                      </span>
                      <span className="text-xs text-gray-500">{a.frequency}</span>
                      {a.time && <span className="text-xs text-gray-500">{a.time}</span>}
                      <span className={`text-xs ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteAction(a.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggested actions */}
          {actions.length === 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Acciones sugeridas:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_ACTIONS[goal.category].map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      onAddAction({ goalId: goal.id, title: s, duration: 30, priority: "media", frequency: "diario" })
                    }
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/8"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add action form */}
          {showForm ? (
            <div className="mt-4 space-y-3 p-4 bg-white/3 rounded-xl">
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                placeholder="Nombre de la acción..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Duración (min)</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    min={5}
                    max={480}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Hora (opcional)</label>
                  <input
                    type="time"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Prioridad</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p} className="bg-gray-900">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Frecuencia</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                  >
                    {frequencies.map((f) => (
                      <option key={f} value={f} className="bg-gray-900">{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Agregar acción
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 text-gray-400 hover:text-white py-2 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus size={16} /> Agregar acción
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [showForm, setShowForm] = useState(false);

  // New goal form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("negocio");
  const [priority, setPriority] = useState<Priority>("alta");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    setState(loadState());
  }, []);

  const update = (s: SOPState) => {
    setState(s);
    saveState(s);
  };

  const addGoal = () => {
    if (!title.trim() || !state) return;
    const goal: Goal = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      deadline,
      active: true,
      createdAt: new Date().toISOString(),
    };
    update({ ...state, goals: [...state.goals, goal] });
    setTitle("");
    setDescription("");
    setCategory("negocio");
    setPriority("alta");
    setDeadline("");
    setShowForm(false);
  };

  const deleteGoal = (id: string) => {
    if (!state) return;
    update({
      ...state,
      goals: state.goals.filter((g) => g.id !== id),
      actions: state.actions.filter((a) => a.goalId !== id),
    });
  };

  const toggleGoal = (id: string) => {
    if (!state) return;
    update({
      ...state,
      goals: state.goals.map((g) => (g.id === id ? { ...g, active: !g.active } : g)),
    });
  };

  const addAction = (action: Omit<DailyAction, "id">) => {
    if (!state) return;
    update({ ...state, actions: [...state.actions, { ...action, id: generateId() }] });
  };

  const deleteAction = (id: string) => {
    if (!state) return;
    update({ ...state, actions: state.actions.filter((a) => a.id !== id) });
  };

  if (!state) return null;

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Mis Metas</h1>
            <p className="text-gray-400 text-sm mt-1">
              {state.goals.filter((g) => g.active).length} metas activas ·{" "}
              {state.actions.length} acciones configuradas
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nueva meta
          </button>
        </div>

        {/* New goal form */}
        {showForm && (
          <div className="glass rounded-2xl p-6 mb-6 glow-blue">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-indigo-400" /> Nueva meta
            </h2>
            <div className="space-y-3">
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                placeholder="¿Qué quieres lograr? (ej: Hacer crecer mi audiencia a 10k)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 text-sm resize-none"
                placeholder="Descripción o contexto (opcional)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-gray-900">{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Prioridad</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p} className="bg-gray-900">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha límite</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={addGoal}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Crear meta
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Goals list */}
        {state.goals.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-gray-400 mb-4">No tienes metas aún. Crea tu primera meta para comenzar.</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-indigo-400 hover:text-indigo-300 text-sm underline"
            >
              Agregar una meta →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {state.goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                actions={state.actions.filter((a) => a.goalId === goal.id)}
                onDeleteGoal={deleteGoal}
                onToggleGoal={toggleGoal}
                onAddAction={addAction}
                onDeleteAction={deleteAction}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
