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
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    console.error("[Chat Handler] Error:", error);

    // Enviar mensaje de error al chat
    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: `⚠️ Error: ${messageText}`,
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

  const systemPrompt = `Eres @tairos-architect de Tairos OS. Responde SIEMPRE en español.

Sigue EXACTAMENTE el formato del ejemplo. No agregues introducciones como "Entendido" ni preguntes al final.

---
EJEMPLO DE ENTRADA:
/new-app de gestión de inventarios para restaurantes

EJEMPLO DE SALIDA:
**1. Propuesta de valor**
SaaS de control de inventarios para restaurantes que reduce pérdidas y automatiza reabastecimiento.

**2. Stack confirmado**
- Next.js 16 + React 19 + TypeScript + Tailwind CSS 3.4
- Supabase (PostgreSQL + Auth + Realtime + Storage)
- Arquitectura Feature-First en src/features/
- Reutiliza skills de SaaS Factory V5
- Deploy en Vercel

**3. Tablas de Supabase sugeridas**
- productos: id, nombre, categoria_id, stock, precio, created_at
- categorias: id, nombre, created_at
- movimientos: id, producto_id, tipo, cantidad, created_at

**4. Features a implementar en src/features/**
- product-catalog: gestión de productos y categorías
- stock-control: entradas, salidas y alertas de stock bajo
- reports: dashboards de movimientos y reportes

**5. Flujo de gobernanza**
- PRP v1.0 generada
- Votación abierta a Negocio, Frontend y Backend
- Se requieren 2 aprobaciones de 3 para iniciar desarrollo
- Tras aprobación, el pipeline A2A (Architect → Workers) construye la app

**6. Conclusión**
He generado la PRP v1.0: InventarioRestaurante. Necesito al menos 2 aprobaciones de 3 humanos para iniciar el pipeline A2A.
---

Ahora procesa esta solicitud y responde con el MISMO formato:
${appDescription}

Reglas:
- No uses MongoDB, Vue, Python, Laravel ni stacks alternativos.
- El stack SIEMPRE es Next.js 16 + React 19 + TypeScript + Tailwind + Supabase.
- La conclusión DEBE citar PRP y votación 2/3.
- Sé conciso.`;

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
        content: `Eres @tairos-architect de Tairos OS. Stack fijo: Next.js 16 + React 19 + TypeScript + Tailwind + Supabase. Arquitectura Feature-First en src/features/. Analiza la funcionalidad solicitada y propón cómo implementarla dentro de este stack. Menciona tablas de Supabase, componentes React, hooks y servicios a crear. Responde en español, sé conciso.`,
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
        content: `Eres @tairos-architect de Tairos OS. Genera una PRP (Product Requirements Proposal) estructurada en Markdown para el stack fijo: Next.js 16 + React 19 + TypeScript + Tailwind + Supabase. Incluye: problema, solución, usuario objetivo, stack confirmado, tablas de Supabase, features a implementar (src/features/), plan de desarrollo, KPI de éxito y criterios de aceptación. Recuerda: requiere aprobación 2/3 de los humanos. Responde en español.`,
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

  const contextMessages: { role: "user"; content: string }[] = [];

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
        content: `Eres @tairos-architect, el agente principal de Tairos OS, una fábrica de software dirigida por intenciones. Stack fijo: Next.js 16 + React 19 + TypeScript + Tailwind + Supabase. Gobernanza: aprobación democrática 2/3 de los humanos (Negocio, Frontend, Backend) antes de construir o desplegar. Puedes ayudar con: /new-app [descripción], /feature [descripción], /prp [descripción], o responder preguntas técnicas dentro del stack. Responde en español, de forma útil y concisa.`,
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
