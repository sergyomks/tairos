/**
 * scaffold.js — Generador de scaffold de apps para Tairos OS
 *
 * Crea la estructura base de un proyecto Next.js en workspace/[nombre]/
 * cuando una PRP es aprobada. Es el primer paso del pipeline A2A.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const WORKSPACE_DIR = path.resolve(__dirname, "../workspace");

const FILES = {
  "package.json": ({ name }) => JSON.stringify(
    {
      name: name.toLowerCase().replace(/\s+/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "^16.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "@supabase/supabase-js": "^2.49.0",
        "@supabase/ssr": "^0.6.0",
      },
      devDependencies: {
        typescript: "^5.7.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        tailwindcss: "^3.4.0",
        postcss: "^8.4.0",
        autoprefixer: "^10.4.0",
      },
    },
    null,
    2
  ),

  "next.config.js": () => `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`,

  "tsconfig.json": () => JSON.stringify(
    {
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    null,
    2
  ),

  "tailwind.config.ts": () => `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,

  "postcss.config.mjs": () => `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,

  "src/app/globals.css": () => `@tailwind base;
@tailwind components;
@tailwind utilities;
`,

  "src/app/layout.tsx": () => `export const metadata = {
  title: "App generada por Tairos OS",
  description: "Software fabricado con Tairos OS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
`,

  "src/app/page.tsx": ({ name, description }) => `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">${name}</h1>
      <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl text-center">
        ${description}
      </p>
      <p className="mt-8 text-sm text-slate-400">
        Fabricado con Tairos OS
      </p>
    </main>
  );
}
`,

  "src/lib/supabase/client.ts": () => `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`,

  "src/lib/supabase/server.ts": () => `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se puede ignorar en lectura de rutas RSC
          }
        },
      },
    }
  );
}
`,

  "src/features/README.md": () => `# Features

Agrupa aquí cada capacidad de negocio siguiendo la arquitectura Feature-First.

\`\`\`
src/features/
├── auth/
├── dashboard/
└── ...
\`\`\`
`,

  "README.md": ({ name }) => `# ${name}

> Aplicación generada por Tairos OS.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS
- Supabase

## Setup

1. \`npm install\`
2. Copiar \`.env.local.example\` a \`.env.local\` y completar credenciales de Supabase
3. \`npm run dev\`
`,

  ".gitignore": () => `# dependencies
node_modules/
.pnp
.pnp.js

# next.js
.next/
out/

# production
build/

# misc
.DS_Store
*.pem

# debug
npm-debug.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,

  ".env.local.example": () => `NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
`,

  "BUSINESS_LOGIC.md": ({ name, description }) => `# BUSINESS_LOGIC.md - ${name}

> Generado por Tairos OS

## 1. Problema de Negocio
${description}

## 2. Solución
Aplicación SaaS para resolver el problema descrito.

## 3. Stack Confirmado
- Next.js 16 + React 19 + TypeScript + Tailwind CSS
- Supabase (Auth + Database + Storage)
- Zod para validación

## 4. Próximos Pasos
- [ ] Definir schema de Supabase
- [ ] Implementar autenticación
- [ ] Construir features principales
- [ ] Testing y deploy
`,
};

/**
 * Crea el scaffold de una app en workspace/[projectName]/
 */
async function createScaffold(projectName, description = "") {
  const safeName = projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const projectDir = path.join(WORKSPACE_DIR, safeName);

  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  if (fs.existsSync(projectDir)) {
    console.log(`[Scaffold] Proyecto ya existe en ${projectDir}. Saltando scaffold.`);
    return projectDir;
  }

  console.log(`[Scaffold] Creando scaffold en ${projectDir}...`);

  const context = { name: projectName, description: description || "Aplicación generada por Tairos OS" };

  for (const [relativePath, contentFn] of Object.entries(FILES)) {
    const fullPath = path.join(projectDir, relativePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, contentFn(context), "utf-8");
    console.log(`[Scaffold] ✓ ${relativePath}`);
  }

  // Inicializar git repo con commit inicial
  try {
    execSync("git init", { cwd: projectDir, stdio: "ignore" });
    execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
    execSync('git commit -m "feat: initial scaffold by Tairos OS"', {
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
    console.log("[Scaffold] ✓ Repositorio git inicializado con commit inicial.");
  } catch (gitErr) {
    console.warn(`[Scaffold] ⚠️ No se pudo inicializar git: ${gitErr.message}`);
  }

  console.log(`[Scaffold] ✓ Scaffold completado en ${projectDir}`);
  return projectDir;
}

module.exports = { createScaffold, WORKSPACE_DIR };
