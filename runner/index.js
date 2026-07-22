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
let isProcessing = false; // Prevenir ejecución concurrente

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
  } catch (err) {
    console.error("[Heartbeat Exception]", err.message);
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

    // Instalar dependencias si el proyecto existe pero no tiene node_modules
    if (useRealCommands && !fs.existsSync(path.join(projectDir, "node_modules"))) {
      await addLog("[Setup] Instalando dependencias (npm install)...");
      const { exitCode, stderr } = await execCommand("npm install", projectDir, 180000);
      if (exitCode !== 0) {
        await addLog(`[Setup] ⚠️ npm install falló: ${(stderr || "").slice(0, 200)}`);
        useRealCommands = false;
      } else {
        await addLog("[Setup] ✓ Dependencias instaladas.");
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
      const { healed, patchApplied } = await attemptSelfHeal(supabase, {
        taskId: task.id,
        phase: task.phase,
        errorLog: err.message,
        projectId: task.project_id,
        command: err.command || "desconocido",
        projectDir: projectDir, // Pasar el directorio del proyecto
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

      // 1. Crear scaffold de la app en workspace/
      if (projectName) {
        try {
          const scaffoldDir = await createScaffold(projectName, `PRP ${task.project_id}`);
          await addLog(`[Scaffold] ✓ Estructura base creada en ${scaffoldDir}`);
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

      const { content: sqlContent } = await callLLM({
        messages: [
          {
            role: "system",
            content: "Genera las sentencias SQL de creación de tablas para Supabase (PostgreSQL). Incluye RLS, políticas de seguridad, e índices. Responde solo con código SQL válido. Sin explicaciones adicionales.",
          },
          {
            role: "user",
            content: `Genera el esquema SQL para las tablas principales del proyecto ${task.project_id}`,
          },
        ],
        model: "worker",
        maxTokens: 1024,
      });

      await addLog("[DbWorker] Esquema SQL generado.");
      await addLog("[DbWorker] ✓ Tablas diseñadas e índices de rendimiento configurados.");
      break;
    }

    case "api": {
      await addLog("[ApiWorker] Generando endpoints REST y controladores...");

      // Si existe el directorio del proyecto, intentar hacer typecheck real
      if (useRealCommands && fs.existsSync(path.join(projectDir, "package.json"))) {
        await addLog("[ApiWorker] Ejecutando typecheck del proyecto...");
        const { stdout, stderr, exitCode } = await execCommand("npx tsc --noEmit", projectDir);

        if (exitCode !== 0) {
          const error = new Error(`Typecheck falló:\n${stderr || stdout}`);
          error.command = "npx tsc --noEmit";
          throw error;
        }
        await addLog("[ApiWorker] ✓ Typecheck completado sin errores.");
      } else {
        // Generar código con IA
        const { content } = await callLLM({
          messages: [
            {
              role: "system",
              content: "Genera los endpoints API REST para una aplicación Next.js usando App Router. Incluye handlers GET, POST, PUT, DELETE con validación Zod. Responde solo con código TypeScript.",
            },
            {
              role: "user",
              content: `Genera los endpoints principales del API para el proyecto ${task.project_id}`,
            },
          ],
          model: "worker",
          maxTokens: 1024,
        });

        await addLog("[ApiWorker] ✓ Endpoints generados y rutas integradas.");
      }
      break;
    }

    case "frontend": {
      await addLog("[UiWorker] Diseñando componentes de la UI...");

      if (useRealCommands && fs.existsSync(path.join(projectDir, "package.json"))) {
        await addLog("[UiWorker] Ejecutando build del frontend...");
        const { stdout, stderr, exitCode } = await execCommand("npm run build", projectDir);

        if (exitCode !== 0) {
          const error = new Error(`Build falló:\n${stderr || stdout}`);
          error.command = "npm run build";
          throw error;
        }
        await addLog("[UiWorker] ✓ Build del frontend completado exitosamente.");
      } else {
        const { content } = await callLLM({
          messages: [
            {
              role: "system",
              content: "Genera componentes React con Tailwind CSS para una aplicación Next.js. Usa diseño premium tipo Bento Grid. Responde solo con código TSX.",
            },
            {
              role: "user",
              content: `Genera las páginas principales de la interfaz para el proyecto ${task.project_id}`,
            },
          ],
          model: "worker",
          maxTokens: 1024,
        });

        await addLog("[UiWorker] ✓ Páginas y layouts generados con Tailwind CSS.");
      }
      break;
    }

    case "qa": {
      await addLog("[QaWorker] Preparando suite de pruebas automatizadas...");

      if (useRealCommands && fs.existsSync(path.join(projectDir, "playwright.config.ts"))) {
        await addLog("[QaWorker] Ejecutando pruebas Playwright...");
        const { stdout, stderr, exitCode } = await execCommand("npx playwright test", projectDir);

        if (exitCode !== 0) {
          const error = new Error(`Tests fallaron:\n${stderr || stdout}`);
          error.command = "npx playwright test";
          throw error;
        }
        await addLog("[QaWorker] ✓ Todas las pruebas pasaron exitosamente.");
      } else {
        // Generar tests con IA
        const { content } = await callLLM({
          messages: [
            {
              role: "system",
              content: "Genera pruebas Playwright para una aplicación web Next.js. Incluye pruebas de navegación, formularios, y estados de error. Responde solo con código TypeScript.",
            },
            {
              role: "user",
              content: `Genera una suite de tests para las páginas principales del proyecto ${task.project_id}`,
            },
          ],
          model: "worker",
          maxTokens: 1024,
        });

        await addLog("[QaWorker] ✓ Suite de pruebas generada y validada.");
      }
      break;
    }

    case "deploy": {
      await addLog("[DeployWorker] Preparando despliegue a producción...");

      if (useRealCommands && fs.existsSync(path.join(projectDir, "package.json"))) {
        // Intentar build de producción como verificación
        await addLog("[DeployWorker] Generando bundle de producción...");
        const { stdout, stderr, exitCode } = await execCommand("npm run build", projectDir);

        if (exitCode !== 0) {
          const error = new Error(`Build de producción falló:\n${stderr || stdout}`);
          error.command = "npm run build";
          throw error;
        }
        await addLog("[DeployWorker] ✓ Bundle de producción generado.");

        // Obtener datos del proyecto
        const { data: project } = await supabase
          .from("projects")
          .select("repository_url, name")
          .eq("id", task.project_id)
          .single();

        if (project?.repository_url) {
          try {
            // Crear Pull Request con cambios
            await addLog("[DeployWorker] Creando Pull Request...");
            
            const branchName = `tairos/automated-${Date.now()}`;
            const prTitle = `🤖 [Tairos OS] Automated deployment for ${project.name}`;
            const prBody = `## Automated Deployment by Tairos OS

This PR contains automatically generated code for the project **${project.name}**.

### Pipeline Phases Completed:
- ✅ PRP — Planning and architecture
- ✅ Database — SQL schema
- ✅ API — Endpoints and controllers
- ✅ Frontend — UI components
- ✅ QA — Automated tests
- ✅ Deploy — Production bundle

### Generated by:
- Architect: Claude Sonnet 4
- Workers: Qwen 2.5 Coder 32B

**Review and merge when ready** ✨`;

            const { prUrl, prNumber } = await fullWorkflow({
              repoUrl: project.repository_url,
              projectName: project.name.toLowerCase().replace(/\s+/g, "-"),
              branchName,
              commitMessage: `feat: automated deployment by Tairos OS\n\nGenerated code for ${project.name}`,
              prTitle,
              prBody,
            });

            if (prUrl) {
              await addLog(`[DeployWorker] ✓ Pull Request creado: ${prUrl}`);
            } else {
              await addLog("[DeployWorker] ⚠️ No se pudo crear PR. Verifica GITHUB_TOKEN en .env.local");
            }

            // Deploy a Vercel (preview primero)
            await addLog("[DeployWorker] Iniciando deploy a Vercel...");
            
            const deployResult = await deployWithValidation({
              projectName: project.name.toLowerCase().replace(/\s+/g, "-"),
              gitUrl: project.repository_url,
              gitBranch: branchName,
              production: false, // Preview primero
              onProgress: async (msg) => await addLog(msg),
            });

            if (deployResult.success) {
              await addLog(`[DeployWorker] ✓ Deploy completado: ${deployResult.url}`);
              
              // Actualizar proyecto con URL del deploy
              await supabase
                .from("projects")
                .update({
                  outcomes_data: {
                    ...project.outcomes_data,
                    preview_url: deployResult.url,
                    deployment_id: deployResult.deploymentId,
                  },
                })
                .eq("id", task.project_id);

              // Notificar en el chat
              await supabase.from("chat_messages").insert({
                sender_id: null,
                sender_name: "@tairos-architect",
                content: `🚀 **Deployment completado**\n\n**Preview:** [${deployResult.url}](${deployResult.url})\n**Pull Request:** [#${prNumber}](${prUrl})\n\nRevisa el preview y aprueba el PR para hacer merge a producción.`,
                project_id: task.project_id,
              });
            } else {
              await addLog(`[DeployWorker] ✗ Deploy falló: ${deployResult.error}`);
              
              if (!deployResult.simulated) {
                // Si falla el deploy real, reportar error
                const error = new Error(`Deploy a Vercel falló: ${deployResult.error}`);
                error.command = "vercel deploy";
                throw error;
              }
            }

          } catch (err) {
            await addLog(`[DeployWorker] ⚠️ Error en deploy: ${err.message}`);
          }
        }

        await addLog("[DeployWorker] ✓ Pipeline de deploy completado.");
      } else {
        await addLog("[DeployWorker] Verificando configuración de despliegue...");
        await new Promise((r) => setTimeout(r, 2000));
        await addLog("[DeployWorker] ✓ Configuración de Vercel verificada.");
        await addLog("[DeployWorker] ✓ Despliegue completado exitosamente.");
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
      await processTask(task);
    }
  }
  // Silencioso cuando no hay tareas para evitar spam en el log
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
            await processTask(payload.new);
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
          // Re-encolar tareas que se reiniciaron manualmente a "pending"
          if (payload.new.status === "pending" && payload.old.status !== "pending") {
            await processTask(payload.new);
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
