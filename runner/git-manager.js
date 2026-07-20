/**
 * git-manager.js — Gestor de Repositorios Git para Tairos OS
 * 
 * Maneja operaciones Git:
 * - Clonado de repositorios
 * - Creación de branches
 * - Commits automáticos
 * - Push a remote
 * - Creación de Pull Requests (GitHub API)
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const WORKSPACE_DIR = path.resolve(__dirname, "../workspace");

/**
 * Ejecuta un comando git y retorna el resultado.
 */
function execGit(args, cwd = WORKSPACE_DIR, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn("git", args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: timeoutMs,
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Git error: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: 0 });
      } else {
        reject(new Error(`Git command failed (exit ${code}):\n${stderr || stdout}`));
      }
    });
  });
}

/**
 * Clona un repositorio en el workspace.
 * 
 * @param {string} repoUrl - URL del repositorio (HTTPS o SSH)
 * @param {string} projectName - Nombre del proyecto (será el nombre de la carpeta)
 * @returns {Promise<string>} - Path del proyecto clonado
 */
async function cloneRepository(repoUrl, projectName) {
  console.log(`[Git Manager] Clonando repositorio: ${repoUrl}`);

  // Crear workspace si no existe
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    console.log(`[Git Manager] Workspace creado: ${WORKSPACE_DIR}`);
  }

  const projectDir = path.join(WORKSPACE_DIR, projectName);

  // Si ya existe, hacer pull en vez de clonar
  if (fs.existsSync(projectDir)) {
    console.log(`[Git Manager] Proyecto ya existe. Actualizando...`);
    try {
      await execGit(["pull", "origin", "main"], projectDir);
      console.log(`[Git Manager] ✓ Proyecto actualizado`);
      return projectDir;
    } catch (err) {
      // Si falla el pull, intentar con master
      try {
        await execGit(["pull", "origin", "master"], projectDir);
        console.log(`[Git Manager] ✓ Proyecto actualizado (master)`);
        return projectDir;
      } catch (err2) {
        console.warn(`[Git Manager] No se pudo actualizar. Usando versión local.`);
        return projectDir;
      }
    }
  }

  // Clonar el repositorio
  try {
    await execGit(["clone", repoUrl, projectName], WORKSPACE_DIR, 120000);
    console.log(`[Git Manager] ✓ Repositorio clonado en: ${projectDir}`);
    return projectDir;
  } catch (err) {
    throw new Error(`No se pudo clonar el repositorio: ${err.message}`);
  }
}

/**
 * Crea una nueva branch para trabajar.
 * 
 * @param {string} projectDir - Path del proyecto
 * @param {string} branchName - Nombre de la branch
 */
async function createBranch(projectDir, branchName) {
  console.log(`[Git Manager] Creando branch: ${branchName}`);

  try {
    // Verificar si la branch ya existe
    const { stdout } = await execGit(["branch", "--list", branchName], projectDir);
    if (stdout.trim()) {
      console.log(`[Git Manager] Branch ${branchName} ya existe. Cambiando a ella...`);
      await execGit(["checkout", branchName], projectDir);
      return;
    }

    // Crear y cambiar a la nueva branch
    await execGit(["checkout", "-b", branchName], projectDir);
    console.log(`[Git Manager] ✓ Branch creada y activada`);
  } catch (err) {
    throw new Error(`No se pudo crear la branch: ${err.message}`);
  }
}

/**
 * Hace commit de los cambios.
 * 
 * @param {string} projectDir - Path del proyecto
 * @param {string} message - Mensaje del commit
 * @param {Array<string>} [files] - Archivos específicos a commitear (default: todos)
 */
async function commit(projectDir, message, files = []) {
  console.log(`[Git Manager] Commiteando cambios...`);

  try {
    // Añadir archivos
    if (files.length > 0) {
      for (const file of files) {
        await execGit(["add", file], projectDir);
      }
    } else {
      await execGit(["add", "-A"], projectDir);
    }

    // Verificar si hay cambios
    const { stdout: status } = await execGit(["status", "--porcelain"], projectDir);
    if (!status.trim()) {
      console.log(`[Git Manager] No hay cambios para commitear`);
      return false;
    }

    // Commit
    await execGit(["commit", "-m", message], projectDir);
    console.log(`[Git Manager] ✓ Commit realizado: ${message}`);
    return true;
  } catch (err) {
    throw new Error(`No se pudo hacer commit: ${err.message}`);
  }
}

/**
 * Hace push de la branch al remote.
 * 
 * @param {string} projectDir - Path del proyecto
 * @param {string} branchName - Nombre de la branch
 */
async function push(projectDir, branchName) {
  console.log(`[Git Manager] Subiendo cambios a remote...`);

  try {
    await execGit(["push", "origin", branchName, "--set-upstream"], projectDir, 120000);
    console.log(`[Git Manager] ✓ Cambios subidos a origin/${branchName}`);
  } catch (err) {
    throw new Error(`No se pudo hacer push: ${err.message}`);
  }
}

/**
 * Crea un Pull Request en GitHub usando la API.
 * 
 * @param {Object} options
 * @param {string} options.owner - Usuario u organización (ej: "tairos-team")
 * @param {string} options.repo - Nombre del repositorio (ej: "mi-proyecto")
 * @param {string} options.head - Branch con los cambios (ej: "feature/nueva-funcionalidad")
 * @param {string} options.base - Branch destino (ej: "main")
 * @param {string} options.title - Título del PR
 * @param {string} options.body - Descripción del PR
 * @returns {Promise<{url: string, number: number}>}
 */
async function createPullRequest({ owner, repo, head, base = "main", title, body }) {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken || githubToken.includes("tu-") || githubToken.includes("aqui")) {
    console.warn(`[Git Manager] ⚠️ GITHUB_TOKEN no configurado. No se puede crear PR.`);
    return {
      url: null,
      number: null,
      message: "GITHUB_TOKEN no configurado. Configúralo en .env.local para crear PRs automáticos.",
    };
  }

  console.log(`[Git Manager] Creando Pull Request en ${owner}/${repo}...`);

  const prData = {
    title,
    body,
    head,
    base,
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(prData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${errorText}`);
    }

    const pr = await response.json();
    console.log(`[Git Manager] ✓ Pull Request creado: ${pr.html_url}`);

    return {
      url: pr.html_url,
      number: pr.number,
    };
  } catch (err) {
    throw new Error(`No se pudo crear el Pull Request: ${err.message}`);
  }
}

/**
 * Extrae owner y repo de una URL de GitHub.
 * 
 * @param {string} repoUrl - URL del repo (https://github.com/owner/repo.git)
 * @returns {{owner: string, repo: string}}
 */
function parseGitHubUrl(repoUrl) {
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
  if (!match) {
    throw new Error("URL de GitHub inválida");
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

/**
 * Flujo completo: Clonar → Branch → Commit → Push → PR.
 * 
 * @param {Object} options
 * @param {string} options.repoUrl - URL del repositorio
 * @param {string} options.projectName - Nombre del proyecto
 * @param {string} options.branchName - Nombre de la branch
 * @param {string} options.commitMessage - Mensaje del commit
 * @param {string} options.prTitle - Título del PR
 * @param {string} options.prBody - Descripción del PR
 * @param {Array<string>} [options.files] - Archivos a commitear
 * @returns {Promise<{projectDir: string, prUrl: string, prNumber: number}>}
 */
async function fullWorkflow({
  repoUrl,
  projectName,
  branchName,
  commitMessage,
  prTitle,
  prBody,
  files = [],
}) {
  console.log(`\n[Git Manager] ========================================`);
  console.log(`[Git Manager] Iniciando flujo completo para: ${projectName}`);

  // 1. Clonar repositorio
  const projectDir = await cloneRepository(repoUrl, projectName);

  // 2. Crear branch
  await createBranch(projectDir, branchName);

  // 3. Commit (si hay cambios)
  const hasCommit = await commit(projectDir, commitMessage, files);

  if (!hasCommit) {
    console.log(`[Git Manager] No hay cambios para subir. Finalizando.`);
    return { projectDir, prUrl: null, prNumber: null };
  }

  // 4. Push
  await push(projectDir, branchName);

  // 5. Crear PR (si hay GitHub token)
  let prUrl = null;
  let prNumber = null;

  try {
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const pr = await createPullRequest({
      owner,
      repo,
      head: branchName,
      base: "main",
      title: prTitle,
      body: prBody,
    });
    prUrl = pr.url;
    prNumber = pr.number;
  } catch (err) {
    console.warn(`[Git Manager] ⚠️ No se pudo crear PR: ${err.message}`);
  }

  console.log(`[Git Manager] ✓ Flujo completo finalizado`);
  console.log(`[Git Manager] ========================================\n`);

  return { projectDir, prUrl, prNumber };
}

/**
 * Obtiene el path del workspace de un proyecto.
 */
function getProjectPath(projectName) {
  return path.join(WORKSPACE_DIR, projectName);
}

/**
 * Verifica si un proyecto existe en el workspace.
 */
function projectExists(projectName) {
  return fs.existsSync(getProjectPath(projectName));
}

module.exports = {
  cloneRepository,
  createBranch,
  commit,
  push,
  createPullRequest,
  fullWorkflow,
  getProjectPath,
  projectExists,
  parseGitHubUrl,
  WORKSPACE_DIR,
};
