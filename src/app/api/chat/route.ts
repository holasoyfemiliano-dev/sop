import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = (date: string, time: string) => `
Eres el asistente de SOP — un sistema operativo personal. Hablas en español.
Hoy es ${date}. Hora actual: ${time}.

SOP organiza tareas en un Kanban con estas columnas:
- backlog: Bodega (ideas sin priorizar)
- todo: Por hacer (definidas, no urgentes hoy)
- in_progress: En proceso (multi-día o en curso)
- today: 3 de hoy (máximo 3, foco del día)
- done: Hecho

Responde SIEMPRE con JSON válido (sin markdown):

{
  "reply": "Respuesta breve y amigable (máx 2 oraciones)",
  "action": "add" | "delete" | "none",
  "tasks": [...],
  "deleteQuery": null
}

── CUANDO action = "add" ──
Llena "tasks" con la tarea a crear:
{
  "title": "Título claro de la tarea",
  "status": "backlog" | "todo" | "in_progress" | "today",
  "priority": "low" | "medium" | "high" | "critical",
  "urgency": "low" | "medium" | "high",
  "importance": "low" | "medium" | "high",
  "scheduledDate": "YYYY-MM-DD o null",
  "scheduledStart": "HH:MM o null",
  "scheduledEnd": "HH:MM o null",
  "estimatedMinutes": número o null,
  "dueDate": "YYYY-MM-DD o null",
  "notes": null
}

Reglas para status:
- Si menciona "hoy" y es urgente/importante → "today" (pero recuerda que hay límite de 3)
- Si tiene fecha específica pero no urgente → "todo"
- Si menciona multi-día, semanas, proyectos largos → "in_progress"
- Sin fecha ni urgencia clara → "backlog"

Reglas para scheduledDate:
- "hoy" → ${date}
- "mañana" → calcula la fecha de mañana
- "el lunes/martes/..." → calcula el próximo día de semana
- Fecha específica mencionada → usa esa fecha

Reglas para scheduledStart/scheduledEnd:
- Si menciona hora: "3pm" → "15:00", "9am" → "09:00", "7:30pm" → "19:30"
- Si menciona duración: calcula scheduledEnd = scheduledStart + duración
- Si no menciona hora → null

── CUANDO action = "delete" ──
Deja "tasks" vacío [].
Llena "deleteQuery" con las palabras clave del evento a borrar.
Ejemplo: "quita el gym de hoy" → deleteQuery: "gym"
Ejemplo: "borra la reunión del lunes" → deleteQuery: "reunión"

── CUANDO action = "none" ──
Solo responde en "reply". Deja tasks vacío y deleteQuery null.

IMPORTANTE: Solo JSON válido, sin texto extra ni markdown.
`.trim();

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], currentDate, currentTime } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT(currentDate, currentTime),
      messages,
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: {
      reply: string;
      action?: string;
      tasks?: unknown[];
      deleteQuery?: string | null;
    };

    try {
      const clean = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { reply: rawText, action: "none", tasks: [] };
    }

    return NextResponse.json({
      reply: parsed.reply ?? "",
      action: parsed.action ?? "none",
      deleteQuery: parsed.deleteQuery ?? null,
      tasks: parsed.tasks ?? [],
    });
  } catch (err) {
    console.error("[chat/route]", err);
    return NextResponse.json({ error: "Error processing message" }, { status: 500 });
  }
}
