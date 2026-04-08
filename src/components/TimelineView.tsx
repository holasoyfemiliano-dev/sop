// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, MapPin, SkipForward, RefreshCw } from "lucide-react";
import type { TimeBlock, Task } from "@/lib/types";
import { CATEGORY_HEX } from "@/lib/types";
import { timeToMinutes } from "@/lib/scheduler";

interface Props {
  blocks: TimeBlock[];
  tasks: Task[];
  startHour?: number;
  endHour?: number;
  onComplete: (blockId: string) => void;
  onSkip: (blockId: string) => void;
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function TimelineView({
  blocks,
  tasks,
  startHour = 6,
  endHour = 23,
  onComplete,
  onSkip,
}: Props) {
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes());

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(getNowMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  const totalMinutes = (endHour - startHour) * 60;
  const pxPerMinute = 2; // 2px per minute = 120px per hour
  const totalHeight = totalMinutes * pxPerMinute;

  const startMinutes = startHour * 60;
  const nowOffset = Math.max(0, Math.min(nowMinutes - startMinutes, totalMinutes));
  const nowPct = (nowOffset / totalMinutes) * 100;

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  function blockTop(block: TimeBlock) {
    const offset = timeToMinutes(block.startTime) - startMinutes;
    return Math.max(0, offset) * pxPerMinute;
  }

  function blockHeight(block: TimeBlock) {
    return Math.max(20, block.durationMinutes * pxPerMinute);
  }

  const sortedBlocks = [...blocks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="flex gap-0">
      {/* Hour labels */}
      <div className="flex-shrink-0 w-14 relative" style={{ height: totalHeight }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute text-xs text-gray-600 text-right pr-2 leading-none"
            style={{ top: (h - startHour) * 60 * pxPerMinute - 6 }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      {/* Timeline column */}
      <div className="flex-1 relative border-l border-white/6" style={{ height: totalHeight }}>
        {/* Hour grid lines */}
        {hours.map((h) => (
          <div
            key={h}
            className="absolute w-full border-t border-white/4"
            style={{ top: (h - startHour) * 60 * pxPerMinute }}
          />
        ))}

        {/* Current time indicator */}
        {nowMinutes >= startMinutes && nowMinutes <= endHour * 60 && (
          <div
            className="absolute w-full z-20 flex items-center"
            style={{ top: nowOffset * pxPerMinute }}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 flex-shrink-0" />
            <div className="flex-1 h-px bg-red-500/60" />
          </div>
        )}

        {/* Time blocks */}
        {sortedBlocks.map((block) => {
          const task = tasks.find((t) => t.id === block.taskId);
          const top = blockTop(block);
          const height = blockHeight(block);
          const isTravel = block.type === "travel";
          const isMissed = !block.completed && !block.skipped && timeToMinutes(block.endTime) < nowMinutes;
          const color = task?.category ? CATEGORY_HEX[task.category] : "#6366f1";

          return (
            <div
              key={block.id}
              className={`absolute left-2 right-2 rounded-lg px-2 py-1 overflow-hidden transition-all group ${
                block.completed
                  ? "opacity-50"
                  : block.skipped
                  ? "opacity-30"
                  : isMissed
                  ? "ring-1 ring-red-500/40"
                  : "hover:ring-1 hover:ring-white/20"
              }`}
              style={{
                top,
                height: Math.max(height, 28),
                background: isTravel
                  ? "rgba(100,100,100,0.2)"
                  : `${color}18`,
                borderLeft: `3px solid ${isTravel ? "#666" : color}`,
              }}
            >
              <div className="flex items-start justify-between gap-1 h-full">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    {isTravel && <MapPin size={10} className="text-gray-400 flex-shrink-0" />}
                    {block.completed && <CheckCircle2 size={10} className="text-green-400 flex-shrink-0" />}
                    {isMissed && <RefreshCw size={10} className="text-red-400 flex-shrink-0" />}
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: isTravel ? "#9ca3af" : color }}
                    >
                      {block.title}
                    </p>
                  </div>
                  {height >= 40 && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      {block.startTime} · {block.durationMinutes} min
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!block.completed && !block.skipped && !isTravel && (
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => onComplete(block.id)}
                      className="p-0.5 rounded hover:bg-green-500/20"
                      title="Completado"
                    >
                      <CheckCircle2 size={12} className="text-green-400" />
                    </button>
                    <button
                      onClick={() => onSkip(block.id)}
                      className="p-0.5 rounded hover:bg-red-500/20"
                      title="Omitir"
                    >
                      <SkipForward size={12} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-600 text-sm">Sin bloques agendados</p>
          </div>
        )}
      </div>
    </div>
  );
}
