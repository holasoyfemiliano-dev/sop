"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import { scheduleDayTasks } from "@/lib/scheduler";
import type { SOPState, ChatMessage, Task, Subtask, ParsedTaskOutput, TimeBlock } from "@/lib/types";
import { Send, Loader2, Calendar, MessageSquare } from "lucide-react";

// ── GCal sync ─────────────────────────────────────────────────────────────────

async function pushBlocksToGCal(blocks: TimeBlock[]): Promise<Map<string, string>> {
  const gcalIds = new Map<string, string>();
  try {
    const res = await fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, calendarId: "primary" }),
    });
    if (!res.ok) return gcalIds;
    const data = await res.json();
    for (const r of data.results ?? []) {
      if (r.gcalEventId) gcalIds.set(r.blockId, r.gcalEventId);
    }
  } catch { /* silent */ }
  return gcalIds;
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
    if (q) {
      autoSentRef.current = true;
      setInput(q);
    }
  }, [state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chatMessages]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const update = useCallback((s: SOPState) => { setState(s); saveState(s); }, []);

  // ── Auto-create event from parsed task (no confirmation) ─────────────────
  const autoCreateEvents = useCallback(
    async (parsedTasks: ParsedTaskOutput, currentState: SOPState): Promise<SOPState> => {
      const today = getTodayStr();
      let st = currentState;
      const allNewBlocks: TimeBlock[] = [];

      for (const taskData of parsedTasks.tasks) {
        const taskId = generateId();
        const now = new Date().toISOString();

        const newTask: Task = {
          ...taskData,
          id: taskId,
          scheduledDate: taskData.scheduledDate ?? today,
          missCount: 0,
          gcalSyncStatus: "not_synced",
          createdAt: now,
          updatedAt: now,
        } as Task;

        const newSubtasks: Subtask[] = (parsedTasks.subtasks?.[String(parsedTasks.tasks.indexOf(taskData))] ?? []).map(
          (s, i) => ({ ...s, id: generateId(), taskId, order: i })
        );

        const targetDate = newTask.scheduledDate ?? today;
        const existing = st.timeBlocks.filter((b) => b.date === targetDate);
        const { blocks } = scheduleDayTasks({
          tasks: [newTask],
          date: targetDate,
          preferences: st.preferences,
          existingBlocks: existing,
        });

        const blocksWithIds: TimeBlock[] = blocks.map((b) => ({ ...b, id: generateId() }));
        allNewBlocks.push(...blocksWithIds);

        st = {
          ...st,
          tasks: [...st.tasks, newTask],
          subtasks: [...st.subtasks, ...newSubtasks],
          timeBlocks: [...st.timeBlocks, ...blocksWithIds],
        };
      }

      update(st);

      // Push all new blocks to GCal
      if (allNewBlocks.length > 0) {
        const gcalIds = await pushBlocksToGCal(allNewBlocks);
        if (gcalIds.size > 0) {
          const synced = {
            ...st,
            timeBlocks: st.timeBlocks.map((b) => {
              const gid = gcalIds.get(b.id);
              return gid ? { ...b, gcalEventId: gid, gcalSyncStatus: "synced" as const } : b;
            }),
          };
          update(synced);
          return synced;
        }
      }

      return st;
    },
    [update]
  );

  // ── Handle deletion ──────────────────────────────────────────────────────
  const handleDeleteQuery = useCallback(
    async (query: string, currentState: SOPState): Promise<SOPState> => {
      const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const matching = currentState.timeBlocks.filter((b) =>
        words.some((w) => b.title.toLowerCase().includes(w))
      );
      if (matching.length === 0) return currentState;

      for (const block of matching) {
        if (block.gcalEventId) await deleteFromGCal(block.gcalEventId);
      }

      const deletedIds = new Set(matching.map((b) => b.id));
      const deletedTaskIds = new Set(matching.map((b) => b.taskId).filter(Boolean) as string[]);

      return {
        ...currentState,
        timeBlocks: currentState.timeBlocks.filter((b) => !deletedIds.has(b.id)),
        tasks: currentState.tasks.filter((t) => !deletedTaskIds.has(t.id)),
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

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Error del servidor");
      }

      const { reply, action, deleteQuery, parsedTasks } = data;
      const replyText = reply || (action === "add" ? "Listo, lo agregué a tu calendario." : "Hecho.");

      // ── Handle deletion ──────────────────────────────────────────────
      if (action === "delete" && deleteQuery) {
        currentState = await handleDeleteQuery(deleteQuery, currentState);
        showToast("Evento eliminado del calendario", "success");
      }

      // ── Auto-create events ───────────────────────────────────────────
      if (action === "add" && parsedTasks?.tasks?.length > 0) {
        currentState = await autoCreateEvents(parsedTasks, currentState);
        showToast("Evento agregado al calendario ✓", "success");
      }

      const assistantMsg: ChatMessage = {
        id: generateId(), role: "assistant", content: replyText,
        timestamp: new Date().toISOString(),
      };
      currentState = { ...currentState, chatMessages: [...currentState.chatMessages, assistantMsg] };
      update(currentState);

    } catch (err) {
      const msg = err instanceof Error && err.message.includes("API")
        ? "Falta configurar la API key de Claude. Agrega ANTHROPIC_API_KEY en Vercel."
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
    "Agrega reunión de equipo mañana a las 10am, 1 hora",
    "Pon gym esta tarde a las 7pm",
    "Agrega almuerzo con cliente el viernes a las 1pm",
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
              <h2 className="text-xl font-bold mb-2" style={{ color: "#EAEBEF" }}>¿Qué quieres agendar?</h2>
              <p className="text-sm mb-7 max-w-xs mx-auto" style={{ color: "#818BA6" }}>
                Dime qué agregar o quitar y lo sincronizo con Google Calendar.
              </p>
              <div className="space-y-2 max-w-sm mx-auto text-left">
                {STARTERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl transition-all hover:border-opacity-50"
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
                      background: "#230EFF",
                      color: "#EAEBEF",
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

                  {/* GCal sync indicator */}
                  {!isUser && msg.content.includes("calendario") && (
                    <div className="flex items-center gap-1.5 mt-1.5 px-1">
                      <Calendar size={11} style={{ color: "#230EFF" }} />
                      <span className="text-xs" style={{ color: "#3D4466" }}>Sincronizado con Google Calendar</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading */}
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
            placeholder="Agregar o quitar del calendario…"
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
