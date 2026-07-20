/**
 * chat-handler.ts — Lógica del Chat Orchestrator adaptada para Vercel
 * 
 * Este archivo contiene toda la lógica del runner/chat-orchestrator.js
 * pero adaptada para funcionar como función serverless.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { callLLM } from "./llm-client";

// Patrones de comandos
const COMMAND_PATTERNS = [
  { pattern: /^\/new-app\s+(.+)/i, type: "new-app" },
  { pattern: /^\/feature\s+(.+)/i, type: "feature" },
  { pattern: /^\/prp\s+(.+)/i, type: "prp" },
  { pattern: /@tairos\b/i, type: "mention" },
];

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string | null;
  sender_name: string;
  project_id: string | null;
  image_url: string | null;
  created_at: string;
}

/**
 * Procesa un mensaje nuevo del chat
 */
export async function handleChatMessage(
  supabase: SupabaseClient,
  message: ChatMessage
) {
  console.log(`[Chat Handler] Procesando mensaje de ${message.sender_name}`);

  // Detectar comando
  const command = detectCommand(message.content);
  if (!command) {
    console.log("[Chat Handler] No es un comando, ignorando");
    return;
  }

  console.log(`[Chat Handler] Comando detectado: ${command.type}`);

  // Ejecutar el comando apropiado
  try {
    if (command.type === "new-app") {
      await handleNewApp(supabase, message, command.argument);
    } else if (command.type === "feature") {
      await handleFeature(supabase, message, command.argument);
    } else if (command.type === "prp") {
      await handlePRP(supabase, message, command.argument);
    } else if (command.type === "mention") {
      await handleMention(supabase, message, command.fullContent);
    }
  } catch (error: any) {
    console.error("[Chat Handler] Error:", error);
    
    // Enviar mensaje de error al chat
    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: `⚠️ Error: ${error.message}`,
      project_id: message.project_id,
    });
  }
}

/**
 * Detecta si un mensaje contiene un comando
 */
function detectCommand(content: string) {
  if (!content || typeof content !== "string") return null;

  for (const { pattern, type } of COMMAND_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      return {
        type,
        argument: match[1]?.trim() || content.trim(),
        fullContent: content,
      };
    }
  }
  return null;
}

/**
 * /new-app — Crear un nuevo proyecto
 */
async function handleNewApp(
  supabase: SupabaseClient,
  msg: ChatMessage,
  appDescription: string
) {
  console.log(`[Chat Handler] Procesando /new-app: "${appDescription}"`);

  const systemPrompt = `Eres @tairos-architect, el agente experto de Tairos OS especializado en arquitectura de software.

Tu tarea es analizar la solicitud de "${appDescription}" y proponer una arquitectura técnica completa y profesional.

DEBES incluir en tu respuesta:

**Stack Técnico Propuesto:**
- Frontend: (Next.js, React, Vue, etc.)
- Backend: (Node.js, Python, etc.)
- Base de Datos: (PostgreSQL, MongoDB, etc.)
- Autenticación: (JWT, OAuth, Supabase Auth, etc.)
- Deploy: (Vercel, AWS, Railway, etc.)

**Arquitectura de Base de Datos:**
Lista las tablas principales con sus campos:
1. \`tabla_1\` — Descripción (id, campo1, campo2, created_at)
2. \`tabla_2\` — Descripción (id, campo1, campo2, created_at)
3. \`tabla_3\` — Descripción (id, campo1, campo2, created_at)

**Funcionalidades Core:**
- Funcionalidad 1
- Funcionalidad 2
- Funcionalidad 3
- Funcionalidad 4

**Plan de Desarrollo:**
1. Fase 1: Base de datos y modelos
2. Fase 2: API endpoints
3. Fase 3: Frontend e integración
4. Fase 4: Testing y deployment

**Conclusión:**
Al final DEBES decir: "He generado la PRP v1.0 para votación del equipo. Necesito al menos 2 aprobaciones para iniciar el desarrollo."

Sé técnico, específico y profesional. Responde en español.`;

  const { content: architectResponse } = await callLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Solicitud: ${appDescription}` },
    ],
    model: "architect",
    maxTokens: 1536,
    temperature: 0.7,
  });

  // Insertar respuesta en el chat
  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: architectResponse,
    project_id: msg.project_id,
  });

  // Crear proyecto
  const projectName = extractProjectName(appDescription);
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: projectName,
      status: "planning",
      outcomes_data: {
        type: "SaaS",
        description: appDescription,
      },
    })
    .select()
    .single();

  if (projectError) {
    console.error("[Chat Handler] Error al crear proyecto:", projectError.message);
    return;
  }

  // Crear PRP
  const { error: prpError } = await supabase.from("prps").insert({
    project_id: project.id,
    title: `PRP v1.0: ${projectName}`,
    description: appDescription,
    sprint: "Sprint 1",
    status: "pending",
  });

  if (prpError) {
    console.error("[Chat Handler] Error al crear PRP:", prpError.message);
  } else {
    console.log(`[Chat Handler] ✓ Proyecto "${projectName}" y PRP creados`);

    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: `📋 He generado la **PRP v1.0: ${projectName}** y está lista para votación. Necesito al menos 2 aprobaciones del equipo para iniciar el pipeline de desarrollo. Revisen el panel lateral del chat para votar.`,
      project_id: project.id,
    });
  }
}

/**
 * /feature — Proponer funcionalidad
 */
async function handleFeature(
  supabase: SupabaseClient,
  msg: ChatMessage,
  featureDescription: string
) {
  console.log(`[Chat Handler] Procesando /feature: "${featureDescription}"`);

  const { content: response } = await callLLM({
    messages: [
      {
        role: "system",
        content: `Eres @tairos-architect. Analiza la funcionalidad solicitada y propone cómo implementarla. Responde en español, sé conciso. Menciona archivos a modificar y estimación de esfuerzo.`,
      },
      { role: "user", content: `Quiero agregar esta funcionalidad: ${featureDescription}` },
    ],
    model: "architect",
    maxTokens: 768,
  });

  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: response,
    project_id: msg.project_id,
  });
}

/**
 * /prp — Generar PRP
 */
async function handlePRP(
  supabase: SupabaseClient,
  msg: ChatMessage,
  prpDescription: string
) {
  console.log(`[Chat Handler] Procesando /prp: "${prpDescription}"`);

  const { content: response } = await callLLM({
    messages: [
      {
        role: "system",
        content: `Eres @tairos-architect. Genera una propuesta técnica de requisitos (PRP) estructurada en Markdown basada en la descripción del usuario. Incluye: objetivo, alcance, tablas de DB, endpoints API, componentes UI, y criterios de aceptación. Responde en español.`,
      },
      { role: "user", content: prpDescription },
    ],
    model: "architect",
    maxTokens: 1536,
  });

  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: response,
    project_id: msg.project_id,
  });
}

/**
 * @tairos — Mención general
 */
async function handleMention(
  supabase: SupabaseClient,
  msg: ChatMessage,
  fullContent: string
) {
  console.log(`[Chat Handler] Mención detectada de ${msg.sender_name}`);

  // Verificar si hay imagen
  if (msg.image_url && msg.image_url.trim() !== "") {
    const response = `Lo siento, actualmente no puedo analizar imágenes. El modelo que estoy usando es solo de texto.

Para habilitar análisis de imágenes en el futuro, se necesitaría integrar un modelo con capacidad de visión como GPT-4 Vision o Claude 3.

Mientras tanto, puedes describir la imagen con palabras y te ayudaré con eso. 😊`;

    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: response,
      project_id: msg.project_id,
    });
    return;
  }

  // Obtener contexto reciente (últimos 3 mensajes de humanos)
  const { data: recentMessages } = await supabase
    .from("chat_messages")
    .select("sender_name, content")
    .not("sender_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);

  let contextMessages: any[] = [];

  if (recentMessages && recentMessages.length > 0) {
    const contextStr = recentMessages
      .reverse()
      .map((m) => `${m.sender_name}: ${m.content}`)
      .join("\n");

    contextMessages.push({
      role: "user",
      content: `Contexto reciente:\n${contextStr}`,
    });
  }

  contextMessages.push({
    role: "user",
    content: `${msg.sender_name} dice: ${fullContent}`,
  });

  const { content: response } = await callLLM({
    messages: [
      {
        role: "system",
        content: `Eres @tairos-architect, el agente principal de Tairos OS. 
Responde de forma útil y concisa en español. 
Puedes ayudar con:
- /new-app [nombre]: Crear una nueva aplicación
- /feature [descripción]: Agregar funcionalidad
- /prp [descripción]: Generar propuesta técnica
- Responder preguntas técnicas sobre el proyecto`,
      },
      ...contextMessages,
    ],
    model: "architect",
    maxTokens: 512,
  });

  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: response,
    project_id: msg.project_id,
  });
}

/**
 * Extrae nombre del proyecto
 */
function extractProjectName(description: string): string {
  const words = description.split(/\s+/).slice(0, 3);
  const name = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, "")
    .trim();
  return name || "Nuevo Proyecto";
}
