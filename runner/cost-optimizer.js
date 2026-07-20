/**
 * cost-optimizer.js — Optimizador de Costos de IA para Tairos OS
 * 
 * Funcionalidades:
 * - Routing inteligente de modelos (caro vs barato)
 * - Cache de respuestas frecuentes
 * - Tracking de uso y costos
 * - Alertas de presupuesto
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.resolve(__dirname, "..", ".cache");
const COST_LOG_FILE = path.join(CACHE_DIR, "cost-log.json");

// Precios por millón de tokens (en USD)
const MODEL_COSTS = {
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "qwen/qwen-2.5-coder-32b-instruct": { input: 0.14, output: 0.14 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.35, output: 0.40 },
  "google/gemini-pro-1.5": { input: 1.25, output: 5.0 },
};

// Límites y alertas
const DAILY_BUDGET_USD = 50; // $50/día por defecto
const ALERT_THRESHOLD = 0.8; // Alertar al 80% del presupuesto

/**
 * Inicializa el sistema de cache y logs.
 */
function initCostOptimizer() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  if (!fs.existsSync(COST_LOG_FILE)) {
    fs.writeFileSync(COST_LOG_FILE, JSON.stringify({ entries: [], totalCost: 0 }));
  }

  console.log("[Cost Optimizer] Sistema inicializado");
}

/**
 * Genera hash de una consulta para cache.
 */
function hashQuery(messages, model) {
  const content = JSON.stringify({ messages, model });
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Busca en cache una respuesta previa.
 * 
 * @param {Array} messages - Mensajes de la consulta
 * @param {string} model - Modelo solicitado
 * @returns {Object|null} - Respuesta cacheada o null
 */
function getCachedResponse(messages, model) {
  const hash = hashQuery(messages, model);
  const cacheFile = path.join(CACHE_DIR, `${hash}.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      
      // Verificar que no esté expirado (24 horas)
      const age = Date.now() - cached.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        console.log(`[Cost Optimizer] ✓ Cache hit - ahorro: $${cached.cost.toFixed(4)}`);
        return cached.response;
      }
    } catch (err) {
      // Cache corrupto, ignorar
    }
  }

  return null;
}

/**
 * Guarda una respuesta en cache.
 */
function setCachedResponse(messages, model, response, cost) {
  const hash = hashQuery(messages, model);
  const cacheFile = path.join(CACHE_DIR, `${hash}.json`);

  const cacheData = {
    timestamp: Date.now(),
    model,
    response,
    cost,
  };

  fs.writeFileSync(cacheFile, JSON.stringify(cacheData));
}

/**
 * Registra el uso de un modelo y su costo.
 * 
 * @param {Object} usage - { model, prompt_tokens, completion_tokens }
 * @returns {number} - Costo en USD
 */
function logUsage({ model, prompt_tokens, completion_tokens }) {
  const costs = MODEL_COSTS[model] || { input: 0, output: 0 };
  
  const inputCost = (prompt_tokens / 1_000_000) * costs.input;
  const outputCost = (completion_tokens / 1_000_000) * costs.output;
  const totalCost = inputCost + outputCost;

  // Leer log actual
  let log = { entries: [], totalCost: 0 };
  if (fs.existsSync(COST_LOG_FILE)) {
    try {
      log = JSON.parse(fs.readFileSync(COST_LOG_FILE, "utf-8"));
    } catch (err) {
      // Log corrupto, reiniciar
    }
  }

  // Agregar nueva entrada
  log.entries.push({
    timestamp: new Date().toISOString(),
    model,
    tokens: { input: prompt_tokens, output: completion_tokens },
    cost: totalCost,
  });
  log.totalCost += totalCost;

  // Guardar
  fs.writeFileSync(COST_LOG_FILE, JSON.stringify(log, null, 2));

  // Verificar presupuesto diario
  const todayCost = getTodayCost(log);
  if (todayCost >= DAILY_BUDGET_USD * ALERT_THRESHOLD) {
    console.warn(`[Cost Optimizer] ⚠️ ALERTA: Presupuesto diario al ${((todayCost / DAILY_BUDGET_USD) * 100).toFixed(1)}%`);
  }

  return totalCost;
}

/**
 * Obtiene el costo acumulado del día actual.
 */
function getTodayCost(log) {
  const today = new Date().toISOString().split("T")[0];
  return log.entries
    .filter((e) => e.timestamp.startsWith(today))
    .reduce((sum, e) => sum + e.cost, 0);
}

/**
 * Obtiene estadísticas de uso.
 * 
 * @returns {Object} - { totalCost, todayCost, totalRequests, topModels }
 */
function getUsageStats() {
  if (!fs.existsSync(COST_LOG_FILE)) {
    return { totalCost: 0, todayCost: 0, totalRequests: 0, topModels: [] };
  }

  const log = JSON.parse(fs.readFileSync(COST_LOG_FILE, "utf-8"));
  const todayCost = getTodayCost(log);

  // Agrupar por modelo
  const modelUsage = {};
  log.entries.forEach((e) => {
    if (!modelUsage[e.model]) {
      modelUsage[e.model] = { count: 0, cost: 0 };
    }
    modelUsage[e.model].count++;
    modelUsage[e.model].cost += e.cost;
  });

  const topModels = Object.entries(modelUsage)
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return {
    totalCost: log.totalCost,
    todayCost,
    totalRequests: log.entries.length,
    topModels,
  };
}

/**
 * Selecciona el modelo óptimo según el tipo de tarea.
 * 
 * @param {string} taskType - "architect", "worker", "healer"
 * @param {Object} context - { complexity, budget, priority }
 * @returns {string} - Modelo seleccionado
 */
function selectOptimalModel(taskType, context = {}) {
  const { complexity = "medium", budget = "normal", priority = "normal" } = context;

  // Budget estricto: usar modelos baratos siempre
  if (budget === "strict") {
    return "qwen/qwen-2.5-coder-32b-instruct";
  }

  // Prioridad alta o complejidad alta: usar Claude
  if (priority === "high" || complexity === "high") {
    if (taskType === "architect") {
      return "anthropic/claude-sonnet-4";
    }
  }

  // Prioridad baja o complejidad baja: usar modelos baratos
  if (priority === "low" || complexity === "low") {
    return "qwen/qwen-2.5-coder-32b-instruct";
  }

  // Por defecto, según el rol
  const defaults = {
    architect: "anthropic/claude-sonnet-4",
    worker: "qwen/qwen-2.5-coder-32b-instruct",
    healer: "qwen/qwen-2.5-coder-32b-instruct",
  };

  return defaults[taskType] || defaults.worker;
}

/**
 * Limpia el cache antiguo (> 7 días).
 */
function cleanOldCache() {
  if (!fs.existsSync(CACHE_DIR)) return;

  const files = fs.readdirSync(CACHE_DIR);
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días
  let cleaned = 0;

  files.forEach((file) => {
    if (!file.endsWith(".json") || file === "cost-log.json") return;

    const filePath = path.join(CACHE_DIR, file);
    try {
      const cached = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (now - cached.timestamp > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch (err) {
      // Archivo corrupto, eliminar
      fs.unlinkSync(filePath);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    console.log(`[Cost Optimizer] Limpiados ${cleaned} archivos de cache antiguos`);
  }
}

/**
 * Resetea las estadísticas del día (ejecutar diariamente).
 */
function resetDailyStats() {
  if (!fs.existsSync(COST_LOG_FILE)) return;

  const log = JSON.parse(fs.readFileSync(COST_LOG_FILE, "utf-8"));
  const today = new Date().toISOString().split("T")[0];

  // Mantener solo los últimos 30 días
  log.entries = log.entries.filter((e) => {
    const entryDate = e.timestamp.split("T")[0];
    const age = Math.floor((new Date(today) - new Date(entryDate)) / (24 * 60 * 60 * 1000));
    return age < 30;
  });

  // Recalcular costo total
  log.totalCost = log.entries.reduce((sum, e) => sum + e.cost, 0);

  fs.writeFileSync(COST_LOG_FILE, JSON.stringify(log, null, 2));
  console.log("[Cost Optimizer] Estadísticas diarias reseteadas");
}

module.exports = {
  initCostOptimizer,
  getCachedResponse,
  setCachedResponse,
  logUsage,
  getUsageStats,
  selectOptimalModel,
  cleanOldCache,
  resetDailyStats,
  MODEL_COSTS,
};
