/**
 * llm.js — Cliente centralizado de IA para Tairos OS
 * 
 * Soporta dos modos:
 * 1. OpenRouter (Claude, Qwen online) - RECOMENDADO
 * 2. Ollama local (modelos open source) - MODO OFFLINE
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Modelos disponibles por rol
const MODELS = {
  // OpenRouter
  openrouter: {
    architect: "anthropic/claude-sonnet-4",
    worker: "qwen/qwen-2.5-coder-32b-instruct",
    healer: "qwen/qwen-2.5-coder-32b-instruct",
  },
  // Ollama local
  ollama: {
    architect: "qwen3.5:9b",
    worker: "qwen3.5:9b",
    healer: "qwen3.5:9b",
  },
};

/**
 * Detecta el provider disponible (OpenRouter o Ollama).
 */
function getProvider() {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  // Priorizar OpenRouter si está configurado
  if (openrouterKey && !openrouterKey.includes("tu-") && !openrouterKey.includes("aqui")) {
    return { type: "openrouter", url: OPENROUTER_URL, key: openrouterKey };
  }

  // Fallback a Ollama local
  return { type: "ollama", url: ollamaUrl, key: null };
}

/**
 * Llama a un modelo de IA a través de OpenRouter o Ollama.
 * 
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages - Mensajes del chat
 * @param {string} [options.model] - Modelo a usar (default: architect)
 * @param {number} [options.maxTokens] - Máximo de tokens en la respuesta
 * @param {number} [options.temperature] - Creatividad (0.0 - 1.0)
 * @param {boolean} [options.useCache=true] - Usar cache para respuestas
 * @returns {Promise<{content: string, model: string, usage: Object}>}
 */
async function callLLM({ messages, model = "architect", maxTokens = 2048, temperature = 0.7, useCache = true }) {
  // Intentar obtener del cache primero
  if (useCache) {
    try {
      const { getCachedResponse } = require("./cost-optimizer");
      const cached = getCachedResponse(messages, model);
      if (cached) {
        return cached;
      }
    } catch (err) {
      // Cost optimizer no disponible, continuar sin cache
    }
  }

  const provider = getProvider();

  if (provider.type === "openrouter") {
    return await callOpenRouter({ messages, model, maxTokens, temperature, useCache, provider });
  } else {
    return await callOllama({ messages, model, maxTokens, temperature, useCache, provider });
  }
}

/**
 * Llama a OpenRouter (modo online).
 */
async function callOpenRouter({ messages, model, maxTokens, temperature, useCache, provider }) {
  const modelId = MODELS.openrouter[model] || MODELS.openrouter.architect;

  const body = {
    model: modelId,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tairos-os.local",
          "X-Title": "Tairos OS Runner",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
        console.error(`[LLM] Intento ${attempt} fallido:`, lastError.message);
        
        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }
        throw lastError;
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error("OpenRouter devolvió una respuesta vacía");
      }

      const result = {
        content: data.choices[0].message.content,
        model: data.model || modelId,
        usage: data.usage || {},
      };

      const totalTokens = result.usage.total_tokens || 0;
      console.log(`[LLM] ✓ OpenRouter | Modelo: ${result.model} | Tokens: ${totalTokens}`);

      try {
        const { logUsage, setCachedResponse } = require("./cost-optimizer");
        const cost = logUsage({
          model: result.model,
          prompt_tokens: result.usage.prompt_tokens || 0,
          completion_tokens: result.usage.completion_tokens || 0,
        });
        console.log(`[LLM] Costo: $${cost.toFixed(4)}`);

        if (useCache) {
          setCachedResponse(messages, model, result, cost);
        }
      } catch (err) {
        // Cost optimizer no disponible
      }

      return result;

    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        console.warn(`[LLM] Reintentando en 2s... (intento ${attempt}/2)`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.error("[LLM] OpenRouter falló. Intentando con Ollama local...");
  
  // Fallback a Ollama si OpenRouter falla
  const ollamaProvider = { type: "ollama", url: process.env.OLLAMA_BASE_URL || "http://localhost:11434", key: null };
  try {
    return await callOllama({ messages, model, maxTokens, temperature, useCache, provider: ollamaProvider });
  } catch (ollamaErr) {
    console.error("[LLM] Ollama también falló. Usando fallback.");
    return {
      content: generateFallbackResponse(messages, model),
      model: "fallback-local",
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      error: lastError?.message,
    };
  }
}

/**
 * Llama a Ollama (modo local).
 */
async function callOllama({ messages, model, maxTokens, temperature, useCache, provider }) {
  const modelId = MODELS.ollama[model] || MODELS.ollama.architect;

  console.log(`[LLM] Usando Ollama local: ${modelId}`);

  const body = {
    model: modelId,
    messages,
    stream: false,
    options: {
      num_predict: maxTokens,
      temperature,
    },
  };

  try {
    const response = await fetch(`${provider.url}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.message || !data.message.content) {
      throw new Error("Ollama devolvió una respuesta vacía");
    }

    const result = {
      content: data.message.content,
      model: modelId,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };

    console.log(`[LLM] ✓ Ollama | Modelo: ${result.model} | Tokens: ${result.usage.total_tokens}`);
    console.log(`[LLM] Costo: $0.00 (local)`);

    // Guardar en cache
    if (useCache) {
      try {
        const { setCachedResponse } = require("./cost-optimizer");
        setCachedResponse(messages, model, result, 0);
      } catch (err) {
        // Ignorar
      }
    }

    return result;

  } catch (err) {
    console.error("[LLM] Error con Ollama:", err.message);
    console.error("[LLM] Verifica que Ollama esté corriendo: ollama serve");
    console.error(`[LLM] Y que tengas el modelo instalado: ollama pull ${modelId}`);
    
    return {
      content: generateFallbackResponse(messages, model),
      model: "fallback-local",
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      error: err.message,
    };
  }
}

/**
 * Genera una respuesta de fallback cuando la API no está disponible.
 * Permite que el sistema siga funcionando sin conexión a la IA.
 */
function generateFallbackResponse(messages, role) {
  const lastMessage = messages[messages.length - 1]?.content || "";

  if (role === "architect" || role === "worker") {
    if (lastMessage.includes("/new-app")) {
      const appName = lastMessage.replace("/new-app", "").trim() || "Nueva Aplicación";
      return `He analizado tu solicitud para "${appName}". Propongo la siguiente arquitectura:

**Stack Técnico:**
- Frontend: Next.js 14 + React 18 + Tailwind CSS
- Base de Datos: Supabase (PostgreSQL + Realtime)
- Autenticación: Supabase Auth con RLS
- Deploy: Vercel

**Tablas principales:**
1. \`users\` — Gestión de usuarios y perfiles
2. \`${appName.toLowerCase().replace(/\s+/g, '_')}_items\` — Entidad principal del negocio
3. \`analytics\` — Métricas y eventos de uso

He generado la PRP v1.0 para votación del equipo. Necesito al menos 2 aprobaciones para proceder con la codificación.`;
    }

    if (lastMessage.includes("/feature")) {
      return `Entendido. Analizaré la funcionalidad solicitada y prepararé una propuesta técnica para votación del equipo.`;
    }

    return `He recibido tu mensaje. Estoy analizando el contexto para proporcionar la mejor respuesta técnica.

> ⚠️ Nota del sistema: La API de IA no está disponible en este momento. Esta es una respuesta de fallback. Configura \`OPENROUTER_API_KEY\` en el archivo \`.env.local\` para habilitar respuestas inteligentes.`;
  }

  if (role === "healer") {
    return `Se ha detectado un error en el código. Se recomienda revisar los logs del runner para más detalles. El sistema de auto-reparación intentará aplicar un parche cuando la API de IA esté disponible.`;
  }

  return "Respuesta de fallback del sistema.";
}

module.exports = { callLLM, MODELS };
