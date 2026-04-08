import { NextRequest, NextResponse } from "next/server";
import { scheduleDayTasks } from "@/lib/scheduler";
import type { Task, TimeBlock, UserPreferences } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tasks,
      date,
      preferences,
      existingBlocks = [],
      afterNow = false,
    }: {
      tasks: Task[];
      date: string;
      preferences: UserPreferences;
      existingBlocks: TimeBlock[];
      afterNow?: boolean;
    } = body;

    const { blocks, unscheduled } = scheduleDayTasks({
      tasks,
      date,
      preferences,
      existingBlocks,
      afterNow,
    });

    return NextResponse.json({ blocks, unscheduled });
  } catch (err) {
    console.error("[schedule/route]", err);
    return NextResponse.json({ error: "Scheduling failed" }, { status: 500 });
  }
}
