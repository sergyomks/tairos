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
  { pattern: /^\/new-app\s+(.+)/i, type: "new-app" },
  { pattern: /^\/feature\s+(.+)/i, type: "feature" },
  { pattern: /^\/prp\s+(.+)/i, type: "prp" },
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
