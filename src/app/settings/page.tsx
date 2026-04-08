"use client";
import { useEffect, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import { loadState, saveState, defaultPreferences } from "@/lib/store";
import type { SOPState, UserPreferences, ProtectedBlock } from "@/lib/types";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  Clock,
  Moon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function GCalStatusBanner() {
  const params = useSearchParams();
  const gcalParam = params.get("gcal");
  if (!gcalParam) return null;

  const messages: Record<string, { text: string; type: "success" | "error" }> = {
    connected: { text: "Google Calendar conectado correctamente", type: "success" },
    error: { text: "Error al conectar Google Calendar", type: "error" },
    csrf_error: { text: "Error de seguridad. Intenta de nuevo.", type: "error" },
    token_error: { text: "Error al obtener credenciales. Verifica tu configuración.", type: "error" },
  };

  const msg = messages[gcalParam];
  if (!msg) return null;

  return (
    <div
      className={`glass rounded-xl p-3 mb-4 flex items-center gap-2 text-sm ${
        msg.type === "success" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
      }`}
    >
      {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg.text}
    </div>
  );
}

function SettingsContent() {
  const [state, setState] = useState<SOPState | null>(null);
  const [gcalInfo, setGcalInfo] = useState<{ email?: string; connected?: boolean } | null>(null);
  const [gcalConfigured, setGcalConfigured] = useState(false);

  useEffect(() => {
    setState(loadState());
    fetch("/api/gcal/status")
      .then((r) => r.json())
      .then((data) => {
        setGcalConfigured(data.configured);
        if (data.connected) setGcalInfo({ email: data.email, connected: true });
      })
      .catch(() => {});
  }, []);

  const update = useCallback(
    (prefs: UserPreferences) => {
      if (!state) return;
      const newState = { ...state, preferences: prefs };
      setState(newState);
      saveState(newState);
    },
    [state]
  );

  const disconnectGcal = async () => {
    await fetch("/api/gcal/disconnect", { method: "DELETE" });
    setGcalInfo(null);
    if (state) update({ ...state.preferences, gcal: { connected: false, syncEnabled: false } });
  };

  const addProtectedBlock = () => {
    if (!state) return;
    const newBlock: ProtectedBlock = {
      label: "Bloque protegido",
      startHour: 12,
      startMinute: 0,
      durationMinutes: 60,
      days: [1, 2, 3, 4, 5],
    };
    const prefs = { ...state.preferences };
    prefs.schedule = {
      ...prefs.schedule,
      protectedBlocks: [...prefs.schedule.protectedBlocks, newBlock],
    };
    update(prefs);
  };

  const removeProtectedBlock = (idx: number) => {
    if (!state) return;
    const prefs = { ...state.preferences };
    const blocks = [...prefs.schedule.protectedBlocks];
    blocks.splice(idx, 1);
    prefs.schedule = { ...prefs.schedule, protectedBlocks: blocks };
    update(prefs);
  };

  const resetPreferences = () => {
    if (!state) return;
    const def = defaultPreferences();
    const newState = { ...state, preferences: def };
    setState(newState);
    saveState(newState);
  };

  if (!state) return null;

  const prefs = state.preferences;

  return (
    <div className="space-y-5">
      <GCalStatusBanner />

      {/* Schedule */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock size={16} className="text-indigo-400" /> Horario de trabajo
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Inicio del día</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
              value={prefs.schedule.workStartHour}
              onChange={(e) =>
                update({
                  ...prefs,
                  schedule: { ...prefs.schedule, workStartHour: Number(e.target.value) },
                })
              }
            >
              {Array.from({ length: 16 }, (_, i) => i + 5).map((h) => (
                <option key={h} value={h} className="bg-gray-900">
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fin del día</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
              value={prefs.schedule.workEndHour}
              onChange={(e) =>
                update({
                  ...prefs,
                  schedule: { ...prefs.schedule, workEndHour: Number(e.target.value) },
                })
              }
            >
              {Array.from({ length: 16 }, (_, i) => i + 14).map((h) => (
                <option key={h} value={h} className="bg-gray-900">
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs text-gray-400 mb-1 block">
            Buffer entre tareas (min)
          </label>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={prefs.schedule.bufferBetweenTasksMinutes}
            onChange={(e) =>
              update({
                ...prefs,
                schedule: {
                  ...prefs.schedule,
                  bufferBetweenTasksMinutes: Number(e.target.value),
                },
              })
            }
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>0 min</span>
            <span className="text-indigo-400 font-medium">
              {prefs.schedule.bufferBetweenTasksMinutes} min
            </span>
            <span>30 min</span>
          </div>
        </div>
      </div>

      {/* Protected blocks */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Moon size={16} className="text-purple-400" /> Bloques protegidos
          </h2>
          <button
            onClick={addProtectedBlock}
            className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        {prefs.schedule.protectedBlocks.length === 0 ? (
          <p className="text-xs text-gray-500">No hay bloques protegidos. El scheduler puede usar todo el horario.</p>
        ) : (
          <div className="space-y-2">
            {prefs.schedule.protectedBlocks.map((block, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/3 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <input
                    className="bg-transparent text-sm text-white w-full focus:outline-none"
                    value={block.label}
                    onChange={(e) => {
                      const blocks = [...prefs.schedule.protectedBlocks];
                      blocks[idx] = { ...block, label: e.target.value };
                      update({
                        ...prefs,
                        schedule: { ...prefs.schedule, protectedBlocks: blocks },
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    {String(block.startHour).padStart(2, "0")}:{String(block.startMinute).padStart(2, "0")} ·{" "}
                    {block.durationMinutes} min
                  </p>
                </div>
                <button
                  onClick={() => removeProtectedBlock(idx)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule policy */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle size={16} className="text-yellow-400" /> Política de reagendamiento
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-10 h-5 rounded-full transition-colors relative ${
                prefs.reschedulePolicy.autoRescheduleOnMiss ? "bg-indigo-600" : "bg-white/10"
              }`}
              onClick={() =>
                update({
                  ...prefs,
                  reschedulePolicy: {
                    ...prefs.reschedulePolicy,
                    autoRescheduleOnMiss: !prefs.reschedulePolicy.autoRescheduleOnMiss,
                  },
                })
              }
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  prefs.reschedulePolicy.autoRescheduleOnMiss ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-gray-300">Reagendar automáticamente si omito una tarea</span>
          </label>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Reducir meta después de {prefs.reschedulePolicy.reduceScopeAfterMissCount} omisiones consecutivas
            </label>
            <input
              type="range"
              min={1}
              max={7}
              value={prefs.reschedulePolicy.reduceScopeAfterMissCount}
              onChange={(e) =>
                update({
                  ...prefs,
                  reschedulePolicy: {
                    ...prefs.reschedulePolicy,
                    reduceScopeAfterMissCount: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>1 vez</span>
              <span className="text-indigo-400 font-medium">
                {prefs.reschedulePolicy.reduceScopeAfterMissCount} veces
              </span>
              <span>7 veces</span>
            </div>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" /> Google Calendar
        </h2>

        {gcalInfo?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 size={16} />
              Conectado como <span className="font-medium">{gcalInfo.email}</span>
            </div>
            <button
              onClick={disconnectGcal}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <XCircle size={14} /> Desconectar
            </button>
          </div>
        ) : gcalConfigured ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Conecta tu Google Calendar para sincronizar automáticamente tus tareas agendadas.
            </p>
            <a
              href="/api/gcal/auth"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Calendar size={16} /> Conectar Google Calendar
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Para habilitar la integración con Google Calendar, agrega estas variables a tu <code className="text-indigo-400">.env.local</code>:
            </p>
            <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
              <p>GOOGLE_CLIENT_ID=tu_client_id</p>
              <p>GOOGLE_CLIENT_SECRET=tu_client_secret</p>
              <p>GOOGLE_REDIRECT_URI=http://localhost:3000/api/gcal/callback</p>
            </div>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              Obtener credenciales en Google Cloud Console <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Reset */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Datos</h2>
        <div className="flex gap-3">
          <button
            onClick={resetPreferences}
            className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            Restaurar preferencias
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-14">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-gray-400 text-sm mt-0.5">Personaliza tu sistema operativo</p>
        </div>
        <Suspense fallback={null}>
          <SettingsContent />
        </Suspense>
      </main>
    </div>
  );
}
