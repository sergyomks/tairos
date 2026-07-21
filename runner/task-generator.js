/**
 * task-generator.js — Generador Automático de Tareas para Tairos OS
 * 
 * Escucha los votos en prp_votes. Cuando una PRP alcanza el quórum
 * (≥2 votos aprobatorios), crea automáticamente las 6 tareas del
 * pipeline A2A en agent_tasks.
 */

const REQUIRED_VOTES = 2;

// Las 6 fases del pipeline A2A en orden de ejecución
const PIPELINE_PHASES = [
  { phase: "prp", description: "Generar propuesta de requisitos y arquitectura" },
  { phase: "database", description: "Configurar y estructurar tablas de base de datos" },
  { phase: "api", description: "Desarrollar controladores y endpoints API" },
  { phase: "frontend", description: "Diseñar y compilar componentes de interfaz" },
  { phase: "qa", description: "Generar y ejecutar pruebas automatizadas" },
  { phase: "deploy", description: "Crear contenedor y realizar despliegue" },
];

/**
 * Inicializa el generador de tareas.
 * Escucha INSERT y UPDATE en prp_votes para detectar quórum.
 * Además hace scan inicial y polling por si Realtime pierde eventos.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
function initTaskGenerator(supabase) {
  console.log("[Task Generator] Iniciando escucha de votos en PRPs...");

  const channel = supabase
    .channel("runner-task-generator")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prp_votes" },
      async (payload) => {
        try {
          const vote = payload.new;
          if (!vote || !vote.prp_id) return;

          console.log(`[Task Generator] Voto detectado para PRP: ${vote.prp_id} → ${vote.vote}`);
          await checkQuorumAndGenerate(supabase, vote.prp_id);
        } catch (err) {
          console.error("[Task Generator] Error al verificar quórum:", err.message);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Task Generator] Canal suscrito: ${status}`);
    });

  // Scan inicial y polling cada 30s por si los votos llegaron antes del arranque
  setTimeout(() => scanApprovedPRPs(supabase), 2000);
  setInterval(() => scanApprovedPRPs(supabase), 30000);

  return channel;
}

/**
 * Busca PRPs aprobadas que aún no tengan tareas y genera el pipeline.
 */
async function scanApprovedPRPs(supabase) {
  try {
    const { data: prps, error } = await supabase
      .from("prps")
      .select("*, prp_votes(*)")
      .eq("status", "approved");

    if (error) {
      console.error("[Task Generator] Error scan PRPs aprobadas:", error.message);
      return;
    }

    if (!prps || prps.length === 0) return;

    for (const prp of prps) {
      const approvedCount = prp.prp_votes?.filter((v) => v.vote === "approved").length || 0;
      if (approvedCount < REQUIRED_VOTES) continue;
      await generateTasksForPRP(supabase, prp);
    }
  } catch (err) {
    console.error("[Task Generator] Error en scanApprovedPRPs:", err.message);
  }
}

/**
 * Verifica si una PRP alcanzó el quórum y genera las tareas del pipeline.
 */
async function checkQuorumAndGenerate(supabase, prpId) {
  // 1. Contar votos aprobatorios para esta PRP
  const { data: votes, error: votesError } = await supabase
    .from("prp_votes")
    .select("*")
    .eq("prp_id", prpId)
    .eq("vote", "approved");

  if (votesError) {
    console.error("[Task Generator] Error al leer votos:", votesError.message);
    return;
  }

  const approvedCount = votes?.length || 0;
  console.log(`[Task Generator] PRP ${prpId}: ${approvedCount}/${REQUIRED_VOTES} votos aprobatorios`);

  if (approvedCount < REQUIRED_VOTES) {
    return; // Aún no hay quórum
  }

  // 2. Obtener la PRP
  const { data: prp, error: prpError } = await supabase
    .from("prps")
    .select("*")
    .eq("id", prpId)
    .single();

  if (prpError || !prp) {
    console.error("[Task Generator] PRP no encontrada:", prpError?.message);
    return;
  }

  await generateTasksForPRP(supabase, prp);
}

/**
 * Genera las tareas del pipeline para una PRP aprobada si aún no existen.
 */
async function generateTasksForPRP(supabase, prp) {
  if (!prp.project_id) {
    console.error("[Task Generator] PRP sin project_id. Saltando.");
    return;
  }

  // Verificar que no existan tareas para este proyecto (evitar duplicados)
  const { data: existingTasks } = await supabase
    .from("agent_tasks")
    .select("id")
    .eq("project_id", prp.project_id)
    .limit(1);

  if (existingTasks && existingTasks.length > 0) {
    // Silencioso en scans: no repetir el mismo log cada 30s
    return;
  }

  // Si la PRP no está marcada como approved, actualizarla
  if (prp.status !== "approved") {
    await supabase.from("prps").update({ status: "approved" }).eq("id", prp.id);
  }

  console.log(`[Task Generator] ✓ Quórum alcanzado para "${prp.title}". Generando pipeline...`);

  // Crear las 6 tareas del pipeline A2A
  const tasks = PIPELINE_PHASES.map((p) => ({
    project_id: prp.project_id,
    phase: p.phase,
    status: "pending",
    logs: [],
  }));

  const { error: insertError } = await supabase.from("agent_tasks").insert(tasks);

  if (insertError) {
    console.error("[Task Generator] Error al crear tareas:", insertError.message);
    return;
  }

  console.log(`[Task Generator] ✓ 6 tareas creadas exitosamente para proyecto ${prp.project_id}`);

  // Notificar en el chat
  await supabase.from("chat_messages").insert({
    sender_id: null,
    sender_name: "@tairos-architect",
    content: `🚀 **Quórum alcanzado** para "${prp.title}". He creado las 6 tareas del pipeline A2A:\n\n1. 🎨 PRP — Planificación\n2. 🗄️ Database — Esquema SQL\n3. ⚙️ API — Endpoints\n4. 💻 Frontend — Interfaz\n5. 🧪 QA — Pruebas\n6. 🚀 Deploy — Despliegue\n\nEl runner local comenzará a procesarlas automáticamente.`,
    project_id: prp.project_id,
  });
}

module.exports = { initTaskGenerator };
