/**
 * llm-client.ts — Cliente de IA para Tairos OS
 *
 * Soporta dos providers:
 * 1. OpenRouter (nube) — usado por defecto si OPENROUTER_API_KEY está configurada
 * 2. Ollama (local) — usado si OLLAMA_BASE_URL está configurada o como fallback
 *
 * Esto permite testear todo localmente sin gastar en API.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const MODELS = {
  groq: {
    architect: "llama-3.3-70b-versatile",
    worker: "llama-3.1-8b-instant",
    healer: "llama-3.1-8b-instant",
  },
  openrouter: {
    architect: "qwen/qwen-2.5-coder-32b-instruct",
    worker: "qwen/qwen-2.5-coder-32b-instruct",
    healer: "qwen/qwen-2.5-coder-32b-instruct",
  },
  ollama: {
    architect: "qwen2.5-coder:7b",
    worker: "qwen2.5-coder:7b",
    healer: "qwen2.5-coder:7b",
  },
};

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  messages: LLMMessage[];
  model?: "architect" | "worker" | "healer";
  maxTokens?: number;
  temperature?: number;
}

interface LLMResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

type Provider =
  | { type: "groq"; url: string; key: string }
  | { type: "openrouter"; url: string; key: string }
  | { type: "ollama"; url: string; key: null };

function getProvider(): Provider {
  const groqKey = process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (groqKey && !groqKey.includes("REEMPLAZA") && !groqKey.includes("aqui")) {
    return { type: "groq", url: GROQ_URL, key: groqKey };
  }

  if (openrouterKey && !openrouterKey.includes("REEMPLAZA") && !openrouterKey.includes("aqui")) {
    return { type: "openrouter", url: OPENROUTER_URL, key: openrouterKey };
  }

  return { type: "ollama", url: OLLAMA_BASE_URL, key: null };
}

/**
 * Llama a un modelo de IA (OpenRouter u Ollama).
 */
export async function callLLM({
  messages,
  model = "architect",
  maxTokens = 2048,
  temperature = 0.7,
}: LLMOptions): Promise<LLMResponse> {
  const provider = getProvider();

  console.log(`[LLM] Provider: ${provider.type} | Model role: ${model}`);

  try {
    if (provider.type === "groq") {
      return await callGroq({ messages, model, maxTokens, temperature, provider });
    }
    if (provider.type === "openrouter") {
      return await callOpenRouter({ messages, model, maxTokens, temperature, provider });
    }
    return await callOllama({ messages, model, maxTokens, temperature, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    console.error("[LLM] Error:", message);
    throw new Error(`Error al llamar al modelo: ${message}`);
  }
}

async function callOpenRouter({
  messages,
  model = "architect",
  maxTokens,
  temperature,
  provider,
}: LLMOptions & { provider: Extract<Provider, { type: "openrouter" }> }): Promise<LLMResponse> {
  const modelId = MODELS.openrouter[model] || MODELS.openrouter.architect;

  const body = {
    model: modelId,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tairos-os.vercel.app",
      "X-Title": "Tairos OS",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("OpenRouter devolvió una respuesta vacía");
  }

  return {
    content: data.choices[0].message.content,
    model: data.model || modelId,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function callGroq({
  messages,
  model = "architect",
  maxTokens,
  temperature,
  provider,
}: LLMOptions & { provider: Extract<Provider, { type: "groq" }> }): Promise<LLMResponse> {
  const modelId = MODELS.groq[model] || MODELS.groq.architect;

  const body = {
    model: modelId,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("Groq devolvió una respuesta vacía");
  }

  return {
    content: data.choices[0].message.content,
    model: data.model || modelId,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function callOllama({
  messages,
  model = "architect",
  maxTokens,
  temperature,
  provider,
}: LLMOptions & { provider: Extract<Provider, { type: "ollama" }> }): Promise<LLMResponse> {
  const modelId = MODELS.ollama[model] || MODELS.ollama.architect;

  const body = {
    model: modelId,
    messages,
    stream: false,
    options: {
      num_predict: maxTokens,
      temperature,
    },
  };

  const response = await fetch(`${provider.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  return {
    content: data.message.content,
    model: modelId,
    usage: {
      prompt_tokens: data.prompt_eval_count || 0,
      completion_tokens: data.eval_count || 0,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    },
  };
}
