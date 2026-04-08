// SOP v2 — Complete Type System

export type Priority = "alta" | "media" | "baja";
export type Category =
  | "negocio"
  | "salud"
  | "aprendizaje"
  | "relaciones"
  | "finanzas"
  | "personal";
export type Frequency = "diario" | "semanal" | "mensual" | "once";

export type EisenhowerQuadrant =
  | "do_first"     // urgent + important
  | "schedule"     // not urgent + important
  | "delegate"     // urgent + not important
  | "eliminate";   // not urgent + not important

export type TaskStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "missed"
  | "rescheduled"
  | "deferred"
  | "reduced";

export type BlockType = "task" | "travel" | "buffer" | "fixed";

export type CalendarSyncStatus = "not_synced" | "synced" | "sync_pending" | "sync_failed";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  estimatedMinutes: number;
  order: number;
}

export interface Task {
  id: string;
  goalId?: string;
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  eisenhower: EisenhowerQuadrant;
  urgent: boolean;
  important: boolean;
  status: TaskStatus;
  frequency: Frequency;
  estimatedMinutes: number;
  actualMinutes?: number;
  hasLocation: boolean;
  location?: string;
  travelMinutesBefore?: number;
  scheduledDate?: string;      // YYYY-MM-DD
  preferredHour?: number;      // 0-23 soft preference
  pinnedTime?: string;         // HH:MM hard pin
  missCount: number;
  lastCompletedAt?: string;
  lastMissedAt?: string;
  source: "chat" | "manual" | "goal_action";
  chatMessageId?: string;
  gcalEventId?: string;
  gcalSyncStatus: CalendarSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeBlock {
  id: string;
  date: string;                // YYYY-MM-DD
  startTime: string;           // HH:MM
  endTime: string;             // HH:MM
  durationMinutes: number;
  type: BlockType;
  taskId?: string;
  relatedTaskId?: string;      // for travel blocks
  title: string;
  category?: Category;
  completed: boolean;
  completedAt?: string;
  skipped: boolean;
  scheduledBy: "auto" | "user";
  rescheduleCount: number;
  originalDate?: string;
  originalStartTime?: string;
  gcalEventId?: string;
  gcalSyncStatus: CalendarSyncStatus;
}

export interface ParsedTaskOutput {
  tasks: Omit<Task, "id" | "createdAt" | "updatedAt" | "gcalSyncStatus" | "missCount">[];
  subtasks: Record<string, Omit<Subtask, "id" | "taskId">[]>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  parsedTasks?: ParsedTaskOutput;
  tasksCreated?: string[];
}

export interface ProtectedBlock {
  label: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  days: number[];              // 0=Sunday
}

export interface DayScheduleConfig {
  workStartHour: number;       // default 7
  workEndHour: number;         // default 22
  protectedBlocks: ProtectedBlock[];
  bufferBetweenTasksMinutes: number; // default 10
  peakHours: number[];         // e.g., [9, 10, 11]
  lowEnergyHours: number[];    // e.g., [14, 15]
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

// Legacy types (kept for backward compat)
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: Category;
  deadline?: string;
  priority: Priority;
  createdAt: string;
  active: boolean;
}

export interface DailyAction {
  id: string;
  goalId: string;
  title: string;
  duration: number;
  time?: string;
  priority: Priority;
  frequency: Frequency;
}

export interface DailyLog {
  date: string;
  actions: {
    actionId: string;
    completed: boolean;
    completedAt?: string;
    notes?: string;
  }[];
  blockOutcomes?: {
    blockId: string;
    completed: boolean;
    actualMinutes?: number;
    completedAt?: string;
  }[];
}

export interface SOPState {
  version: number;
  // Legacy
  goals: Goal[];
  actions: DailyAction[];
  logs: DailyLog[];
  // v2
  tasks: Task[];
  subtasks: Subtask[];
  timeBlocks: TimeBlock[];
  chatMessages: ChatMessage[];
  preferences: UserPreferences;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  negocio: "Negocio",
  salud: "Salud",
  aprendizaje: "Aprendizaje",
  relaciones: "Relaciones",
  finanzas: "Finanzas",
  personal: "Personal",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  negocio: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  salud: "bg-green-500/20 text-green-400 border-green-500/30",
  aprendizaje: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  relaciones: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  finanzas: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  personal: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const CATEGORY_HEX: Record<Category, string> = {
  negocio: "#3b82f6",
  salud: "#22c55e",
  aprendizaje: "#a855f7",
  relaciones: "#ec4899",
  finanzas: "#eab308",
  personal: "#f97316",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  alta: "text-red-400",
  media: "text-yellow-400",
  baja: "text-gray-400",
};

export const EISENHOWER_LABELS: Record<EisenhowerQuadrant, { label: string; sub: string; color: string }> = {
  do_first: { label: "Hacer primero", sub: "Urgente + Importante", color: "text-red-400" },
  schedule: { label: "Agendar", sub: "No urgente + Importante", color: "text-blue-400" },
  delegate: { label: "Delegar", sub: "Urgente + No importante", color: "text-yellow-400" },
  eliminate: { label: "Eliminar", sub: "No urgente + No importante", color: "text-gray-400" },
};
