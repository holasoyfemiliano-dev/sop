"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, CheckCircle2, ChevronRight, Loader2, Minus, Plus, Zap } from "lucide-react";
import type { CalendarPattern } from "@/app/api/gcal/analyze/route";
import { loadState, saveState, generateId } from "@/lib/store";
import type { TimeBlock } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "connect" | "analyzing" | "questionnaire" | "building" | "complete";

interface Answers {
  wakeHour: number;
  sleepHour: number;
  workStart: number;
  workEnd: number;
  lunchHour: number;
  hasExercise: boolean;
  exerciseHour: number;
}

interface ScheduleBlock {
  id: string;
  emoji: string;
  title: string;
  startTime: string;
  endTime: string;
  bg: string;
  border: string;
  category: string;
  label: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtHour(h: number): string {
  if (h === 0) return "12:00 am";
  if (h < 12) return `${h}:00 am`;
  if (h === 12) return "12:00 pm";
  return `${h - 12}:00 pm`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(h: number, m = 0): string {
  return `${pad2(h)}:${pad2(m)}`;
}

function blocksFromAnswers(answers: Answers, today: string): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  // Sleep — midnight to wake
  if (answers.wakeHour > 0) {
    blocks.push({
      id: "sleep",
      emoji: "🌙",
      title: "Dormir",
      startTime: "00:00",
      endTime: hhmm(answers.wakeHour),
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      category: "personal",
      label: `12:00 am – ${fmtHour(answers.wakeHour)}`,
    });
  }

  // Work
  blocks.push({
    id: "work",
    emoji: "💼",
    title: "Trabajo",
    startTime: hhmm(answers.workStart),
    endTime: hhmm(answers.workEnd),
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    category: "negocio",
    label: `${fmtHour(answers.workStart)} – ${fmtHour(answers.workEnd)}`,
  });

  // Lunch
  blocks.push({
    id: "lunch",
    emoji: "🍽",
    title: "Almuerzo",
    startTime: hhmm(answers.lunchHour),
    endTime: hhmm(answers.lunchHour + 1),
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    category: "salud",
    label: `${fmtHour(answers.lunchHour)} – ${fmtHour(answers.lunchHour + 1)}`,
  });

  // Exercise
  if (answers.hasExercise) {
    blocks.push({
      id: "exercise",
      emoji: "🏋",
      title: "Ejercicio",
      startTime: hhmm(answers.exerciseHour),
      endTime: hhmm(answers.exerciseHour + 1),
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      category: "salud",
      label: `${fmtHour(answers.exerciseHour)} – ${fmtHour(answers.exerciseHour + 1)}`,
    });
  }

  // Evening (after work, before sleep)
  const eveningStart = Math.max(answers.workEnd, answers.hasExercise ? answers.exerciseHour + 1 : 0);
  const eveningEnd = answers.sleepHour;
  if (eveningEnd > eveningStart) {
    blocks.push({
      id: "evening",
      emoji: "🌆",
      title: "Tarde libre",
      startTime: hhmm(eveningStart),
      endTime: hhmm(eveningEnd),
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      category: "personal",
      label: `${fmtHour(eveningStart)} – ${fmtHour(eveningEnd)}`,
    });
  }

  void today; // used by caller
  return blocks;
}

function saveBlocksToState(_blocks: ScheduleBlock[], _today: string) {
  // v3: onboarding blocks are shown as WOW effect only, not persisted as TimeBlocks
  // Tasks are created directly from the Kanban/Chat
}

// ── Stepper UI ───────────────────────────────────────────────────────────────

function HourPicker({ label, value, onChange, min = 0, max = 23 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 transition-colors"
        >
          <Minus size={14} />
        </button>
        <span className="flex-1 text-center text-lg font-bold text-white">{fmtHour(value)}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Step: Connect ────────────────────────────────────────────────────────────

function StepConnect() {
  const [loading, setLoading] = useState(false);

  function handleConnect() {
    setLoading(true);
    window.location.href = "/api/gcal/auth?from=onboarding";
  }

  function handleSkip() {
    window.location.href = "/onboarding?skip=true";
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12">
      {/* Logo */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-8">
          <Zap size={32} className="text-indigo-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
          Tu agenda,<br />pero inteligente
        </h1>
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          Conecta tu Google Calendar y en 2 minutos tendrás tu día organizado automáticamente.
        </p>

        {/* Feature list */}
        <div className="space-y-3 mb-10">
          {[
            "Analiza tus patrones actuales",
            "Detecta tus horarios reales",
            "Arma tu agenda base en segundos",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={12} className="text-indigo-400" />
              </div>
              <span className="text-gray-300 text-sm">{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-gray-900 font-semibold text-base transition-all active:scale-95 disabled:opacity-60 mb-4"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Calendar size={18} />
          )}
          Conectar Google Calendar
        </button>

        <button
          onClick={handleSkip}
          className="w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors"
        >
          Continuar sin Google Calendar →
        </button>
      </div>
    </div>
  );
}

// ── Step: Analyzing ──────────────────────────────────────────────────────────

function StepAnalyzing({ onDone }: { onDone: (p: CalendarPattern) => void }) {
  const [progress, setProgress] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const steps = [20, 50, 80, 100];
    steps.forEach((v, i) => {
      setTimeout(() => setProgress(v), i * 700);
    });

    setTimeout(async () => {
      try {
        const res = await fetch("/api/gcal/analyze");
        const data = await res.json();
        onDone(data.pattern as CalendarPattern);
      } catch {
        onDone({
          email: "",
          eventCount: 0,
          wakeHour: 7,
          sleepHour: 23,
          workStart: 9,
          workEnd: 18,
          lunchHour: 13,
          hasExercise: false,
          exerciseHour: null,
          recurringTitles: [],
        });
      }
    }, 3200);
  }, [onDone]);

  const labels = [
    "Conectado a Google Calendar",
    "Leyendo los últimos 3 meses...",
    "Detectando patrones...",
    "Preparando tu cuestionario...",
  ];
  const activeIndex = progress < 25 ? 0 : progress < 55 ? 1 : progress < 85 ? 2 : 3;

  return (
    <div className="flex flex-col min-h-screen px-6 py-12 justify-center">
      <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-8 mx-auto">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-white text-center mb-2">Analizando tu calendario</h2>
      <p className="text-gray-500 text-sm text-center mb-10">Esto solo tarda unos segundos…</p>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-8">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step list */}
      <div className="space-y-4">
        {labels.map((label, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  done
                    ? "bg-indigo-500"
                    : active
                    ? "bg-indigo-500/20 ring-2 ring-indigo-500/50"
                    : "bg-white/5"
                }`}
              >
                {done ? (
                  <CheckCircle2 size={13} className="text-white" />
                ) : active ? (
                  <Loader2 size={11} className="text-indigo-400 animate-spin" />
                ) : null}
              </div>
              <span
                className={`text-sm transition-colors ${
                  done ? "text-gray-400 line-through" : active ? "text-white" : "text-gray-600"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step: Questionnaire ──────────────────────────────────────────────────────

function StepQuestionnaire({
  pattern,
  onDone,
}: {
  pattern: CalendarPattern | null;
  onDone: (a: Answers) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({
    wakeHour: pattern?.wakeHour ?? 7,
    sleepHour: pattern?.sleepHour ?? 23,
    workStart: pattern?.workStart ?? 9,
    workEnd: pattern?.workEnd ?? 18,
    lunchHour: pattern?.lunchHour ?? 13,
    hasExercise: pattern?.hasExercise ?? false,
    exerciseHour: pattern?.exerciseHour ?? 18,
  });

  const set = (key: keyof Answers) => (v: number | boolean) =>
    setAnswers((a) => ({ ...a, [key]: v }));

  const eventMsg = pattern?.eventCount
    ? `Analizamos ${pattern.eventCount} eventos de tu Google Calendar.`
    : null;

  return (
    <div className="flex flex-col min-h-screen px-5 py-10">
      <div className="mb-8">
        <p className="text-xs text-indigo-400 font-medium mb-1 uppercase tracking-widest">
          Cuestionario
        </p>
        <h2 className="text-2xl font-bold text-white mb-2">Confirmemos tu rutina</h2>
        {eventMsg && (
          <p className="text-gray-500 text-sm">{eventMsg} Ajusta lo que no coincida.</p>
        )}
        {!eventMsg && (
          <p className="text-gray-500 text-sm">
            Cuéntanos sobre tus horarios habituales.
          </p>
        )}
      </div>

      <div className="space-y-3 flex-1">
        <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">Sueño</p>
        <HourPicker label="¿A qué hora te despiertas?" value={answers.wakeHour} onChange={set("wakeHour") as (v: number) => void} min={4} max={11} />
        <HourPicker label="¿A qué hora te duermes?" value={answers.sleepHour} onChange={set("sleepHour") as (v: number) => void} min={20} max={23} />

        <p className="text-xs text-gray-600 uppercase tracking-wider font-medium pt-2">Trabajo</p>
        <HourPicker label="¿A qué hora empiezas a trabajar?" value={answers.workStart} onChange={set("workStart") as (v: number) => void} min={5} max={13} />
        <HourPicker label="¿A qué hora terminas de trabajar?" value={answers.workEnd} onChange={set("workEnd") as (v: number) => void} min={12} max={22} />

        <p className="text-xs text-gray-600 uppercase tracking-wider font-medium pt-2">Comidas</p>
        <HourPicker label="¿Cuándo almuerzas?" value={answers.lunchHour} onChange={set("lunchHour") as (v: number) => void} min={10} max={16} />

        <p className="text-xs text-gray-600 uppercase tracking-wider font-medium pt-2">Ejercicio</p>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">¿Haces ejercicio regularmente?</p>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => set("hasExercise")(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  answers.hasExercise === v
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {v ? "Sí" : "No"}
              </button>
            ))}
          </div>
        </div>

        {answers.hasExercise && (
          <HourPicker
            label="¿A qué hora entrenas?"
            value={answers.exerciseHour}
            onChange={set("exerciseHour") as (v: number) => void}
            min={5}
            max={22}
          />
        )}
      </div>

      <button
        onClick={() => onDone(answers)}
        className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all active:scale-95"
      >
        Armar mi agenda <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step: Building (wow effect) ──────────────────────────────────────────────

const BUILD_MESSAGES = [
  "Detectando patrón de sueño…",
  "Bloqueando horas de trabajo…",
  "Reservando tiempo para comer…",
  "Agregando ejercicio…",
  "Calculando tiempo libre…",
  "¡Tu agenda base está lista!",
];

function StepBuilding({
  blocks,
  onDone,
}: {
  blocks: ScheduleBlock[];
  onDone: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    blocks.forEach((_, i) => {
      const delay = 800 + i * 900;
      setTimeout(() => {
        setVisibleCount(i + 1);
        setMsgIndex(Math.min(i + 1, BUILD_MESSAGES.length - 2));
      }, delay);
    });

    const finalDelay = 800 + blocks.length * 900 + 400;
    setTimeout(() => {
      setMsgIndex(BUILD_MESSAGES.length - 1);
      setDone(true);
    }, finalDelay);
  }, [blocks]);

  return (
    <div className="flex flex-col min-h-screen px-5 py-10">
      <div className="mb-8">
        <p className="text-xs text-indigo-400 font-medium mb-1 uppercase tracking-widest">
          Construyendo
        </p>
        <h2 className="text-2xl font-bold text-white mb-2">
          {BUILD_MESSAGES[msgIndex]}
        </h2>
        <p className="text-gray-500 text-sm">
          Basado en tus patrones reales
        </p>
      </div>

      {/* Blocks list */}
      <div className="flex-1 space-y-3">
        {blocks.map((block, i) => {
          const visible = i < visibleCount;
          return (
            <div
              key={block.id}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${block.bg} ${block.border} ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{
                transform: visible ? "translateY(0)" : "translateY(16px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              {/* Ping effect on newly added */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl flex-shrink-0">
                  {block.emoji}
                </div>
                {i === visibleCount - 1 && !done && (
                  <span className="absolute inset-0 rounded-xl ring-2 ring-indigo-400 animate-ping opacity-50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-base">{block.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{block.label}</p>
              </div>
              {visible && (
                <CheckCircle2 size={16} className="text-indigo-400 flex-shrink-0 animate-scale-in" />
              )}
            </div>
          );
        })}
      </div>

      {/* Done button */}
      <div
        className={`mt-8 transition-all duration-500 ${done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      >
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all active:scale-95"
        >
          Ir a mi agenda <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main Onboarding Page ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("connect");
  const [pattern, setPattern] = useState<CalendarPattern | null>(null);
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const initialized = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Already onboarded?
    if (typeof window !== "undefined" && localStorage.getItem("sop_onboarded") === "true") {
      router.replace("/");
      return;
    }

    // Coming back from Google OAuth?
    if (searchParams.get("connected") === "true") {
      setStep("analyzing");
      return;
    }

    // Skipping GCal?
    if (searchParams.get("skip") === "true") {
      setStep("questionnaire");
      return;
    }
  }, [searchParams, router]);

  const handleAnalysisDone = useCallback((p: CalendarPattern) => {
    setPattern(p);
    setStep("questionnaire");
  }, []);

  const handleQuestionnaireDone = useCallback(
    (a: Answers) => {
      setAnswers(a);
      const generated = blocksFromAnswers(a, today);
      setBlocks(generated);
      setStep("building");
    },
    [today]
  );

  const handleBuildingDone = useCallback(() => {
    if (answers) {
      // Save blocks to local state
      saveBlocksToState(blocks, today);
    }
    // Mark onboarding complete
    if (typeof window !== "undefined") {
      localStorage.setItem("sop_onboarded", "true");
    }
    router.push("/");
  }, [answers, blocks, today, router]);

  if (step === "connect") return <StepConnect />;
  if (step === "analyzing") return <StepAnalyzing onDone={handleAnalysisDone} />;
  if (step === "questionnaire")
    return <StepQuestionnaire pattern={pattern} onDone={handleQuestionnaireDone} />;
  if (step === "building")
    return <StepBuilding blocks={blocks} onDone={handleBuildingDone} />;

  return null;
}
