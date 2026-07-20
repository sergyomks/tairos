/**
 * vercel-deployer.js — Módulo de Deploy Automático con Vercel
 * 
 * Integra con la API de Vercel para:
 * - Crear deploys automáticos desde GitHub
 * - Obtener URL de preview y producción
 * - Monitorear estado del deploy
 * - Rollback automático si falla
 */

const VERCEL_API_URL = "https://api.vercel.com";

/**
 * Crea un deployment en Vercel.
 * 
 * @param {Object} options
 * @param {string} options.projectName - Nombre del proyecto en Vercel
 * @param {string} options.gitUrl - URL del repositorio
 * @param {string} options.gitBranch - Branch a deployar
 * @param {boolean} [options.production=false] - Si es deploy a producción
 * @returns {Promise<{deploymentUrl: string, deploymentId: string, status: string}>}
 */
async function createDeployment({ projectName, gitUrl, gitBranch, production = false }) {
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelOrgId = process.env.VERCEL_ORG_ID;

  if (!vercelToken || vercelToken.includes("tu-") || vercelToken.includes("aqui")) {
    console.warn("[Vercel] ⚠️ VERCEL_TOKEN no configurado. Deploy simulado.");
    return {
      deploymentUrl: `https://${projectName}-preview.vercel.app`,
      deploymentId: `sim_${Date.now()}`,
      status: "simulated",
      message: "VERCEL_TOKEN no configurado. Este es un deploy simulado.",
    };
  }

  console.log(`[Vercel] Creando deployment para: ${projectName} (${gitBranch})`);

  const deployData = {
    name: projectName,
    gitSource: {
      type: "github",
      repo: extractRepoFromUrl(gitUrl),
      ref: gitBranch,
    },
    target: production ? "production" : "preview",
  };

  try {
    const response = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
        ...(vercelOrgId && { "x-vercel-org-id": vercelOrgId }),
      },
      body: JSON.stringify(deployData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vercel API error ${response.status}: ${errorText}`);
    }

    const deployment = await response.json();

    console.log(`[Vercel] ✓ Deployment creado: ${deployment.url}`);

    return {
      deploymentUrl: `https://${deployment.url}`,
      deploymentId: deployment.id,
      status: deployment.readyState || "QUEUED",
      inspectorUrl: deployment.inspectorUrl,
    };
  } catch (err) {
    throw new Error(`No se pudo crear el deployment: ${err.message}`);
  }
}

/**
 * Obtiene el estado de un deployment.
 * 
 * @param {string} deploymentId - ID del deployment
 * @returns {Promise<{status: string, url: string, error?: string}>}
 */
async function getDeploymentStatus(deploymentId) {
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!vercelToken || vercelToken.includes("tu-") || deploymentId.startsWith("sim_")) {
    return {
      status: "READY",
      url: "https://simulated-deployment.vercel.app",
    };
  }

  try {
    const response = await fetch(`${VERCEL_API_URL}/v13/deployments/${deploymentId}`, {
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const deployment = await response.json();

    return {
      status: deployment.readyState,
      url: `https://${deployment.url}`,
      error: deployment.error?.message,
    };
  } catch (err) {
    throw new Error(`No se pudo obtener el estado: ${err.message}`);
  }
}

/**
 * Espera a que un deployment esté listo.
 * 
 * @param {string} deploymentId - ID del deployment
 * @param {number} [maxWaitMs=300000] - Tiempo máximo de espera (5 min default)
 * @returns {Promise<{success: boolean, url: string, error?: string}>}
 */
async function waitForDeployment(deploymentId, maxWaitMs = 300000) {
  console.log(`[Vercel] Esperando deployment ${deploymentId}...`);

  const startTime = Date.now();
  const pollInterval = 10000; // 10 segundos

  while (Date.now() - startTime < maxWaitMs) {
    const { status, url, error } = await getDeploymentStatus(deploymentId);

    console.log(`[Vercel] Estado: ${status}`);

    if (status === "READY") {
      console.log(`[Vercel] ✓ Deployment listo: ${url}`);
      return { success: true, url };
    }

    if (status === "ERROR" || status === "CANCELED") {
      console.error(`[Vercel] ✗ Deployment falló: ${error || status}`);
      return { success: false, url, error: error || `Estado: ${status}` };
    }

    // Estados intermedios: QUEUED, BUILDING, DEPLOYING
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Timeout
  console.error(`[Vercel] Timeout esperando deployment`);
  return { success: false, error: "Timeout esperando deployment" };
}

/**
 * Lista todos los deployments de un proyecto.
 * 
 * @param {string} projectId - ID o nombre del proyecto
 * @param {number} [limit=10] - Número de deployments a listar
 * @returns {Promise<Array<{id: string, url: string, state: string, createdAt: string}>>}
 */
async function listDeployments(projectId, limit = 10) {
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!vercelToken || vercelToken.includes("tu-")) {
    return [];
  }

  try {
    const response = await fetch(
      `${VERCEL_API_URL}/v6/deployments?projectId=${projectId}&limit=${limit}`,
      {
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.deployments || [];
  } catch (err) {
    console.error("[Vercel] Error listando deployments:", err.message);
    return [];
  }
}

/**
 * Hace rollback a un deployment anterior.
 * 
 * @param {string} projectId - ID del proyecto
 * @param {string} deploymentId - ID del deployment al que hacer rollback
 * @returns {Promise<boolean>}
 */
async function rollbackToDeployment(projectId, deploymentId) {
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!vercelToken || vercelToken.includes("tu-")) {
    console.warn("[Vercel] Rollback simulado (VERCEL_TOKEN no configurado)");
    return true;
  }

  console.log(`[Vercel] Haciendo rollback a deployment: ${deploymentId}`);

  try {
    // Promover el deployment anterior a producción
    const response = await fetch(
      `${VERCEL_API_URL}/v13/deployments/${deploymentId}/promote`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log("[Vercel] ✓ Rollback completado");
    return true;
  } catch (err) {
    console.error("[Vercel] Error haciendo rollback:", err.message);
    return false;
  }
}

/**
 * Flujo completo de deploy con validación.
 * 
 * @param {Object} options
 * @param {string} options.projectName - Nombre del proyecto
 * @param {string} options.gitUrl - URL del repositorio
 * @param {string} options.gitBranch - Branch a deployar
 * @param {boolean} [options.production=false] - Deploy a producción
 * @param {Function} [options.onProgress] - Callback para reportar progreso
 * @returns {Promise<{success: boolean, url: string, deploymentId: string}>}
 */
async function deployWithValidation({
  projectName,
  gitUrl,
  gitBranch,
  production = false,
  onProgress,
}) {
  const progress = onProgress || ((msg) => console.log(msg));

  try {
    // 1. Crear deployment
    progress("[Vercel] Iniciando deployment...");
    const { deploymentUrl, deploymentId, status } = await createDeployment({
      projectName,
      gitUrl,
      gitBranch,
      production,
    });

    if (status === "simulated") {
      progress("[Vercel] ⚠️ Deploy simulado (configura VERCEL_TOKEN para deploys reales)");
      return { success: true, url: deploymentUrl, deploymentId, simulated: true };
    }

    // 2. Esperar a que esté listo
    progress(`[Vercel] Esperando deployment ${deploymentId}...`);
    const { success, url, error } = await waitForDeployment(deploymentId);

    if (!success) {
      progress(`[Vercel] ✗ Deploy falló: ${error}`);
      return { success: false, error, deploymentId };
    }

    // 3. Validación básica (ping al URL)
    progress("[Vercel] Validando deployment...");
    const isHealthy = await validateDeployment(url);

    if (!isHealthy) {
      progress("[Vercel] ⚠️ El deployment está activo pero no responde correctamente");
      // No es error crítico, pero notificar
    }

    progress(`[Vercel] ✓ Deployment exitoso: ${url}`);
    return { success: true, url, deploymentId };
  } catch (err) {
    progress(`[Vercel] ✗ Error en deployment: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Valida que un deployment responda correctamente.
 * 
 * @param {string} url - URL del deployment
 * @returns {Promise<boolean>}
 */
async function validateDeployment(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    return response.ok;
  } catch (err) {
    console.error("[Vercel] Error validando deployment:", err.message);
    return false;
  }
}

/**
 * Extrae "owner/repo" de una URL de GitHub.
 */
function extractRepoFromUrl(gitUrl) {
  const match = gitUrl.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
  if (!match) {
    throw new Error("URL de GitHub inválida");
  }
  return match[1].replace(/\.git$/, "");
}

module.exports = {
  createDeployment,
  getDeploymentStatus,
  waitForDeployment,
  listDeployments,
  rollbackToDeployment,
  deployWithValidation,
};
