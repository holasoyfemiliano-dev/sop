"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import type { SOPState, ChatMessage, Task, TaskStatus } from "@/lib/types";
import { Send, Loader2, Calendar, MessageSquare } from "lucide-react";

// ── GCal sync ─────────────────────────────────────────────────────────────────

async function syncTaskToGCal(task: Task): Promise<string | null> {
  if (!task.scheduledDate || !task.scheduledStart) return null;
  try {
    const res = await fetch("/api/gcal/sync-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        scheduledDate: task.scheduledDate,
        scheduledStart: task.scheduledStart,
        scheduledEnd: task.scheduledEnd ?? addMinutes(task.scheduledStart, task.estimatedMinutes ?? 60),
        gcalEventId: task.gcalEventId,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.gcalEventId ?? null;
  } catch { return null; }
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function deleteFromGCal(gcalEventId: string) {
  try {
    await fetch("/api/gcal/delete-event", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gcalEventId }),
    });
  } catch { /* silent */ }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-slide-up"
      style={{
        background: type === "success" ? "rgba(35,14,255,0.9)" : "rgba(220,38,38,0.9)",
        color: "#EAEBEF",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
      }}
    >
      {msg}
    </div>
  );
}

// ── Parsed task from API ──────────────────────────────────────────────────────

interface ParsedTaskFromAPI {
  title: string;
  status?: TaskStatus;
  priority?: Task["priority"];
  urgency?: Task["urgency"];
  importance?: Task["importance"];
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedMinutes?: number;
  dueDate?: string;
  notes?: string;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [state, setState] = useState<SOPState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => { setState(loadState()); }, []);

  useEffect(() => {
    if (!state || autoSentRef.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) { autoSentRef.current = true; setInput(q); }
  }, [state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chatMessages]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const update = useCallback((s: SOPState) => { setState(s); saveState(s); }, []);

  // ── Create tasks from chat response ───────────────────────────────────────
  const createTasks = useCallback(
    async (parsedTasks: ParsedTaskFromAPI[], currentState: SOPState): Promise<SOPState> => {
      const today = getTodayStr();
      let st = currentState;
      const todayCount = st.tasks.filter((t) => t.status === "today").length;
      let todayAdded = 0;

      for (const taskData of parsedTasks) {
        const taskId = generateId();
        const now = new Date().toISOString();

        // Determine status
        let status: TaskStatus = taskData.status ?? "todo";
        if (status === "today" && todayCount + todayAdded >= 3) {
          status = "todo"; // overflow to "por hacer"
        }
        if (status === "today") todayAdded++;

        const newTask: Task = {
          id: taskId,
          title: taskData.title,
          status,
          priority: taskData.priority ?? "medium",
          urgency: taskData.urgency ?? "medium",
          importance: taskData.importance ?? "medium",
          scheduledDate: taskData.scheduledDate,
          scheduledStart: taskData.scheduledStart,
          scheduledEnd: taskData.scheduledEnd,
          estimatedMinutes: taskData.estimatedMinutes,
          dueDate: taskData.dueDate,
          notes: taskData.notes,
          source: "chat",
          createdAt: now,
          updatedAt: now,
        };

        st = { ...st, tasks: [newTask, ...st.tasks] };
        update(st);

        // GCal sync
        if (newTask.scheduledDate && newTask.scheduledStart) {
          const gcalEventId = await syncTaskToGCal(newTask);
          if (gcalEventId) {
            st = {
              ...st,
              tasks: st.tasks.map((t) => t.id === taskId ? { ...t, gcalEventId } : t),
            };
            update(st);
          }
        }
      }

      return st;
    },
    [update]
  );

  // ── Delete tasks from chat response ──────────────────────────────────────
  const deleteTasks = useCallback(
    async (deleteQuery: string, currentState: SOPState): Promise<SOPState> => {
      const words = deleteQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const matching = currentState.tasks.filter((t) =>
        words.some((w) => t.title.toLowerCase().includes(w))
      );
      if (matching.length === 0) return currentState;

      for (const task of matching) {
        if (task.gcalEventId) await deleteFromGCal(task.gcalEventId);
      }

      const deletedIds = new Set(matching.map((t) => t.id));
      return {
        ...currentState,
        tasks: currentState.tasks.filter((t) => !deletedIds.has(t.id)),
        steps: currentState.steps.filter((s) => !deletedIds.has(s.taskId)),
      };
    },
    []
  );

  const sendMessage = async () => {
    if (!input.trim() || loading || !state) return;

    const userMsg: ChatMessage = {
      id: generateId(), role: "user", content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    let currentState = { ...state, chatMessages: [...state.chatMessages, userMsg] };
    update(currentState);
    const sentText = input.trim();
    setInput("");
    setLoading(true);

    try {
      const now = new Date();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: sentText,
          history: state.chatMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          currentDate: getTodayStr(),
          currentTime: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor");

      const { reply, action, deleteQuery, tasks } = data;
      const replyText = reply || (action === "add" ? "Listo, lo agregué." : "Hecho.");

      if (action === "delete" && deleteQuery) {
        currentState = await deleteTasks(deleteQuery, currentState);
        showToast("Tarea eliminada", "success");
      }

      if (action === "add" && tasks?.length > 0) {
        currentState = await createTasks(tasks, currentState);
        showToast("Tarea agregada al sistema ✓", "success");
      }

      const assistantMsg: ChatMessage = {
        id: generateId(), role: "assistant", content: replyText,
        timestamp: new Date().toISOString(),
      };
      currentState = { ...currentState, chatMessages: [...currentState.chatMessages, assistantMsg] };
      update(currentState);

    } catch (err) {
      const msg = err instanceof Error && err.message.includes("API")
        ? "Falta configurar la API key de Claude."
        : "Error al procesar. Intenta de nuevo.";
      const errMsg: ChatMessage = {
        id: generateId(), role: "assistant", content: msg,
        timestamp: new Date().toISOString(),
      };
      update({ ...currentState, chatMessages: [...currentState.chatMessages, errMsg] });
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!state) return null;

  const STARTERS = [
    "Pon gym hoy a las 7pm, 1 hora",
    "Agrega reunión de equipo mañana a las 10am",
    "Crear tarea 'preparar presentación' para el viernes",
    "Quita la reunión de las 3pm de hoy",
  ];

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pt-14 proximity-gradient">
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <Nav />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">

          {/* Empty state */}
          {state.chatMessages.length === 0 && (
            <div className="text-center py-14">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(35,14,255,0.15)", border: "1px solid rgba(35,14,255,0.3)" }}
              >
                <MessageSquare size={26} style={{ color: "#230EFF" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#EAEBEF" }}>¿Qué quieres hacer?</h2>
              <p className="text-sm mb-7 max-w-xs mx-auto" style={{ color: "#818BA6" }}>
                Dime qué agregar o quitar. Lo organizo en tu sistema y lo sincronizo con Google Calendar.
              </p>
              <div className="space-y-2 max-w-sm mx-auto text-left">
                {STARTERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: "rgba(13,16,53,0.8)",
                      border: "1px solid rgba(35,14,255,0.2)",
                      color: "#818BA6",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {state.chatMessages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {!isUser && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-xs font-black"
                        style={{ background: "#230EFF", color: "#EAEBEF" }}
                      >
                        S
                      </div>
                      <span className="text-xs" style={{ color: "#3D4466" }}>SOP</span>
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                    style={isUser ? {
                      background: "#230EFF", color: "#EAEBEF",
                      borderRadius: "16px 16px 4px 16px",
                    } : {
                      background: "rgba(13,16,53,0.9)",
                      border: "1px solid rgba(35,14,255,0.2)",
                      color: "#EAEBEF",
                      borderRadius: "4px 16px 16px 16px",
                    }}
                  >
                    {msg.content}
                  </div>
                  {!isUser && (msg.content.includes("calendario") || msg.content.includes("Calendar")) && (
                    <div className="flex items-center gap-1.5 mt-1.5 px-1">
                      <Calendar size={11} style={{ color: "#230EFF" }} />
                      <span className="text-xs" style={{ color: "#3D4466" }}>Sincronizado con Google Calendar</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.2)", borderRadius: "4px 16px 16px 16px" }}
              >
                <Loader2 size={15} className="animate-spin" style={{ color: "#230EFF" }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="rounded-2xl p-3 flex items-end gap-2"
          style={{ background: "rgba(13,16,53,0.9)", border: "1px solid rgba(35,14,255,0.25)" }}
        >
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none max-h-32 min-h-[40px]"
            style={{ color: "#EAEBEF" }}
            placeholder="Agregar, mover o quitar tareas…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "#230EFF" }}
          >
            <Send size={14} style={{ color: "#EAEBEF" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
