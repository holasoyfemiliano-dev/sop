// SOP Store — v2 with migration
import type { SOPState, UserPreferences } from "./types";

const STORAGE_KEY = "sop_v2";
const LEGACY_KEY = "sop_data";

export function defaultPreferences(): UserPreferences {
  return {
    timezone: "America/Bogota",
    language: "es",
    schedule: {
      workStartHour: 7,
      workEndHour: 22,
      protectedBlocks: [
        {
          label: "Almuerzo",
          startHour: 13,
          startMinute: 0,
          durationMinutes: 60,
          days: [1, 2, 3, 4, 5],
        },
      ],
      bufferBetweenTasksMinutes: 10,
      peakHours: [9, 10, 11, 16, 17],
      lowEnergyHours: [14, 15],
    },
    reschedulePolicy: {
      autoRescheduleOnMiss: true,
      reduceScopeAfterMissCount: 3,
      moveToNextDayIfMissedAfterHour: 20,
    },
    gcal: {
      connected: false,
      syncEnabled: false,
    },
  };
}

function migrateState(raw: Record<string, unknown>): SOPState {
  if (!raw.version || (raw.version as number) < 2) {
    return {
      version: 2,
      goals: (raw.goals as SOPState["goals"]) ?? [],
      actions: (raw.actions as SOPState["actions"]) ?? [],
      logs: (raw.logs as SOPState["logs"]) ?? [],
      tasks: [],
      subtasks: [],
      timeBlocks: [],
      chatMessages: [],
      preferences: defaultPreferences(),
    };
  }
  const state = raw as unknown as SOPState;
  // Ensure preferences is complete (fill missing fields from default)
  const def = defaultPreferences();
  state.preferences = {
    ...def,
    ...state.preferences,
    schedule: { ...def.schedule, ...state.preferences?.schedule },
    reschedulePolicy: { ...def.reschedulePolicy, ...state.preferences?.reschedulePolicy },
    gcal: { ...def.gcal, ...state.preferences?.gcal },
  };
  return state;
}

export function loadState(): SOPState {
  if (typeof window === "undefined") {
    return {
      version: 2,
      goals: [],
      actions: [],
      logs: [],
      tasks: [],
      subtasks: [],
      timeBlocks: [],
      chatMessages: [],
      preferences: defaultPreferences(),
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateState(JSON.parse(raw));
    // Try legacy key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateState(JSON.parse(legacy));
      saveState(migrated);
      return migrated;
    }
  } catch {
    // ignore
  }
  return migrateState({});
}

export function saveState(state: SOPState) {
  if (typeof window === "undefined") return;
  // Trim chat history to last 100 messages
  const trimmed = {
    ...state,
    chatMessages: state.chatMessages.slice(-100),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ─── Derived helpers ────────────────────────────────────────────────────────

export function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function getTodayLog(state: SOPState) {
  const today = getTodayStr();
  return state.logs.find((l) => l.date === today) ?? { date: today, actions: [], blockOutcomes: [] };
}

export function getBlocksForDate(state: SOPState, date: string) {
  return state.timeBlocks
    .filter((b) => b.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getTasksForDate(state: SOPState, date: string) {
  return state.tasks.filter((t) => t.scheduledDate === date);
}

export function getCompletionRate(state: SOPState, days = 7): number {
  const today = new Date();
  let total = 0;
  let completed = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const blocks = state.timeBlocks.filter((b) => b.date === dateStr && b.type === "task");
    if (blocks.length > 0) {
      total += blocks.length;
      completed += blocks.filter((b) => b.completed).length;
    } else {
      // Fall back to legacy actions
      const log = state.logs.find((l) => l.date === dateStr);
      const actions = state.actions.filter((a) => {
        const g = state.goals.find((g) => g.id === a.goalId);
        return g?.active && a.frequency === "diario";
      });
      total += actions.length;
      if (log) completed += log.actions.filter((a) => a.completed).length;
    }
  }

  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function getStreak(state: SOPState): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const blocks = state.timeBlocks.filter((b) => b.date === dateStr && b.type === "task");
    let rate = 0;

    if (blocks.length > 0) {
      rate = blocks.filter((b) => b.completed).length / blocks.length;
    } else {
      const log = state.logs.find((l) => l.date === dateStr);
      const actions = state.actions.filter((a) => {
        const g = state.goals.find((g) => g.id === a.goalId);
        return g?.active && a.frequency === "diario";
      });
      if (actions.length > 0 && log) {
        rate = log.actions.filter((a) => a.completed).length / actions.length;
      }
    }

    if (rate >= 0.7) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Re-export types for convenience
export type { SOPState };
export * from "./types";
