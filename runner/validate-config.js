/**
 * validate-config.js — Script de Validación de Configuración
 * 
 * Verifica que todas las variables de entorno estén correctamente configuradas
 * antes de iniciar el runner.
 * 
 * Uso: node runner/validate-config.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${COLORS.reset} ${message}`);
}

function checkRequired(name, value, description) {
  if (!value || value.includes("tu-") || value.includes("aqui")) {
    log(COLORS.red, "✗", `${COLORS.bold}${name}${COLORS.reset} — ${description}`);
    return false;
  }
  log(COLORS.green, "✓", `${COLORS.bold}${name}${COLORS.reset} — Configurada correctamente`);
  return true;
}

function checkOptional(name, value, description) {
  if (!value || value.includes("tu-") || value.includes("aqui")) {
    log(COLORS.yellow, "○", `${COLORS.bold}${name}${COLORS.reset} — ${description} (OPCIONAL)`);
    return false;
  }
  log(COLORS.green, "✓", `${COLORS.bold}${name}${COLORS.reset} — Configurada`);
  return true;
}

console.log(`\n${COLORS.cyan}${COLORS.bold}=========================================`);
console.log("   VALIDACIÓN DE CONFIGURACIÓN");
console.log(`=========================================${COLORS.reset}\n`);

let allRequired = true;
let optionalCount = 0;

// ============================================
// FASE 1: Variables Críticas (Requeridas)
// ============================================

console.log(`${COLORS.bold}📋 FASE 1: Configuración Crítica${COLORS.reset}\n`);

allRequired &= checkRequired(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "URL de tu proyecto de Supabase"
);

allRequired &= checkRequired(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "Anon Key de Supabase"
);

allRequired &= checkRequired(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "Service Role Key de Supabase"
);

console.log(`\n${COLORS.bold}🤖 Configuración de IA (al menos una opción)${COLORS.reset}\n`);

const hasOpenRouter = checkOptional(
  "OPENROUTER_API_KEY",
  process.env.OPENROUTER_API_KEY,
  "API Key de OpenRouter (requiere pago)"
);

const hasOllama = checkOptional(
  "OLLAMA_BASE_URL",
  process.env.OLLAMA_BASE_URL,
  "URL de Ollama local (GRATIS, privado)"
);

if (!hasOpenRouter && !hasOllama) {
  allRequired = false;
  log(COLORS.red, "✗", "Debes configurar al menos UNA opción de IA:");
  log(COLORS.yellow, "  →", "OLLAMA_BASE_URL (recomendado, gratis) - Ver OLLAMA-SETUP.md");
  log(COLORS.yellow, "  →", "OPENROUTER_API_KEY (pago) - https://openrouter.ai/keys");
} else if (!hasOpenRouter && hasOllama) {
  log(COLORS.green, "✓", "Usando Ollama local únicamente (modo offline)");
} else if (hasOpenRouter && !hasOllama) {
  log(COLORS.green, "✓", "Usando OpenRouter únicamente (modo online)");
} else {
  log(COLORS.green, "✓", "Usando Ollama + OpenRouter (híbrido con fallback)");
}

// ============================================
// FASE 2-4: Variables Opcionales
// ============================================

console.log(`\n${COLORS.bold}📦 FASES 2-4: Configuración Opcional${COLORS.reset}\n`);

if (checkOptional(
  "GITHUB_TOKEN",
  process.env.GITHUB_TOKEN,
  "Token de GitHub para crear PRs automáticos"
)) {
  optionalCount++;
}

if (checkOptional(
  "GITHUB_ORG",
  process.env.GITHUB_ORG,
  "Usuario u organización de GitHub"
)) {
  optionalCount++;
}

if (checkOptional(
  "VERCEL_TOKEN",
  process.env.VERCEL_TOKEN,
  "Token de Vercel para deploys automáticos"
)) {
  optionalCount++;
}

if (checkOptional(
  "VERCEL_ORG_ID",
  process.env.VERCEL_ORG_ID,
  "Organization ID de Vercel"
)) {
  optionalCount++;
}

// ============================================
// Resumen Final
// ============================================

console.log(`\n${COLORS.cyan}${COLORS.bold}=========================================${COLORS.reset}\n`);

if (allRequired) {
  log(COLORS.green, "✓", `${COLORS.bold}FASE 1: Configuración completa${COLORS.reset}`);
  console.log(`\n  El runner puede iniciar correctamente.`);
  console.log(`  Los agentes de IA están disponibles para responder comandos.\n`);
  
  if (optionalCount > 0) {
    log(COLORS.green, "✓", `${optionalCount} configuraciones opcionales activas`);
  }
  
  console.log(`\n${COLORS.cyan}Para iniciar el sistema:`);
  console.log(`  ${COLORS.bold}npm run dev:all${COLORS.reset}\n`);
  
  process.exit(0);
} else {
  log(COLORS.red, "✗", `${COLORS.bold}Configuración incompleta${COLORS.reset}`);
  console.log(`\n  ${COLORS.yellow}Acción requerida:${COLORS.reset}`);
  console.log(`  1. Copia ${COLORS.bold}.env.local.example${COLORS.reset} a ${COLORS.bold}.env.local${COLORS.reset}`);
  console.log(`  2. Completa las variables marcadas con ${COLORS.red}✗${COLORS.reset}`);
  console.log(`  3. Vuelve a ejecutar: ${COLORS.bold}node runner/validate-config.js${COLORS.reset}\n`);
  
  console.log(`${COLORS.cyan}OPCIÓN A - Ollama Local (GRATIS, recomendado):${COLORS.reset}`);
  console.log(`  1. Instala modelos: ${COLORS.bold}ollama pull qwen2.5-coder:32b${COLORS.reset}`);
  console.log(`  2. Instala modelos: ${COLORS.bold}ollama pull qwen2.5-coder:7b${COLORS.reset}`);
  console.log(`  3. Inicia servidor: ${COLORS.bold}ollama serve${COLORS.reset}`);
  console.log(`  4. En .env.local: ${COLORS.bold}OLLAMA_BASE_URL=http://localhost:11434${COLORS.reset}`);
  console.log(`  5. Ver guía completa: ${COLORS.bold}OLLAMA-SETUP.md${COLORS.reset}\n`);
  
  console.log(`${COLORS.cyan}OPCIÓN B - OpenRouter (requiere pago):${COLORS.reset}`);
  console.log(`  1. Ve a: ${COLORS.bold}https://openrouter.ai/${COLORS.reset}`);
  console.log(`  2. Crea una cuenta y añade créditos ($5-10 USD)`);
  console.log(`  3. Genera una API Key en: ${COLORS.bold}https://openrouter.ai/keys${COLORS.reset}`);
  console.log(`  4. Pégala en .env.local como OPENROUTER_API_KEY\n`);
  
  process.exit(1);
}
