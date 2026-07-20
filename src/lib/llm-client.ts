/**
 * llm-client.ts — Cliente de IA para Vercel (solo OpenRouter)
 * 
 * Versión simplificada del runner/llm.js optimizada para Vercel.
 * Solo soporta OpenRouter (no Ollama).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Modelos de OpenRouter
const MODELS = {
  architect: "qwen/qwen-2.5-coder-32b-instruct", // Equivalente a qwen:7b local
  worker: "qwen/qwen-2.5-coder-32b-instruct",
  healer: "qwen/qwen-2.5-coder-32b-instruct",
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

/**
 * Llama a OpenRouter API
 */
export async function callLLM({
  messages,
  model = "architect",
  maxTokens = 2048,
  temperature = 0.7,
}: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. Agrega la variable de entorno en Vercel."
    );
  }

  const modelId = MODELS[model];

  console.log(`[LLM] Llamando a OpenRouter: ${modelId}`);

  const body = {
    model: modelId,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    const result: LLMResponse = {
      content: data.choices[0].message.content,
      model: data.model || modelId,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    console.log(
      `[LLM] ✓ Respuesta recibida | Modelo: ${result.model} | Tokens: ${result.usage.total_tokens}`
    );

    return result;
  } catch (error: any) {
    console.error("[LLM] Error:", error.message);
    throw new Error(`Error al llamar a OpenRouter: ${error.message}`);
  }
}
