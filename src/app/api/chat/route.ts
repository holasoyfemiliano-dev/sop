import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = (date: string, time: string) => `
Eres el asistente de SOP (Sistema Operativo Personal). Hablas en español.
Hoy es ${date}. Hora actual: ${time}.

Cuando el usuario describe tareas, objetivos, ideas o pendientes, extrae la información
y responde con un JSON válido con esta estructura exacta:

{
  "reply": "Respuesta conversacional amigable y motivadora (máx 2 oraciones)",
  "tasks": [
    {
      "title": "Título concreto y accionable",
      "description": "Descripción opcional",
      "category": "negocio|salud|aprendizaje|relaciones|finanzas|personal",
      "priority": "alta|media|baja",
      "eisenhower": "do_first|schedule|delegate|eliminate",
      "urgent": true|false,
      "important": true|false,
      "status": "pending",
      "frequency": "once|diario|semanal|mensual",
      "estimatedMinutes": 30,
      "hasLocation": false,
      "location": null,
      "travelMinutesBefore": null,
      "scheduledDate": null,
      "preferredHour": null,
      "source": "chat"
    }
  ],
  "subtasks": {
    "0": [
      { "title": "Subtarea 1", "estimatedMinutes": 10, "completed": false, "order": 0 },
      { "title": "Subtarea 2", "estimatedMinutes": 20, "completed": false, "order": 1 }
    ]
  }
}

Reglas importantes:
- Si el usuario menciona un lugar físico (gimnasio, oficina, reunión), hasLocation = true y estima travelMinutesBefore
- urgent = true solo si debe hacerse hoy o en las próximas 48h
- important = true si avanza hacia un objetivo significativo
- eisenhower: do_first(urgente+importante), schedule(no urgente+importante), delegate(urgente+no importante), eliminate(no urgente+no importante)
- Si la tarea dura más de 60 min, divide en subtareas en "subtasks.0" (o "subtasks.1" para la segunda tarea, etc.)
- frequency "diario" solo si el usuario dice explícitamente que es recurrente diario
- Si el usuario hace una pregunta simple o conversa, responde en "reply" y deja "tasks" vacío []
- scheduledDate: "YYYY-MM-DD" solo si el usuario especifica una fecha. Si dice "hoy" usa ${date}.
- preferredHour: número 0-23 si menciona una hora. Ejemplo "a las 9am" → 9

IMPORTANTE: Tu respuesta debe ser SOLO el JSON, sin texto antes ni después, sin markdown.
`.trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], currentDate, currentTime } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Build conversation history (last 10 messages)
    const recentHistory = history.slice(-10);
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT(currentDate, currentTime),
      messages,
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: {
      reply: string;
      tasks: unknown[];
      subtasks: Record<string, unknown[]>;
    };

    try {
      // Strip markdown code fences if present
      const clean = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // If parsing fails, return as a plain reply
      parsed = { reply: rawText, tasks: [], subtasks: {} };
    }

    return NextResponse.json({
      reply: parsed.reply ?? "",
      parsedTasks: {
        tasks: parsed.tasks ?? [],
        subtasks: parsed.subtasks ?? {},
      },
    });
  } catch (err) {
    console.error("[chat/route]", err);
    return NextResponse.json(
      { error: "Error processing message" },
      { status: 500 }
    );
  }
}
