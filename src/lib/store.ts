// SOP Store — v3 with migration from v2
import type { SOPState, UserPreferences, Task } from "./types";

const STORAGE_KEY = "sop_v3";

export function defaultPreferences(): UserPreferences {
  return {
    timezone: "America/Bogota",
    language: "es",
    schedule: {
      workStartHour: 7,
      workEndHour: 22,
      protectedBlocks: [
        { label: "Almuerzo", startHour: 13, startMinute: 0, durationMinutes: 60, days: [1, 2, 3, 4, 5] },
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

function migrateToV3(raw: Record<string, unknown>): SOPState {
  const def = defaultPreferences();
  const base: SOPState = {
    version: 3,
    tasks: [],
    projects: [],
    steps: [],
    chatMessages: [],
    preferences: def,
  };

  // Migrate preferences
  if (raw.preferences) {
    const p = raw.preferences as Record<string, unknown>;
    base.preferences = {
      ...def,
      ...(p as Partial<UserPreferences>),
      schedule: { ...def.schedule, ...((p.schedule ?? {}) as Partial<UserPreferences["schedule"]>) },
      reschedulePolicy: { ...def.reschedulePolicy, ...((p.reschedulePolicy ?? {}) as Partial<UserPreferences["reschedulePolicy"]>) },
      gcal: { ...def.gcal, ...((p.gcal ?? {}) as Partial<UserPreferences["gcal"]>) },
    };
  }

  // Migrate chat messages
  if (Array.isArray(raw.chatMessages)) {
    base.chatMessages = (raw.chatMessages as Array<Record<string, unknown>>)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: String(m.id ?? generateId()),
        role: m.role as "user" | "assistant",
        content: String(m.content ?? ""),
        timestamp: String(m.timestamp ?? new Date().toISOString()),
      }));
  }

  // Migrate v2 tasks to v3 format
  if (Array.isArray(raw.tasks)) {
    base.tasks = (raw.tasks as Array<Record<string, unknown>>).map((t): Task => {
      const oldStatus = String(t.status ?? "");
      let status: Task["status"] = "todo";
      if (oldStatus === "completed") status = "done";
      else if (oldStatus === "in_progress") status = "in_progress";
      else if (["missed", "rescheduled", "deferred", "reduced"].includes(oldStatus)) status = "backlog";

      const oldPriority = String(t.priority ?? "");
      let priority: Task["priority"] = "medium";
      if (["alta", "high", "critical"].includes(oldPriority)) priority = "high";
      else if (["baja", "low"].includes(oldPriority)) priority = "low";

      return {
        id: String(t.id ?? generateId()),
        title: String(t.title ?? ""),
        description: t.description ? String(t.description) : undefined,
        status,
        priority,
        urgency: t.urgent ? "high" : "medium",
        importance: t.important ? "high" : "medium",
        scheduledDate: t.scheduledDate ? String(t.scheduledDate) : undefined,
        scheduledStart: t.pinnedTime ? String(t.pinnedTime) : undefined,
        estimatedMinutes: t.estimatedMinutes ? Number(t.estimatedMinutes) : undefined,
        notes: t.notes ? String(t.notes) : undefined,
        gcalEventId: t.gcalEventId ? String(t.gcalEventId) : undefined,
        source: (t.source === "chat" ? "chat" : "manual") as Task["source"],
        createdAt: String(t.createdAt ?? new Date().toISOString()),
        updatedAt: String(t.updatedAt ?? new Date().toISOString()),
        completedAt: t.completedAt ? String(t.completedAt) : undefined,
      };
    });
  }

  return base;
}

export function loadState(): SOPState {
  if (typeof window === "undefined") {
    return {
      version: 3,
      tasks: [],
      projects: [],
      steps: [],
      chatMessages: [],
      preferences: defaultPreferences(),
    };
  }
  try {
    const raw3 = localStorage.getItem(STORAGE_KEY);
    if (raw3) {
      const parsed = JSON.parse(raw3) as SOPState;
      if (parsed.version === 3) return parsed;
      return migrateToV3(parsed as unknown as Record<string, unknown>);
    }
    const raw2 = localStorage.getItem("sop_v2");
    if (raw2) {
      const migrated = migrateToV3(JSON.parse(raw2));
      saveState(migrated);
      return migrated;
    }
    const legacy = localStorage.getItem("sop_data");
    if (legacy) {
      const migrated = migrateToV3(JSON.parse(legacy));
      saveState(migrated);
      return migrated;
    }
  } catch { /* ignore */ }
  return migrateToV3({});
}

export function saveState(state: SOPState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state,
    chatMessages: state.chatMessages.slice(-100),
  }));
}

export function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type { SOPState };
export * from "./types";
