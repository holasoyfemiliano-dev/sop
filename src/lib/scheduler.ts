// SOP Scheduler — Pure auto-scheduling algorithm
// No side effects. Input → Output only.

import type { Task, TimeBlock, UserPreferences, BlockType, CalendarSyncStatus } from "./types";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Convert "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Convert minutes since midnight to "HH:MM"
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function subtractMinutes(time: string, minutes: number): string {
  return minutesToTime(Math.max(0, timeToMinutes(time) - minutes));
}

// Eisenhower priority score (lower = scheduled first)
function priorityScore(task: Task): number {
  const base: Record<string, number> = {
    do_first: 0,
    schedule: 1,
    delegate: 2,
    eliminate: 3,
  };
  let score = base[task.eisenhower] ?? 1;
  if (task.urgent) score -= 0.3;
  if (task.missCount > 0) score -= 0.2 * task.missCount;
  if (task.scheduledDate) {
    const daysUntil = Math.ceil(
      (new Date(task.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 0) score -= 0.4;
    else if (daysUntil <= 3) score -= 0.2;
  }
  return score;
}

interface FreeSlot {
  start: number; // minutes since midnight
  end: number;
}

function computeFreeSlots(
  date: string,
  preferences: UserPreferences,
  existingBlocks: TimeBlock[],
  afterNow = false
): FreeSlot[] {
  const { schedule } = preferences;
  let slots: FreeSlot[] = [
    {
      start: schedule.workStartHour * 60,
      end: schedule.workEndHour * 60,
    },
  ];

  // Subtract protected blocks
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  for (const pb of schedule.protectedBlocks) {
    if (!pb.days.includes(dayOfWeek)) continue;
    const pbStart = pb.startHour * 60 + pb.startMinute;
    const pbEnd = pbStart + pb.durationMinutes;
    slots = subtractInterval(slots, pbStart, pbEnd);
  }

  // Subtract existing blocks
  for (const block of existingBlocks) {
    if (block.date !== date) continue;
    const bStart = timeToMinutes(block.startTime);
    const bEnd = timeToMinutes(block.endTime);
    slots = subtractInterval(slots, bStart, bEnd);
  }

  // If afterNow, clip to current time
  if (afterNow) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    slots = slots
      .map((s) => ({ start: Math.max(s.start, nowMinutes), end: s.end }))
      .filter((s) => s.end - s.start > 0);
  }

  return slots;
}

function subtractInterval(slots: FreeSlot[], from: number, to: number): FreeSlot[] {
  const result: FreeSlot[] = [];
  for (const slot of slots) {
    if (to <= slot.start || from >= slot.end) {
      result.push(slot);
    } else {
      if (from > slot.start) result.push({ start: slot.start, end: from });
      if (to < slot.end) result.push({ start: to, end: slot.end });
    }
  }
  return result;
}

function findSlotForDuration(
  slots: FreeSlot[],
  durationMinutes: number,
  peakHours: number[],
  lowEnergyHours: number[],
  preferredHour?: number,
  highPriority = false
): number | null {
  // Convert peak/low hours to minute ranges
  const peakRanges = peakHours.map((h) => h * 60);
  const lowRanges = lowEnergyHours.map((h) => h * 60);

  // Try preferred hour first
  if (preferredHour !== undefined) {
    const preferred = preferredHour * 60;
    for (const slot of slots) {
      const start = Math.max(slot.start, preferred);
      if (start + durationMinutes <= slot.end) {
        return start;
      }
    }
  }

  // For high priority, try peak hours first
  if (highPriority && peakRanges.length > 0) {
    for (const peakStart of peakRanges) {
      for (const slot of slots) {
        const start = Math.max(slot.start, peakStart);
        if (start + durationMinutes <= slot.end && start < peakStart + 60) {
          return start;
        }
      }
    }
  }

  // For low priority, try low energy hours
  if (!highPriority && lowRanges.length > 0) {
    for (const lowStart of lowRanges) {
      for (const slot of slots) {
        const start = Math.max(slot.start, lowStart);
        if (start + durationMinutes <= slot.end && start < lowStart + 60) {
          return start;
        }
      }
    }
  }

  // Fall back to first available slot
  for (const slot of slots) {
    if (slot.end - slot.start >= durationMinutes) {
      return slot.start;
    }
  }

  return null;
}

interface SchedulerInput {
  tasks: Task[];
  date: string;
  preferences: UserPreferences;
  existingBlocks: TimeBlock[];
  afterNow?: boolean;
}

interface SchedulerOutput {
  blocks: TimeBlock[];
  unscheduled: Task[];
}

export function scheduleDayTasks(input: SchedulerInput): SchedulerOutput {
  const { tasks, date, preferences, existingBlocks, afterNow = false } = input;
  const { schedule } = preferences;

  // Candidates: tasks scheduled for this date, or recurring tasks not yet blocked
  const existingTaskIds = new Set(
    existingBlocks.filter((b) => b.date === date && b.type === "task").map((b) => b.taskId)
  );

  const candidates = tasks
    .filter((t) => {
      if (t.status === "completed") return false;
      if (existingTaskIds.has(t.id)) return false;
      if (t.scheduledDate && t.scheduledDate !== date) return false;
      if (!t.scheduledDate && t.frequency !== "diario") return false;
      return true;
    })
    .sort((a, b) => priorityScore(a) - priorityScore(b));

  let freeSlots = computeFreeSlots(date, preferences, existingBlocks, afterNow);
  const newBlocks: TimeBlock[] = [];
  const unscheduled: Task[] = [];

  for (const task of candidates) {
    const needMinutes = task.estimatedMinutes;
    const travelMinutes = task.hasLocation ? (task.travelMinutesBefore ?? 20) : 0;
    const totalNeeded = needMinutes + travelMinutes + schedule.bufferBetweenTasksMinutes;

    const isHighPriority = task.eisenhower === "do_first" || task.priority === "alta";

    let startMinutes: number | null = null;

    // If task has pinned time, use that
    if (task.pinnedTime) {
      startMinutes = timeToMinutes(task.pinnedTime);
    } else {
      startMinutes = findSlotForDuration(
        freeSlots,
        totalNeeded,
        schedule.peakHours,
        schedule.lowEnergyHours,
        task.preferredHour,
        isHighPriority
      );
    }

    if (startMinutes === null) {
      unscheduled.push(task);
      continue;
    }

    let currentMinute = startMinutes;

    // Insert travel block if needed
    if (travelMinutes > 0) {
      const travelBlock: TimeBlock = {
        id: generateId(),
        date,
        startTime: minutesToTime(currentMinute),
        endTime: minutesToTime(currentMinute + travelMinutes),
        durationMinutes: travelMinutes,
        type: "travel",
        relatedTaskId: task.id,
        title: `Traslado → ${task.location}`,
        completed: false,
        skipped: false,
        scheduledBy: "auto",
        rescheduleCount: 0,
        gcalSyncStatus: "not_synced",
      };
      newBlocks.push(travelBlock);
      freeSlots = subtractInterval(freeSlots, currentMinute, currentMinute + travelMinutes);
      currentMinute += travelMinutes;
    }

    // Main task block
    const taskBlock: TimeBlock = {
      id: generateId(),
      date,
      startTime: minutesToTime(currentMinute),
      endTime: minutesToTime(currentMinute + needMinutes),
      durationMinutes: needMinutes,
      type: "task",
      taskId: task.id,
      title: task.title,
      category: task.category,
      completed: false,
      skipped: false,
      scheduledBy: task.pinnedTime ? "user" : "auto",
      rescheduleCount: task.missCount,
      gcalSyncStatus: "not_synced",
    };
    newBlocks.push(taskBlock);

    // Consume the slot (task + buffer)
    const blockEnd = currentMinute + needMinutes + schedule.bufferBetweenTasksMinutes;
    freeSlots = subtractInterval(freeSlots, startMinutes, blockEnd);
  }

  return { blocks: newBlocks, unscheduled };
}

export function rescheduleBlock(
  block: TimeBlock,
  task: Task,
  preferences: UserPreferences,
  allBlocks: TimeBlock[]
): { blocks: TimeBlock[]; reducedMinutes?: number } {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const nowHour = now.getHours();

  const moveToNextDay =
    nowHour >= preferences.reschedulePolicy.moveToNextDayIfMissedAfterHour;

  let targetDate = today;
  if (moveToNextDay) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    targetDate = d.toISOString().split("T")[0];
  }

  // Check scope reduction
  let estimatedMinutes = task.estimatedMinutes;
  let reducedMinutes: number | undefined;
  if (task.missCount >= preferences.reschedulePolicy.reduceScopeAfterMissCount) {
    estimatedMinutes = Math.max(5, Math.ceil((estimatedMinutes * 0.67) / 5) * 5);
    reducedMinutes = estimatedMinutes;
  }

  const modifiedTask = { ...task, estimatedMinutes, missCount: task.missCount + 1 };
  const existingForDate = allBlocks.filter((b) => b.date === targetDate);

  const { blocks } = scheduleDayTasks({
    tasks: [modifiedTask],
    date: targetDate,
    preferences,
    existingBlocks: existingForDate,
    afterNow: targetDate === today,
  });

  return {
    blocks: blocks.map((b) => ({
      ...b,
      rescheduleCount: block.rescheduleCount + 1,
      originalDate: block.originalDate ?? block.date,
      originalStartTime: block.originalStartTime ?? block.startTime,
    })),
    reducedMinutes,
  };
}
