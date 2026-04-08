// SOP v3 — Task-Centered Type System

// ── Task ──────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "backlog"      // Bodega: capturado, sin priorizar
  | "todo"         // Por hacer: definido, no urgente hoy
  | "in_progress"  // En proceso: multi-día o en curso
  | "today"        // 3 de hoy: foco del día (máx 3)
  | "done"         // Hecho
  | "cancelled";   // Cancelado

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type LevelValue = "low" | "medium" | "high";
export type TaskSource = "manual" | "chat" | "system";

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  urgency: LevelValue;
  importance: LevelValue;
  scheduledDate?: string;       // YYYY-MM-DD
  scheduledStart?: string;      // HH:MM
  scheduledEnd?: string;        // HH:MM
  estimatedMinutes?: number;
  dueDate?: string;             // YYYY-MM-DD
  requiresMultipleDays?: boolean;
  energyLevel?: LevelValue;
  notes?: string;
  gcalEventId?: string;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ── Project ───────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  color: string;  // hex
  createdAt: string;
  updatedAt: string;
}

// ── Step (checklist inside a task) ────────────────────────────────────────────

export interface Step {
  id: string;
  taskId: string;
  title: string;
  status: "pending" | "done";
  order: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Preferences (unchanged from v2 for Settings compatibility) ────────────────

export interface ProtectedBlock {
  label: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  days: number[];               // 0=Sunday
}

export interface DayScheduleConfig {
  workStartHour: number;
  workEndHour: number;
  protectedBlocks: ProtectedBlock[];
  bufferBetweenTasksMinutes: number;
  peakHours: number[];
  lowEnergyHours: number[];
}

export interface UserPreferences {
  timezone: string;
  language: "es" | "en";
  schedule: DayScheduleConfig;
  reschedulePolicy: {
    autoRescheduleOnMiss: boolean;
    reduceScopeAfterMissCount: number;
    moveToNextDayIfMissedAfterHour: number;
  };
  gcal: {
    connected: boolean;
    email?: string;
    calendarId?: string;
    syncEnabled: boolean;
    lastSyncAt?: string;
  };
}

// ── Root State ────────────────────────────────────────────────────────────────

export interface SOPState {
  version: 3;
  tasks: Task[];
  projects: Project[];
  steps: Step[];
  chatMessages: ChatMessage[];
  preferences: UserPreferences;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog:     "Bodega",
  todo:        "Por hacer",
  in_progress: "En proceso",
  today:       "3 de hoy",
  done:        "Hecho",
  cancelled:   "Cancelado",
};

export const KANBAN_COLUMNS: TaskStatus[] = [
  "backlog", "todo", "in_progress", "today", "done",
];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:      "Baja",
  medium:   "Media",
  high:     "Alta",
  critical: "Crítica",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:      "#3D4466",
  medium:   "#FFB900",
  high:     "#FF6B35",
  critical: "#FF3B3B",
};

export const PROJECT_COLORS = [
  "#230EFF", "#FF6B35", "#22c55e", "#a855f7",
  "#ec4899", "#06b6d4", "#eab308", "#f97316",
];

// ── Legacy types (kept for backward compat with onboarding + gcal/sync) ───────

export type CalendarSyncStatus = "not_synced" | "synced" | "sync_pending" | "sync_failed";
export type BlockType = "task" | "travel" | "buffer" | "fixed";
export type Category = "negocio" | "salud" | "aprendizaje" | "relaciones" | "finanzas" | "personal";
export type Frequency = "diario" | "semanal" | "mensual" | "once";

export interface TimeBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: BlockType;
  taskId?: string;
  title: string;
  category?: Category;
  completed: boolean;
  skipped: boolean;
  scheduledBy: "auto" | "user";
  rescheduleCount: number;
  gcalEventId?: string;
  gcalSyncStatus: CalendarSyncStatus;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  estimatedMinutes: number;
  order: number;
}

export type ParsedTaskOutput = {
  tasks: unknown[];
  subtasks: Record<string, unknown[]>;
};
