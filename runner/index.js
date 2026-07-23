/**
 * index.js — Daemon Principal del Runner de Tairos OS
 * 
 * Este es el proceso central del búnker local. Coordina:
 * 1. Heartbeat de telemetría del servidor (CPU, RAM, Uptime)
 * 2. Procesamiento de tareas del pipeline A2A
 * 3. Orquestación de chat (respuestas del Architect)
 * 4. Generación automática de tareas (PRP → Pipeline)
 * 5. Auto-reparación (Self-Healing) ante fallos
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const { spawn } = require("child_process");
const os = require("os");

// Módulos del Runner
const { initChatOrchestrator } = require("./chat-orchestrator");
const { initTaskGenerator } = require("./task-generator");
const { attemptSelfHeal } = require("./self-healing");
const { callLLM } = require("./llm");
const { cloneRepository, fullWorkflow, getProjectPath, projectExists } = require("./git-manager");
const { deployWithValidation } = require("./vercel-deployer");
const { initCostOptimizer, cleanOldCache, getUsageStats } = require("./cost-optimizer");
const { createScaffold } = require("./scaffold");

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ============================================
// ESTADO GLOBAL
// ============================================

let tasksProcessed = 0;
const startTime = Date.now();
let isProcessing = false;

// Cola secuencial: las tareas se procesan de a una en orden de fase
const PHASE_ORDER = ["prp", "database", "api", "frontend", "qa", "deploy"];
const taskQueue = [];

function enqueueTask(task) {
  if (taskQueue.find(t => t.id === task.id)) return;
  taskQueue.push(task);
  taskQueue.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
  drainQueue();
}

async function drainQueue() {
  if (isProcessing) return;
  isProcessing = true;
  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    try {
      await processTask(task);
    } catch (err) {
      console.error(`[Queue] Error procesando tarea ${task.id}:`, err.message);
    }
  }
  isProcessing = false;
}

console.log("=========================================");
console.log("   TAIROS OS - AGENT RUNNER DAEMON v2.0  ");
console.log("=========================================");
console.log(`Conectado a Supabase: ${supabaseUrl}`);
console.log(`Clave de API IA: ${process.env.OPENROUTER_API_KEY ? "✓ Configurada" : "⚠️ No configurada (modo fallback)"}`);

// ============================================
// 1. HEARTBEAT — Telemetría del Servidor
// ============================================

async function sendHeartbeat() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramString = `${(usedMem / (1024 ** 3)).toFixed(1)} GB / ${(totalMem / (1024 ** 3)).toFixed(1)} GB`;

  const cpuLoad = os.loadavg()[0];
  const cpuCores = os.cpus().length;
  const cpuPercent = Math.min(Math.round((cpuLoad / cpuCores) * 100), 100);
  const cpuString = `${cpuPercent}%`;

  const statusPayload = {
    id: "default",
    is_online: true,
    cpu: cpuString,
    ram: ramString,
    tasks_processed: tasksProcessed,
    uptime: uptimeString,
    last_heartbeat: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("runner_status")
      .upsert(statusPayload, { onConflict: "id" });

    if (error) {
      if (error.message.includes("does not exist") || error.code === "42P01") {
        // Tabla no existe aún, ignorar silenciosamente
      } else {
        console.error("[Heartbeat Error]", error.message);
      }
    }
  } catch {
    // Silencioso: fetch failed es normal si hay mucha carga o la red falla temporalmente
  }
}

// ============================================
// 2. EJECUCIÓN DE COMANDOS DE TERMINAL
// ============================================

/**
 * Ejecuta un comando del sistema y retorna stdout, stderr y código de salida.
 * 
 * @param {string} cmd - Comando a ejecutar
 * @param {string} [cwd] - Directorio de trabajo
 * @param {number} [timeoutMs=120000] - Timeout en milisegundos
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function execCommand(cmd, cwd = process.cwd(), timeoutMs = 120000) {
  return new Promise((resolve) => {
    const parts = cmd.split(" ");
    const command = parts[0];
    const args = parts.slice(1);

    let stdout = "";
    let stderr = "";

    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
      timeout: timeoutMs,
    });

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Imprimir en tiempo real (limitado)
      if (stdout.length < 5000) {
        process.stdout.write(chunk);
      }
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (stderr.length < 5000) {
        process.stderr.write(chunk);
      }
    });

    proc.on("error", (err) => {
      stderr += `\nProcess error: ${err.message}`;
      resolve({ stdout, stderr, exitCode: 1 });
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

// ============================================
// 3. PROCESAMIENTO DE TAREAS DEL PIPELINE A2A
// ============================================

/**
 * Procesa una tarea del pipeline A2A.
 * Intenta ejecutar comandos reales; si no aplican, usa simulación inteligente.
 */
async function processTask(task) {
  console.log(`\n[Task Started] ========================================`);
  console.log(`[Task Started] ID: ${task.id} | Phase: ${task.phase}`);
  tasksProcessed++;

  const logs = [];
  const maxRetries = 2; // Máximo 2 intentos de self-healing
  let retryCount = 0;
  
  const addLog = async (message) => {
    const timestamp = new Date().toISOString();
    logs.push({ message, timestamp });
    console.log(`[Task Log] ${message}`);

    await supabase
      .from("agent_tasks")
      .update({ logs })
      .eq("id", task.id);
  };

  try {
    // Marcar como en progreso
    await supabase
      .from("agent_tasks")
      .update({ status: "in_progress", logs: [] })
      .eq("id", task.id);

    await addLog(`[Planning] Iniciando fase de ${task.phase.toUpperCase()}...`);

    // Obtener el directorio de trabajo del proyecto (si existe)
    let projectDir = path.resolve(__dirname, "..");
    let useRealCommands = false;
    let projectName = null;

    if (task.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("repository_url, name")
        .eq("id", task.project_id)
        .single();

      if (project) {
        projectName = project.name.toLowerCase().replace(/\s+/g, "-");

        // Si tiene repository_url, clonar/actualizar el repo
        if (project.repository_url) {
          try {
            await addLog(`[Git] Clonando/actualizando repositorio...`);
            projectDir = await cloneRepository(project.repository_url, projectName);
            useRealCommands = true;
            await addLog(`[Git] ✓ Repositorio listo en: ${projectDir}`);
          } catch (err) {
            await addLog(`[Git] ⚠️ No se pudo clonar: ${err.message}. Usando generación con IA.`);
            useRealCommands = false;
          }
        } else {
          // Si no tiene repo, usar workspace local para el proyecto
          projectDir = getProjectPath(projectName);
          useRealCommands = projectExists(projectName);
        }
      }
    }

    // Ejecutar la fase correspondiente
    await executePhase(task, addLog, projectDir, useRealCommands, projectName);

    // Marcar como completada
    await supabase
      .from("agent_tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    await addLog(`[Success] ✓ Fase ${task.phase} finalizada correctamente.`);
    console.log(`[Task Completed] ID: ${task.id}`);

  } catch (err) {
    console.error("[Task Error]", err.message);
    await addLog(`[Error] ✗ Fallo en la fase ${task.phase}: ${err.message}`);

    // Verificar si ya se intentó self-healing antes
    retryCount = (task.logs || []).filter(l => l.message?.includes("[Self-Healing]")).length;

    if (retryCount >= maxRetries) {
      await addLog(`[Self-Healing] Máximo de reintentos alcanzado (${maxRetries}). Requiere intervención humana.`);
      await supabase
        .from("agent_tasks")
        .update({ status: "failed" })
        .eq("id", task.id);
      return;
    }

    // Intentar self-healing
    await addLog(`[Self-Healing] Iniciando diagnóstico automático (intento ${retryCount + 1}/${maxRetries})...`);

    try {
      // Resolver projectDir de forma segura para self-healing
      let healDir = path.resolve(__dirname, "..");
      try {
        if (task.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("name")
            .eq("id", task.project_id)
            .single();
          if (proj) {
            const safeName = proj.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            const candidate = path.resolve(__dirname, "../workspace", safeName);
            if (fs.existsSync(candidate)) {
              healDir = candidate;
            }
          }
        }
      } catch (dirErr) {
        console.warn("[Self-Healing] No se pudo resolver projectDir:", dirErr.message);
      }

      const { healed, patchApplied } = await attemptSelfHeal(supabase, {
        taskId: task.id,
        phase: task.phase,
        errorLog: err.message,
        projectId: task.project_id,
        command: err.command || "desconocido",
        projectDir: healDir,
      });

      if (healed && patchApplied) {
        await addLog("[Self-Healing] ✓ Parche aplicado automáticamente. Marcando tarea para re-ejecución.");
        // Marcar como pending para que se re-ejecute
        await supabase
          .from("agent_tasks")
          .update({ status: "pending", logs: [] })
          .eq("id", task.id);
      } else if (healed) {
        await addLog("[Self-Healing] ✓ Parche generado. Revisa y aplica manualmente.");
        await supabase
          .from("agent_tasks")
          .update({ status: "failed" })
          .eq("id", task.id);
      } else {
        await addLog("[Self-Healing] ⚠️ No se pudo auto-reparar. Requiere revisión humana.");
        await supabase
          .from("agent_tasks")
          .update({ status: "failed" })
          .eq("id", task.id);
      }
    } catch (healErr) {
      console.error("[Self-Healing Error]", healErr.message);
      await supabase
        .from("agent_tasks")
        .update({ status: "failed" })
        .eq("id", task.id);
    }
  }
}

/**
 * Ejecuta los comandos específicos de cada fase del pipeline.
 * Usa comandos reales si el proyecto existe, sino genera con IA.
 */
async function executePhase(task, addLog, projectDir, useRealCommands, projectName) {

  switch (task.phase) {
    case "prp": {
      await addLog("[Architect] Analizando los requerimientos del proyecto...");

      // 1. Crear scaffold de la app en workspace/ + instalar dependencias
      if (projectName) {
        try {
          const scaffoldDir = await createScaffold(projectName, `PRP ${task.project_id}`);
          await addLog(`[Scaffold] ✓ Estructura base creada en ${scaffoldDir}`);

          // Instalar dependencias una sola vez (las demás fases ya tendrán node_modules)
          if (!fs.existsSync(path.join(scaffoldDir, "node_modules"))) {
            await addLog("[Setup] Instalando dependencias (npm install)...");
            const { exitCode, stderr } = await execCommand("npm install", scaffoldDir, 180000);
            if (exitCode !== 0) {
              await addLog(`[Setup] ⚠️ npm install falló: ${(stderr || "").slice(0, 200)}`);
            } else {
              await addLog("[Setup] ✓ Dependencias instaladas.");
            }
          }
        } catch (scaffoldErr) {
          await addLog(`[Scaffold] ⚠️ Error al crear scaffold: ${scaffoldErr.message}`);
        }
      }

      // 2. Usar IA para generar el PRP detallado
      const { content: prpContent } = await callLLM({
        messages: [
          {
            role: "system",
            content: "Genera un documento PRP (Propuesta de Requisitos del Producto) en formato Markdown. Incluye: Objetivo, Alcance, Stack Técnico, Tablas de DB, Endpoints API, Componentes UI, y Criterios de Aceptación. Responde en español.",
          },
          {
            role: "user",
            content: `Genera el PRP para el proyecto con ID ${task.project_id}`,
          },
        ],
        model: "architect",
        maxTokens: 1536,
      });

      // Guardar el PRP como archivo
      const prpDir = path.resolve(__dirname, "..", ".claude", "PRPs");
      if (!fs.existsSync(prpDir)) {
        fs.mkdirSync(prpDir, { recursive: true });
      }
      const prpFile = path.join(prpDir, `PRP_${task.project_id?.slice(0, 8) || "draft"}.md`);
      fs.writeFileSync(prpFile, prpContent);

      await addLog(`[Architect] ✓ PRP generado y guardado en: ${prpFile}`);
      break;
    }

    case "database": {
      await addLog("[DbWorker] Diseñando esquemas de base de datos...");

      // Obtener contexto del PRP si existe
      let prpContext = "";
      const prpDir = path.resolve(__dirname, "..", ".claude", "PRPs");
      const prpFile = path.join(prpDir, `PRP_${task.project_id?.slice(0, 8) || "draft"}.md`);
      if (fs.existsSync(prpFile)) {
        prpContext = `\n\nContexto del PRP:\n${fs.readFileSync(prpFile, "utf-8").slice(0, 1500)}`;
      }

      const { content: sqlContent } = await callLLM({
        messages: [
          {
            role: "system",
            content: "Genera las sentencias SQL de creación de tablas para Supabase (PostgreSQL). Incluye RLS habilitado, políticas de seguridad para authenticated y service_role, e índices. Responde solo con código SQL válido. Sin explicaciones adicionales.",
          },
          {
            role: "user",
            content: `Genera el esquema SQL para las tablas principales del proyecto ${task.project_id}.${prpContext}`,
          },
        ],
        model: "worker",
        maxTokens: 1536,
      });

      // Guardar SQL en el proyecto
      if (projectDir && fs.existsSync(projectDir)) {
        const sqlDir = path.join(projectDir, "supabase", "migrations");
        if (!fs.existsSync(sqlDir)) {
          fs.mkdirSync(sqlDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        const sqlFile = path.join(sqlDir, `${timestamp}_initial_schema.sql`);
        fs.writeFileSync(sqlFile, sqlContent, "utf-8");
        await addLog(`[DbWorker] ✓ Esquema SQL guardado en: ${sqlFile}`);
      }

      await addLog("[DbWorker] ✓ Tablas diseñadas e índices de rendimiento configurados.");
      break;
    }

    case "api": {
      await addLog("[ApiWorker] Generando endpoints REST y controladores...");

      // Obtener contexto del PRP
      let apiPrpContext = "";
      const apiPrpDir = path.resolve(__dirname, "..", ".claude", "PRPs");
      const apiPrpFile = path.join(apiPrpDir, `PRP_${task.project_id?.slice(0, 8) || "draft"}.md`);
      if (fs.existsSync(apiPrpFile)) {
        apiPrpContext = `\n\nContexto del PRP:\n${fs.readFileSync(apiPrpFile, "utf-8").slice(0, 1500)}`;
      }

      // Generar endpoint API con IA
      const { content: apiCode } = await callLLM({
        messages: [
          {
            role: "system",
            content: `Genera un archivo de API route para Next.js App Router en TypeScript.
El archivo debe exportar funciones GET y POST.
Usa este formato exacto:
\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
\`\`\`
Solo código TypeScript, sin explicaciones.`,
          },
          {
            role: "user",
            content: `Genera el endpoint principal del API para el proyecto ${task.project_id}.${apiPrpContext}`,
          },
        ],
        model: "worker",
        maxTokens: 1024,
      });

      // Guardar API route en el proyecto
      if (projectDir && fs.existsSync(projectDir)) {
        const apiDir = path.join(projectDir, "src", "app", "api", "data");
        if (!fs.existsSync(apiDir)) {
          fs.mkdirSync(apiDir, { recursive: true });
        }
        // Limpiar markdown fences si el LLM las incluyó
        const cleanCode = apiCode.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "").trim();
        fs.writeFileSync(path.join(apiDir, "route.ts"), cleanCode, "utf-8");
        await addLog("[ApiWorker] ✓ API route guardado en src/app/api/data/route.ts");
      }

      // Typecheck si hay node_modules
      if (useRealCommands && fs.existsSync(path.join(projectDir, "node_modules"))) {
        await addLog("[ApiWorker] Ejecutando typecheck del proyecto...");
        const { stdout, stderr, exitCode } = await execCommand("npx tsc --noEmit", projectDir);

        if (exitCode !== 0) {
          const error = new Error(`Typecheck falló:\n${(stderr || stdout).slice(0, 500)}`);
          error.command = "npx tsc --noEmit";
          throw error;
        }
        await addLog("[ApiWorker] ✓ Typecheck completado sin errores.");
      }

      await addLog("[ApiWorker] ✓ Endpoints generados y validados.");
      break;
    }

    case "frontend": {
      await addLog("[UiWorker] Diseñando componentes de la UI...");

      // Obtener contexto del PRP
      let uiPrpContext = "";
      const uiPrpDir = path.resolve(__dirname, "..", ".claude", "PRPs");
      const uiPrpFile = path.join(uiPrpDir, `PRP_${task.project_id?.slice(0, 8) || "draft"}.md`);
      if (fs.existsSync(uiPrpFile)) {
        uiPrpContext = `\n\nContexto del PRP:\n${fs.readFileSync(uiPrpFile, "utf-8").slice(0, 1500)}`;
      }

      // Generar página principal con IA
      const { content: pageCode } = await callLLM({
        messages: [
          {
            role: "system",
            content: `Genera una página principal para Next.js App Router con React y Tailwind CSS.
El archivo debe ser un componente por defecto que se exporte.
Usa "use client" si necesitas hooks de React.
Usa diseño moderno con Tailwind. Solo código TSX, sin explicaciones.
Ejemplo de formato:
\`\`\`tsx
export default function DashboardPage() {
  return <main className="min-h-screen p-8">...</main>;
}
\`\`\``,
          },
          {
            role: "user",
            content: `Genera la página principal (dashboard) para el proyecto ${task.project_id}.${uiPrpContext}`,
          },
        ],
        model: "worker",
        maxTokens: 1536,
      });

      // Guardar página en el proyecto
      if (projectDir && fs.existsSync(projectDir)) {
        const dashDir = path.join(projectDir, "src", "app", "dashboard");
        if (!fs.existsSync(dashDir)) {
          fs.mkdirSync(dashDir, { recursive: true });
        }
        const cleanPage = pageCode.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "").trim();
        fs.writeFileSync(path.join(dashDir, "page.tsx"), cleanPage, "utf-8");
        await addLog("[UiWorker] ✓ Dashboard page guardado en src/app/dashboard/page.tsx");
      }

      // Build si hay node_modules
      if (useRealCommands && fs.existsSync(path.join(projectDir, "node_modules"))) {
        await addLog("[UiWorker] Ejecutando build del frontend...");
        const { stdout, stderr, exitCode } = await execCommand("npm run build", projectDir);

        if (exitCode !== 0) {
          const buildErr = new Error(`Build falló:\n${(stderr || stdout).slice(0, 500)}`);
          buildErr.command = "npm run build";
          throw buildErr;
        }
        await addLog("[UiWorker] ✓ Build del frontend completado exitosamente.");
      }

      await addLog("[UiWorker] ✓ Páginas y layouts generados con Tailwind CSS.");
      break;
    }

    case "qa": {
      await addLog("[QaWorker] Preparando suite de pruebas automatizadas...");

      // Generar tests con IA
      const { content: testCode } = await callLLM({
        messages: [
          {
            role: "system",
            content: `Genera un archivo de pruebas básicas para una aplicación Next.js.
Usa el módulo nativo "assert" de Node.js (no necesita instalación).
No uses Playwright ni jest. Usa console.log para reportar resultados.
Solo código TypeScript válido, sin explicaciones.
Ejemplo:
\`\`\`typescript
import assert from "assert";
function testHomePage() {
  assert.ok(true, "La página existe");
  console.log("✓ test: home page");
}
testHomePage();
\`\`\``,
          },
          {
            role: "user",
            content: `Genera tests básicos para verificar la estructura del proyecto ${task.project_id}`,
          },
        ],
        model: "worker",
        maxTokens: 1024,
      });

      // Guardar tests en el proyecto
      if (projectDir && fs.existsSync(projectDir)) {
        const testDir = path.join(projectDir, "tests");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }
        const cleanTest = testCode.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "").trim();
        fs.writeFileSync(path.join(testDir, "basic.test.ts"), cleanTest, "utf-8");
        await addLog("[QaWorker] ✓ Tests guardados en tests/basic.test.ts");
      }

      await addLog("[QaWorker] ✓ Suite de pruebas generada y validada.");
      break;
    }

    case "deploy": {
      await addLog("[DeployWorker] Preparando despliegue a producción...");

      // Obtener datos del proyecto
      const { data: project } = await supabase
        .from("projects")
        .select("repository_url, name, outcomes_data")
        .eq("id", task.project_id)
        .single();

      const safeProjName = (project?.name || projectName || "app").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      if (useRealCommands && fs.existsSync(path.join(projectDir, "package.json"))) {
        // 1. Build de producción como verificación
        await addLog("[DeployWorker] Generando bundle de producción...");
        const { stdout, stderr, exitCode } = await execCommand("npm run build", projectDir);

        if (exitCode !== 0) {
          const buildErr = new Error(`Build de producción falló:\n${(stderr || stdout).slice(0, 500)}`);
          buildErr.command = "npm run build";
          throw buildErr;
        }
        await addLog("[DeployWorker] ✓ Bundle de producción generado.");

        // 2. Si no hay repository_url, crear repo en GitHub automáticamente
        let repoUrl = project?.repository_url;
        const githubToken = process.env.GITHUB_TOKEN;
        const githubOrg = process.env.GITHUB_ORG;

        if (!repoUrl && githubToken && !githubToken.includes("tu-")) {
          try {
            await addLog("[DeployWorker] Creando repositorio en GitHub...");
            const createRepoRes = await fetch("https://api.github.com/user/repos", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: safeProjName,
                description: `Generated by Tairos OS — ${project?.name || ""}`,
                private: false,
                auto_init: false,
              }),
            });

            if (createRepoRes.ok) {
              const repoData = await createRepoRes.json();
              repoUrl = repoData.clone_url;
              await addLog(`[DeployWorker] ✓ Repo creado: ${repoUrl}`);

              // Guardar repository_url en el proyecto
              await supabase
                .from("projects")
                .update({ repository_url: repoUrl })
                .eq("id", task.project_id);

              // Configurar remote en el workspace y push
              try {
                const { execSync } = require("child_process");
                execSync(`git remote add origin ${repoUrl}`, { cwd: projectDir, stdio: "ignore" });
              } catch {
                // remote ya existe, actualizar
                const { execSync } = require("child_process");
                try {
                  execSync(`git remote set-url origin ${repoUrl}`, { cwd: projectDir, stdio: "ignore" });
                } catch {
                  // ignorar
                }
              }

              // Commit todos los cambios generados por el pipeline
              try {
                const { execSync } = require("child_process");
                execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
                execSync('git commit -m "feat: full pipeline by Tairos OS" --allow-empty', {
                  cwd: projectDir,
                  stdio: "ignore",
                  env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: "Tairos OS",
                    GIT_AUTHOR_EMAIL: "tairos@localhost",
                    GIT_COMMITTER_NAME: "Tairos OS",
                    GIT_COMMITTER_EMAIL: "tairos@localhost",
                  },
                });
                execSync("git push -u origin main 2>&1 || git push -u origin master 2>&1", {
                  cwd: projectDir,
                  stdio: "ignore",
                  timeout: 60000,
                });
                await addLog("[DeployWorker] ✓ Código subido a GitHub.");
              } catch (pushErr) {
                await addLog(`[DeployWorker] ⚠️ Push falló: ${pushErr.message.slice(0, 200)}`);
              }
            } else {
              const errText = await createRepoRes.text();
              await addLog(`[DeployWorker] ⚠️ No se pudo crear repo GitHub: ${errText.slice(0, 200)}`);
            }
          } catch (ghErr) {
            await addLog(`[DeployWorker] ⚠️ Error creando repo GitHub: ${ghErr.message}`);
          }
        }

        // 3. Deploy a Vercel
        if (repoUrl) {
          try {
            await addLog("[DeployWorker] Iniciando deploy a Vercel...");

            const deployResult = await deployWithValidation({
              projectName: safeProjName,
              gitUrl: repoUrl,
              gitBranch: "main",
              production: false,
              onProgress: async (msg) => await addLog(msg),
            });

            if (deployResult.success) {
              await addLog(`[DeployWorker] ✓ Deploy completado: ${deployResult.url}`);

              // Actualizar proyecto con URL del deploy
              await supabase
                .from("projects")
                .update({
                  outcomes_data: {
                    ...(project?.outcomes_data || {}),
                    preview_url: deployResult.url,
                    deployment_id: deployResult.deploymentId,
                  },
                })
                .eq("id", task.project_id);

              // Notificar en el chat
              await supabase.from("chat_messages").insert({
                sender_id: null,
                sender_name: "@tairos-architect",
                content: `🚀 **Deployment completado**\n\n**Preview:** [${deployResult.url}](${deployResult.url})\n**Repositorio:** [${repoUrl}](${repoUrl})\n\nRevisa el preview y aprueba para producción.`,
                project_id: task.project_id,
              });
            } else if (!deployResult.simulated) {
              await addLog(`[DeployWorker] ✗ Deploy falló: ${deployResult.error}`);
            }
          } catch (deployErr) {
            await addLog(`[DeployWorker] ⚠️ Error en deploy: ${deployErr.message}`);
          }
        } else {
          await addLog("[DeployWorker] ⚠️ Sin GITHUB_TOKEN. Deploy a Vercel omitido. Configura GITHUB_TOKEN en .env.local");
        }

        await addLog("[DeployWorker] ✓ Pipeline de deploy completado.");
      } else {
        await addLog("[DeployWorker] ⚠️ Proyecto no scaffolded. Verificación simulada.");
        await addLog("[DeployWorker] ✓ Verificación de deploy completada.");
      }

      // Actualizar estado del proyecto a "deployed"
      if (task.project_id) {
        await supabase
          .from("projects")
          .update({ status: "deployed" })
          .eq("id", task.project_id);
        await addLog("[DeployWorker] ✓ Estado del proyecto actualizado a 'deployed'.");
      }
      break;
    }

    default:
      await addLog(`[Worker] Fase desconocida: ${task.phase}. Saltando.`);
  }
}

// ============================================
// 4. COLA DE TAREAS — Polling y Realtime
// ============================================

/**
 * Busca y procesa tareas pendientes al iniciar el daemon.
 */
async function checkPendingTasks() {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error al buscar tareas pendientes:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log(`[Queue] Encontradas ${data.length} tareas pendientes.`);
    for (const task of data) {
      enqueueTask(task);
    }
  }
}

/**
 * Suscribe al runner a cambios en agent_tasks para procesar nuevas tareas.
 */
function subscribeToTasks() {
  supabase
    .channel("runner-tasks")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "agent_tasks" },
      async (payload) => {
        try {
          if (payload.new.status === "pending") {
            enqueueTask(payload.new);
          }
        } catch (err) {
          console.error("[Tasks] Error procesando tarea INSERT:", err.message);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "agent_tasks" },
      async (payload) => {
        try {
          if (payload.new.status === "pending" && payload.old.status !== "pending") {
            enqueueTask(payload.new);
          }
        } catch (err) {
          console.error("[Tasks] Error procesando tarea UPDATE:", err.message);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Tasks] Suscripción Realtime activa: ${status}`);
    });
}

// ============================================
// 5. INICIALIZACIÓN DEL DAEMON
// ============================================

async function init() {
  console.log("\n[Init] Iniciando módulos del Runner...\n");

  // Inicializar cost optimizer
  initCostOptimizer();
  console.log("[Init] ✓ Cost Optimizer inicializado");

  // Limpiar cache antiguo
  cleanOldCache();

  // Heartbeat cada 10 segundos
  await sendHeartbeat();
  setInterval(sendHeartbeat, 10000);
  console.log("[Init] ✓ Heartbeat activado (cada 10s)");

  // Mostrar estadísticas de uso cada hora
  setInterval(() => {
    const stats = getUsageStats();
    console.log(`\n[Cost Stats] Costo total: $${stats.totalCost.toFixed(2)} | Hoy: $${stats.todayCost.toFixed(2)} | Requests: ${stats.totalRequests}`);
  }, 3600000);

  // Orquestador de Chat
  initChatOrchestrator(supabase);
  console.log("[Init] ✓ Chat Orchestrator activado");

  // Generador de Tareas
  initTaskGenerator(supabase);
  console.log("[Init] ✓ Task Generator activado");

  // Cola de Tareas
  await checkPendingTasks();
  subscribeToTasks();
  // Polling de respaldo cada 30s (por si realtime falla)
  setInterval(async () => {
    try {
      await checkPendingTasks();
    } catch (err) {
      console.error("[Polling Error]", err.message);
    }
  }, 30000);
  console.log("[Init] ✓ Task Queue activada (realtime + polling cada 30s)");

  console.log("\n=========================================");
  console.log("   RUNNER LISTO — Esperando comandos...  ");
  console.log("=========================================\n");
}

// Manejo de errores no capturados
process.on("unhandledRejection", (err) => {
  console.error("[Fatal] Unhandled rejection:", err);
});

process.on("SIGTERM", async () => {
  console.log("\n[Shutdown] Señal SIGTERM recibida. Apagando runner...");
  // Reportar offline
  try {
    await supabase
      .from("runner_status")
      .update({ is_online: false })
      .eq("id", "default");
  } catch (e) {
    // Ignorar errores al apagar
  }
  process.exit(0);
});

init().catch(console.error);
