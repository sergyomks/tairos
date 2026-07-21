/**
 * chat-orchestrator.js — Orquestador de Chat para Tairos OS
 * 
 * Escucha nuevos mensajes en el chat. Si detecta un comando de intención
 * (/new-app, /feature, /prp) o una mención a @tairos, genera una respuesta
 * inteligente usando el Agente Architect y opcionalmente crea una PRP.
 */

const { callLLM } = require("./llm");
const { 
  getCachedResponse, 
  setCachedResponse, 
  logUsage 
} = require("./cost-optimizer");

// Patrones de comandos que activan al Architect
const COMMAND_PATTERNS = [
  { pattern: /\/new-app\s+(.+)/i, type: "new-app" },
  { pattern: /\/feature\s+(.+)/i, type: "feature" },
  { pattern: /\/prp\s+(.+)/i, type: "prp" },
  { pattern: /@tairos\b/i, type: "mention" },
];

// Evitar que el bot responda a sus propios mensajes
const AGENT_SENDER_NAMES = ["@tairos-architect", "Tairos Agent", "System"];

/**
 * Inicializa el orquestador de chat.
 * Escucha INSERT en chat_messages y responde cuando detecta comandos.
 * 
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
function initChatOrchestrator(supabase) {
  console.log("[Chat Orchestrator] Iniciando escucha de comandos en el chat...");

  const channel = supabase
    .channel("runner-chat-orchestrator")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      async (payload) => {
        const msg = payload.new;

        // Ignorar mensajes del propio agente
        if (AGENT_SENDER_NAMES.some((name) => msg.sender_name === name)) {
          return;
        }
        if (!msg.sender_id) {
          return; // Mensajes sin sender_id son del sistema
        }

        // Detectar si hay un comando
        const command = detectCommand(msg.content);
        if (!command) return;

        console.log(`[Chat Orchestrator] Comando detectado: ${command.type} de ${msg.sender_name}`);

        try {
          await handleCommand(supabase, msg, command);
        } catch (err) {
          console.error("[Chat Orchestrator] Error al procesar comando:", err.message);
          
          // Enviar mensaje de error al chat
          await supabase.from("chat_messages").insert({
            sender_id: null,
            sender_name: "@tairos-architect",
            content: `⚠️ Error al procesar el comando: ${err.message}. Verifica la configuración del runner.`,
            project_id: msg.project_id || null,
          });
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Chat Orchestrator] Canal suscrito: ${status}`);
    });

  return channel;
}

/**
 * Detecta si un mensaje contiene un comando válido.
 */
function detectCommand(content) {
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
 * Maneja un comando detectado en el chat.
 */
async function handleCommand(supabase, originalMsg, command) {
  if (command.type === "new-app") {
    await handleNewApp(supabase, originalMsg, command.argument);
  } else if (command.type === "feature") {
    await handleFeature(supabase, originalMsg, command.argument);
  } else if (command.type === "prp") {
    await handlePRP(supabase, originalMsg, command.argument);
  } else if (command.type === "mention") {
    await handleMention(supabase, originalMsg, command.fullContent);
  }
}

/**
 * /new-app — Crear un nuevo proyecto desde cero.
 * El Architect analiza la intención, responde en el chat y crea una PRP.
 */
async function handleNewApp(supabase, msg, appDescription) {
  console.log(`[Chat Orchestrator] Procesando /new-app: "${appDescription}"`);

  // 1. Generar respuesta del Architect
  const systemPrompt = `Eres @tairos-architect de Tairos OS. Responde en español.

Stack fijo: Next.js 16 + React 19 + TypeScript + Tailwind CSS + Supabase. No propongas otro stack.

Para la solicitud "${appDescription}", responde EXACTAMENTE con estas 6 secciones numeradas:

1. Propuesta de valor: una frase.
2. Stack confirmado: Next.js 16 + React 19 + TypeScript + Tailwind + Supabase.
3. Tablas de Supabase sugeridas: lista de 3 tablas con campos.
4. Features a implementar en src/features/: lista de 3 features.
5. Flujo de gobernanza: PRP generada → votación 2/3 de humanos → pipeline A2A.
6. Conclusión: escribe exactamente "He generado la PRP v1.0 para votación. Necesito al menos 2 aprobaciones de 3 humanos para iniciar el pipeline A2A."

No saludes, no preguntes, no agregues texto fuera de las 6 secciones.`;

  const { content: architectResponse } = await callLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Solicitud: ${appDescription}` },
    ],
    model: "architect",
    maxTokens: 1536,
    temperature: 0.3,
    useCache: false,
  });

  // 2. Insertar respuesta en el chat
  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: architectResponse,
    project_id: msg.project_id || null,
  });

  // 3. Crear proyecto en la base de datos
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
    console.error("[Chat Orchestrator] Error al crear proyecto:", projectError.message);
    return;
  }

  // 4. Crear PRP para votación
  const { error: prpError } = await supabase.from("prps").insert({
    project_id: project.id,
    title: `PRP v1.0: ${projectName}`,
    description: appDescription,
    sprint: "Sprint 1",
    status: "pending",
  });

  if (prpError) {
    console.error("[Chat Orchestrator] Error al crear PRP:", prpError.message);
  } else {
    console.log(`[Chat Orchestrator] ✓ Proyecto "${projectName}" y PRP creados exitosamente.`);

    // 5. Notificar en el chat que la PRP está lista para votar
    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: `📋 He generado la **PRP v1.0: ${projectName}** y está lista para votación. Necesito al menos 2 aprobaciones del equipo para iniciar el pipeline de desarrollo. Revisen el panel lateral del chat para votar.`,
      project_id: project.id,
    });
  }
}

/**
 * /feature — Proponer una nueva funcionalidad para un proyecto existente.
 */
async function handleFeature(supabase, msg, featureDescription) {
  console.log(`[Chat Orchestrator] Procesando /feature: "${featureDescription}"`);

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
    project_id: msg.project_id || null,
  });
}

/**
 * /prp — Generar una propuesta de requisitos manualmente.
 */
async function handlePRP(supabase, msg, prpDescription) {
  console.log(`[Chat Orchestrator] Procesando /prp: "${prpDescription}"`);

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
    project_id: msg.project_id || null,
  });
}

/**
 * @tairos — Mención general al agente.
 */
async function handleMention(supabase, msg, fullContent) {
  console.log(`[Chat Orchestrator] Mención detectada de ${msg.sender_name}`);

  // Verificar si el mensaje tiene imagen
  const hasImage = msg.image_url && msg.image_url.trim() !== "";

  if (hasImage) {
    // El modelo actual NO soporta imágenes
    const response = `Lo siento, actualmente no puedo analizar imágenes. El modelo que estoy usando (qwen2.5-coder:3b) es solo de texto.

Para habilitar análisis de imágenes, necesitas instalar un modelo con capacidad de visión:

\`\`\`bash
ollama pull llama3.2-vision
# o
ollama pull llava:7b
\`\`\`

Mientras tanto, puedes describir la imagen con palabras y te ayudaré con eso. 😊`;

    await supabase.from("chat_messages").insert({
      sender_id: null,
      sender_name: "@tairos-architect",
      content: response,
      project_id: msg.project_id || null,
    });
    return;
  }

  // Obtener últimos 3 mensajes de HUMANOS para contexto (excluir mensajes del bot)
  const { data: recentMessages } = await supabase
    .from("chat_messages")
    .select("sender_name, content")
    .not("sender_id", "is", null) // Solo mensajes de humanos
    .order("created_at", { ascending: false })
    .limit(3);

  let contextMessages = [];
  
  // Agregar contexto solo si hay mensajes recientes relevantes
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

  // Agregar el mensaje actual
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
    project_id: msg.project_id || null,
  });
}

/**
 * Extrae un nombre limpio del proyecto a partir de la descripción.
 */
function extractProjectName(description) {
  // Intentar extraer un nombre corto de la descripción
  const words = description.split(/\s+/).slice(0, 3);
  const name = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, "")
    .trim();
  return name || "Nuevo Proyecto";
}

module.exports = { initChatOrchestrator };
