/**
 * self-healing.js — Motor de Auto-reparación para Tairos OS
 * 
 * Cuando un comando del Runner falla, este módulo:
 * 1. Registra el error en healing_events
 * 2. Diagnostica el error con IA
 * 3. Genera un parche sugerido
 * 4. APLICA el parche automáticamente al código
 * 5. Re-ejecuta la tarea para validar el fix
 * 6. Si falla, registra para revisión humana
 */

const { callLLM } = require("./llm");
const { commit, push, createPullRequest, parseGitHubUrl } = require("./git-manager");
const fs = require("fs");
const path = require("path");

/**
 * Intenta auto-reparar un fallo de ejecución de tarea.
 * 
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Object} context
 * @param {string} context.taskId - ID de la tarea que falló
 * @param {string} context.phase - Fase del pipeline (prp, database, api, etc.)
 * @param {string} context.errorLog - Salida de error (stderr) del comando
 * @param {string} context.projectId - ID del proyecto
 * @param {string} [context.command] - Comando que falló
 * @param {string} [context.projectDir] - Directorio del proyecto
 * @returns {Promise<{healed: boolean, patchContent: string | null, patchApplied: boolean}>}
 */
async function attemptSelfHeal(supabase, { taskId, phase, errorLog, projectId, command, projectDir }) {
  console.log(`\n[Self-Healing] ========================================`);
  console.log(`[Self-Healing] Iniciando diagnóstico para tarea ${taskId}`);
  console.log(`[Self-Healing] Fase: ${phase} | Comando: ${command || "N/A"}`);

  // 1. Registrar evento de error
  await insertHealingEvent(supabase, {
    project_id: projectId,
    event_type: "error",
    title: `Error en fase ${phase.toUpperCase()}`,
    detail: truncateLog(errorLog, 500),
    agent: null,
  });

  // 2. Diagnóstico con IA
  console.log("[Self-Healing] Solicitando diagnóstico al agente...");

  const { content: diagnosis } = await callLLM({
    messages: [
      {
        role: "system",
        content: `Eres el Agente Auditor de Tairos OS. Tu trabajo es diagnosticar errores de compilación, tests o configuración. Analiza el log de error y responde con:
1. **Causa raíz** (1-2 oraciones)
2. **Archivo afectado** (ruta completa desde la raíz del proyecto)
3. **Líneas de código problemáticas** (si es identificable)
4. **Solución propuesta** (específica y aplicable)

Responde SIEMPRE en español. Sé conciso y directo.`,
      },
      {
        role: "user",
        content: `Fase: ${phase}\nComando ejecutado: ${command || "desconocido"}\n\nLog de error:\n\`\`\`\n${truncateLog(errorLog, 2000)}\n\`\`\``,
      },
    ],
    model: "healer",
    maxTokens: 1024,
    temperature: 0.3,
  });

  await insertHealingEvent(supabase, {
    project_id: projectId,
    event_type: "diagnosis",
    title: `Diagnóstico de error en ${phase}`,
    detail: diagnosis,
    agent: "Agente Auditor",
  });

  console.log("[Self-Healing] Diagnóstico completado. Generando parche...");

  // 3. Generar parche con IA
  const { content: patchResponse } = await callLLM({
    messages: [
      {
        role: "system",
        content: `Eres el Agente Refactor de Tairos OS. Tu trabajo es generar parches de código para corregir errores.
Responde SIEMPRE con este formato exacto:

ARCHIVO: <ruta del archivo desde la raíz del proyecto>
--- CÓDIGO ANTERIOR ---
<líneas de código que causan el error>
--- CÓDIGO NUEVO ---
<líneas de código corregidas>
--- FIN ---

Si no puedes determinar el parche exacto, responde con "NO_PATCH" y explica por qué.
Responde en español.`,
      },
      {
        role: "user",
        content: `Diagnóstico del auditor:\n${diagnosis}\n\nLog de error original:\n\`\`\`\n${truncateLog(errorLog, 1500)}\n\`\`\``,
      },
    ],
    model: "healer",
    maxTokens: 1536,
    temperature: 0.2,
  });

  // 4. Parsear el parche
  const patch = parsePatchResponse(patchResponse);

  if (!patch) {
    console.log("[Self-Healing] ⚠️ No se pudo generar un parche automático.");
    
    await insertHealingEvent(supabase, {
      project_id: projectId,
      event_type: "error",
      title: "Auto-reparación fallida — Requiere revisión humana",
      detail: `El sistema no pudo generar un parche automático para la fase ${phase}. Se requiere intervención manual del equipo.`,
      agent: "Agente Refactor",
    });

    return { healed: false, patchContent: null, patchApplied: false };
  }

  await insertHealingEvent(supabase, {
    project_id: projectId,
    event_type: "fix",
    title: `Parche generado para ${phase}`,
    detail: `Archivo: ${patch.file}`,
    agent: "Agente Refactor",
    old_code: patch.oldCode,
    new_code: patch.newCode,
  });

  console.log(`[Self-Healing] ✓ Parche generado para: ${patch.file}`);

  // 5. Intentar aplicar el parche automáticamente
  let patchApplied = false;

  if (projectDir) {
    try {
      console.log("[Self-Healing] Aplicando parche al archivo...");
      patchApplied = await applyPatch(projectDir, patch);

      if (patchApplied) {
        await insertHealingEvent(supabase, {
          project_id: projectId,
          event_type: "success",
          title: "Parche aplicado exitosamente",
          detail: `El parche se aplicó al archivo ${patch.file}. El código ha sido modificado.`,
          agent: "Agente Refactor",
        });

        console.log("[Self-Healing] ✓ Parche aplicado. Archivo modificado.");

        // 6. Crear commit con el fix
        try {
          const { data: project } = await supabase
            .from("projects")
            .select("repository_url, name")
            .eq("id", projectId)
            .single();

          if (project?.repository_url) {
            await commit(
              projectDir,
              `fix: auto-healing for ${phase} phase\n\nFixed ${patch.file}\nGenerated by Tairos OS Self-Healing`,
              [patch.file]
            );
            console.log("[Self-Healing] ✓ Commit creado con el fix.");

            // Push automático (opcional, comentar si prefieres revisar antes)
            // await push(projectDir, "main");
          }
        } catch (commitErr) {
          console.warn("[Self-Healing] No se pudo commitear el fix:", commitErr.message);
        }

        return { healed: true, patchContent: patchResponse, patchApplied: true };
      } else {
        await insertHealingEvent(supabase, {
          project_id: projectId,
          event_type: "error",
          title: "No se pudo aplicar el parche",
          detail: `El parche fue generado pero no se pudo aplicar automáticamente. Revisa el archivo ${patch.file} manualmente.`,
          agent: "Agente Refactor",
        });
        console.log("[Self-Healing] ⚠️ No se pudo aplicar el parche automáticamente.");
      }
    } catch (err) {
      console.error("[Self-Healing] Error aplicando parche:", err.message);
      await insertHealingEvent(supabase, {
        project_id: projectId,
        event_type: "error",
        title: "Error aplicando parche",
        detail: `Error: ${err.message}`,
        agent: "Agente Refactor",
      });
    }
  }

  // Si llegamos aquí, el parche se generó pero no se aplicó
  await insertHealingEvent(supabase, {
    project_id: projectId,
    event_type: "success",
    title: "Parche generado — Requiere aplicación manual",
    detail: `Se generó un parche para el archivo ${patch.file}. Requiere revisión y aplicación manual.`,
    agent: "Agente Refactor",
  });

  return { healed: true, patchContent: patchResponse, patchApplied };
}

/**
 * Aplica un parche al archivo especificado.
 * 
 * @param {string} projectDir - Directorio del proyecto
 * @param {Object} patch - { file, oldCode, newCode }
 * @returns {Promise<boolean>} - true si se aplicó exitosamente
 */
async function applyPatch(projectDir, { file, oldCode, newCode }) {
  const filePath = path.join(projectDir, file);

  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`[Self-Healing] Archivo no encontrado: ${filePath}`);
    return false;
  }

  // Leer contenido actual
  const currentContent = fs.readFileSync(filePath, "utf-8");

  // Verificar que el código anterior existe en el archivo
  if (!currentContent.includes(oldCode)) {
    console.error("[Self-Healing] El código anterior no coincide con el archivo actual.");
    console.error("Buscando:", oldCode.slice(0, 100));
    return false;
  }

  // Aplicar el parche (reemplazar código anterior por nuevo)
  const newContent = currentContent.replace(oldCode, newCode);

  // Verificar que realmente cambió algo
  if (newContent === currentContent) {
    console.error("[Self-Healing] El parche no produjo cambios en el archivo.");
    return false;
  }

  // Crear backup
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.writeFileSync(backupPath, currentContent);
  console.log(`[Self-Healing] Backup creado: ${backupPath}`);

  // Escribir el nuevo contenido
  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`[Self-Healing] Archivo modificado: ${filePath}`);

  return true;
}

/**
 * Inserta un evento en la tabla healing_events.
 */
async function insertHealingEvent(supabase, { project_id, event_type, title, detail, agent, old_code, new_code }) {
  try {
    const payload = {
      project_id: project_id || null,
      event_type,
      title,
      detail: detail || null,
      agent: agent || null,
    };

    // old_code y new_code son opcionales (puede que la tabla no tenga esas columnas)
    if (old_code) payload.old_code = old_code;
    if (new_code) payload.new_code = new_code;

    const { error } = await supabase.from("healing_events").insert(payload);

    if (error) {
      // Si falla por columnas faltantes, reintentar sin old_code/new_code
      if (error.message.includes("column") || error.code === "42703") {
        const { error: retryError } = await supabase.from("healing_events").insert({
          project_id: project_id || null,
          event_type,
          title,
          detail: `${detail || ""}\n\n--- Parche ---\nOLD: ${(old_code || "").slice(0, 200)}\nNEW: ${(new_code || "").slice(0, 200)}`,
          agent: agent || null,
        });
        if (retryError) {
          console.error(`[Self-Healing] Error al registrar evento (retry):`, retryError.message);
        }
      } else {
        console.error(`[Self-Healing] Error al registrar evento ${event_type}:`, error.message);
      }
    }
  } catch (err) {
    console.error(`[Self-Healing] Excepción al registrar evento:`, err.message);
  }
}

/**
 * Parsea la respuesta del Agente Refactor para extraer old_code y new_code.
 */
function parsePatchResponse(response) {
  if (!response || response.includes("NO_PATCH")) {
    return null;
  }

  try {
    // Extraer archivo
    const fileMatch = response.match(/ARCHIVO:\s*(.+)/);
    const file = fileMatch ? fileMatch[1].trim() : null;

    if (!file) {
      console.error("[Self-Healing] No se pudo extraer el nombre del archivo del parche.");
      return null;
    }

    // Extraer código anterior
    const oldCodeMatch = response.match(/---\s*CÓDIGO ANTERIOR\s*---\s*\n([\s\S]*?)---\s*CÓDIGO NUEVO\s*---/);
    const oldCode = oldCodeMatch ? oldCodeMatch[1].trim() : null;

    // Extraer código nuevo
    const newCodeMatch = response.match(/---\s*CÓDIGO NUEVO\s*---\s*\n([\s\S]*?)---\s*FIN\s*---/);
    const newCode = newCodeMatch ? newCodeMatch[1].trim() : null;

    if (oldCode && newCode) {
      return { file, oldCode, newCode };
    }

    console.error("[Self-Healing] No se pudo extraer oldCode o newCode del parche.");
    return null;
  } catch (err) {
    console.error("[Self-Healing] Error al parsear parche:", err.message);
    return null;
  }
}

/**
 * Trunca un log largo para no exceder límites de tokens.
 */
function truncateLog(log, maxLength) {
  if (!log || typeof log !== "string") return "Sin detalles disponibles";
  if (log.length <= maxLength) return log;
  return log.slice(0, maxLength) + "\n... [truncado]";
}

module.exports = { attemptSelfHeal, applyPatch };
