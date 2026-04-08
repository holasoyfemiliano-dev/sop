"use client";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { loadState, saveState, generateId, getTodayStr } from "@/lib/store";
import { scheduleDayTasks } from "@/lib/scheduler";
import type { SOPState, ChatMessage, Task, Subtask, ParsedTaskOutput } from "@/lib/types";
import {
  Send,
  Loader2,
  CheckCircle2,
  X,
  Zap,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, EISENHOWER_LABELS } from "@/lib/types";

function PendingTaskCard({
  task,
  subtasks,
  onAccept,
  onReject,
}: {
  task: ParsedTaskOutput["tasks"][0];
  subtasks: ParsedTaskOutput["subtasks"][string];
  onAccept: () => void;
  onReject: () => void;
}) {
  const eis = EISENHOWER_LABELS[task.eisenhower];
  return (
    <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-3 mt-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{task.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[task.category]}`}>
              {CATEGORY_LABELS[task.category]}
            </span>
            <span className={`text-xs font-medium ${eis.color}`}>{eis.label}</span>
            <span className="text-xs text-gray-500 flex items-center gap-0.5">
              <Clock size={10} /> {task.estimatedMinutes} min
            </span>
            {task.hasLocation && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <MapPin size={10} /> {task.location} (+{task.travelMinutesBefore ?? 20} min traslado)
              </span>
            )}
            {task.urgent && (
              <span className="text-xs text-red-400 flex items-center gap-0.5">
                <AlertCircle size={10} /> Urgente
              </span>
            )}
          </div>
          {subtasks && subtasks.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {subtasks.map((s, i) => (
                <p key={i} className="text-xs text-gray-400 pl-2 border-l border-white/10">
                  {s.title} ({s.estimatedMinutes} min)
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onAccept}
            className="p-1.5 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-colors"
          >
            <CheckCircle2 size={14} />
          </button>
          <button
            onClick={onReject}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<SOPState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<
    Map<string, { task: ParsedTaskOutput["tasks"][0]; subtasks: ParsedTaskOutput["subtasks"][string]; msgId: string }>
  >(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    setState(loadState());
  }, []);

  // Auto-send message from ?q= query param (quick capture from dashboard)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && state && !autoSentRef.current) {
      autoSentRef.current = true;
      setInput(q);
    }
  }, [searchParams, state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chatMessages]);

  const update = useCallback((s: SOPState) => {
    setState(s);
    saveState(s);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || !state) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const newState = {
      ...state,
      chatMessages: [...state.chatMessages, userMsg],
    };
    update(newState);
    setInput("");
    setLoading(true);

    try {
      const now = new Date();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          history: state.chatMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentDate: getTodayStr(),
          currentTime: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        }),
      });

      const data = await res.json();
      const { reply, parsedTasks } = data;

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
        parsedTasks: parsedTasks?.tasks?.length > 0 ? parsedTasks : undefined,
      };

      const updatedState = {
        ...newState,
        chatMessages: [...newState.chatMessages, assistantMsg],
      };
      update(updatedState);

      // Queue pending tasks for user review
      if (parsedTasks?.tasks?.length > 0) {
        const newPending = new Map(pendingTasks);
        parsedTasks.tasks.forEach((task: ParsedTaskOutput["tasks"][0], i: number) => {
          const key = `${assistantMsg.id}_${i}`;
          newPending.set(key, {
            task,
            subtasks: parsedTasks.subtasks?.[String(i)] ?? [],
            msgId: assistantMsg.id,
          });
        });
        setPendingTasks(newPending);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Lo siento, tuve un error. Asegúrate de tener ANTHROPIC_API_KEY configurado.",
        timestamp: new Date().toISOString(),
      };
      update({ ...newState, chatMessages: [...newState.chatMessages, errMsg] });
    } finally {
      setLoading(false);
    }
  };

  const acceptTask = useCallback(
    (key: string) => {
      if (!state) return;
      const pending = pendingTasks.get(key);
      if (!pending) return;

      const today = getTodayStr();
      const taskId = generateId();
      const now = new Date().toISOString();

      const newTask: Task = {
        ...pending.task,
        id: taskId,
        scheduledDate: pending.task.scheduledDate ?? today,
        missCount: 0,
        gcalSyncStatus: "not_synced",
        createdAt: now,
        updatedAt: now,
      } as Task;

      const newSubtasks: Subtask[] = (pending.subtasks ?? []).map((s, i) => ({
        ...s,
        id: generateId(),
        taskId,
        order: i,
      }));

      // Auto-schedule
      const existingForDate = state.timeBlocks.filter(
        (b) => b.date === (newTask.scheduledDate ?? today)
      );
      const { blocks } = scheduleDayTasks({
        tasks: [newTask],
        date: newTask.scheduledDate ?? today,
        preferences: state.preferences,
        existingBlocks: existingForDate,
      });

      const blocksWithIds = blocks.map((b) => ({ ...b, id: generateId() }));

      const newPending = new Map(pendingTasks);
      newPending.delete(key);
      setPendingTasks(newPending);

      update({
        ...state,
        tasks: [...state.tasks, newTask],
        subtasks: [...state.subtasks, ...newSubtasks],
        timeBlocks: [...state.timeBlocks, ...blocksWithIds],
      });
    },
    [state, pendingTasks, update]
  );

  const rejectTask = useCallback(
    (key: string) => {
      const newPending = new Map(pendingTasks);
      newPending.delete(key);
      setPendingTasks(newPending);
    },
    [pendingTasks]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!state) return null;

  const STARTER_PROMPTS = [
    "Necesito grabar 2 reels hoy y responder DMs",
    "Tengo reunión con cliente a las 3pm en la oficina",
    "Quiero hacer ejercicio 3 veces esta semana",
    "Debo terminar la propuesta antes del viernes",
  ];

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pt-14">
      <Nav />

      {/* Chat area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {/* Welcome */}
          {state.chatMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap size={32} className="text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">SOP está listo</h2>
              <p className="text-gray-400 text-sm mb-6">
                Cuéntame qué necesitas hacer. Convertiré todo en acciones agendadas automáticamente.
              </p>
              <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-left text-sm glass rounded-xl px-4 py-2.5 text-gray-300 hover:text-white hover:border-white/20 transition-colors"
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
            // Find pending tasks for this message
            const msgPending = [...pendingTasks.entries()].filter(
              ([, v]) => v.msgId === msg.id
            );

            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${isUser ? "order-1" : ""}`}>
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">S</span>
                      </div>
                      <span className="text-xs text-gray-500">SOP</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "glass text-gray-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Pending tasks for this message */}
                  {msgPending.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-gray-500 px-1">
                        {msgPending.length} tarea{msgPending.length > 1 ? "s" : ""} detectada{msgPending.length > 1 ? "s" : ""}. ¿Las agendo?
                      </p>
                      {msgPending.map(([key, { task, subtasks }]) => (
                        <PendingTaskCard
                          key={key}
                          task={task}
                          subtasks={subtasks}
                          onAccept={() => acceptTask(key)}
                          onReject={() => rejectTask(key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="text-indigo-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="glass rounded-2xl p-3 flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none max-h-32 min-h-[40px]"
            placeholder="¿Qué necesitas hacer hoy? (Enter para enviar)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
