# Tairos OS (Tayros)

> **La plataforma de desarrollo colaborativo de ciclo cerrado asistida por agentes de IA.**

Tairos OS es el centro operativo para la startup global de software Tayros. Permite a un equipo de 3 ingenieros humanos actuar como directores de intención y coordinar un enjambre de agentes de IA en un pipeline jerárquico A2A (Architect -> Workers) para crear, testear, auto-reparar (self-healing) y lanzar aplicaciones a producción de forma soberana.

---

## 1. Roles del Sistema

*   **Humanos (Arquitectos de Sistemas):** Diseñan el mapa lógico del producto, definen especificaciones técnicas de alto nivel (Markdown) y votan para aprobar propuestas o despliegues.
*   **The Architect (Claude 3.5 Sonnet / Gemini 1.5 Pro):** Analiza las intenciones de los humanos, fragmenta los problemas complejos en tareas atómicas y valida la integración de código.
*   **The Workers (Qwen-Coder / DeepSeek-Coder / Llama 3 local):** Toman tareas de la cola del pipeline, escriben el código, crean pruebas de calidad y redactan la documentación técnica.

---

## 2. Arquitectura Tecnológica Híbrida y Soberana

*   **Frontend (Nube en Vercel):** Interfaz web y mobile PWA responsiva con diseño premium estilo Bento Grid + Liquid Glass para visualizar la sala de chat, tareas y métricas en tiempo real.
*   **Base de Datos y Sincronización (Supabase):** Capa realtime que gestiona las conversaciones del equipo, la cola de tareas del pipeline y el portafolio de proyectos.
*   **Búnker Operativo Local (NAS / Servidor Local):** Runner local en segundo plano (PM2) que ejecuta las herramientas con acceso a la terminal, Docker y repositorios de código locales, manteniendo la propiedad intelectual 100% segura.

---

## 3. Estructura de Directorios (Monorepo Unificado)

```
tairos-os/
├── .claude/
│   ├── skills/                # Habilidades exclusivas del agente de Tairos OS
│   │   ├── new-app/           # Entrevista interactiva de negocio
│   │   ├── bucle-agentico/    # Ejecución de desarrollo local por fases
│   │   ├── self-healing/      # Captura de errores y parches autónomos
│   │   └── quality-gates/     # Control de calidad estricto antes de deploy
│   ├── memory/                # Memoria persistente del equipo (git-versionada)
│   └── PRPs/                  # Propuestas de requerimientos del producto
│
├── src/                       # 🆕 Frontend + Lógica de Negocio (Unificado)
│   ├── app/                   # Next.js App Router (UI principal)
│   │   ├── chat/              # Sala de chat realtime humano-agente
│   │   ├── dashboard/         # Dashboard principal con métricas
│   │   ├── pipeline/          # Cola y estado de tareas A2A
│   │   ├── projects/          # Portafolio de proyectos
│   │   ├── healing/           # Eventos de self-healing
│   │   ├── settings/          # Configuración del sistema
│   │   └── login/             # Autenticación
│   │
│   ├── features/              # Modularidad por capacidades de negocio
│   │
│   └── shared/                # 🆕 Código compartido entre frontend y runner
│       ├── components/        # UI components (AppLayout, Sidebar, ThemeProvider)
│       ├── data/              # Mock data para desarrollo
│       ├── supabase.ts        # Cliente Supabase
│       ├── theme.ts           # Sistema de temas (Bento Grid + Liquid Glass)
│       └── types.ts           # Tipos TypeScript compartidos
│
├── runner/                    # Daemon local de ejecución del búnker
│   ├── index.js               # Process manager local (PM2)
│   ├── ecosystem.config.js    # Configuración PM2
│   └── package.json           # Dependencias del runner
│
├── next.config.ts             # Configuración Next.js
├── tsconfig.json              # TypeScript config
├── tailwind.config.ts         # Tailwind CSS config
├── package.json               # Dependencias principales
├── .env.local                 # Variables de entorno (no en git)
├── CLAUDE.md                  # Cerebro del sistema
├── GEMINI.md                  # Espejo para Gemini
├── DOCUMENTACION.md           # Documentación técnica
└── README.md                  # Este archivo
```

---

## 4. Instalación y Setup

### Requisitos Previos
- Node.js v20+ o v22+
- npm o yarn
- Cuenta de Supabase (gratuita)
- **Para IA:** Elige una opción:
  - **Opción A (Recomendada):** Ollama instalado localmente (gratis, privado) - Ver [OLLAMA-SETUP.md](./OLLAMA-SETUP.md)
  - **Opción B:** Cuenta de OpenRouter con API key (requiere pago)
- Cuenta de Vercel (opcional para deploy)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url> tairos-os
cd tairos-os

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Configurar IA (elige una opción):

## OPCIÓN A: Ollama Local (Gratis, Privado) - RECOMENDADO
# Instalar modelos necesarios
ollama pull qwen2.5-coder:32b
ollama pull qwen2.5-coder:7b

# Iniciar servidor Ollama (en otra terminal)
ollama serve

# Configurar en .env.local:
# OLLAMA_BASE_URL=http://localhost:11434
# (dejar OPENROUTER_API_KEY vacío)

## OPCIÓN B: OpenRouter (Pago)
# Obtener API key en: https://openrouter.ai/keys
# Configurar en .env.local:
# OPENROUTER_API_KEY=sk-or-v1-tu-clave-aqui

# Ver guía completa de Ollama: OLLAMA-SETUP.md

# 5. Ejecutar la base de datos
# Ir a Supabase Dashboard y ejecutar supabase_schema.sql

# 6. Validar configuración
npm run validate

# 7. Iniciar el proyecto
npm run dev:all
# Esto inicia frontend (puerto 3000) y runner simultáneamente
```

---

## 5. Comandos Disponibles

### Desarrollo
```bash
npm run dev              # Frontend Next.js (http://localhost:3000)
npm run dev:runner       # Runner local (búnker)
npm run dev:all          # Ambos simultáneamente (recomendado)
```

### Producción
```bash
npm run build            # Build para producción
npm start                # Servidor producción
```

### Runner (Búnker Local)
```bash
npm run runner:start     # Iniciar runner con PM2
npm run runner:stop      # Detener runner
npm run runner:restart   # Reiniciar runner
npm run runner:logs      # Ver logs del runner
```

### Utilidades
```bash
npm run lint             # ESLint
npm run validate         # Validar configuración de .env.local
npx tsc --noEmit         # Verificar tipos TypeScript
```

---

## 6. Flujo Diario de Trabajo

1.  **Intención:** Un humano escribe un requerimiento en el chat: `@tairos /new-app`.
2.  **Propuesta (PRP):** El Agente Architect redacta un archivo de requerimientos técnicos en `.claude/PRPs/`.
3.  **Aprobación:** Los humanos revisan y votan (mínimo 2 votos a favor).
4.  **Ejecución A2A:** El Architect divide las tareas y las asigna a los Workers en la cola.
5.  **Self-Healing & QA:** Si el build o los tests fallan, el Agente Auditor captura el error y el Refactor lo parcha de forma autónoma.
6.  **Despliegue & Outcomes:** El Architect despliega el SaaS e instrumenta las métricas de negocio.

---

## 7. Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| **Frontend** | Next.js 14 + React 18 + TypeScript | Interfaz web y PWA |
| **Estilos** | Tailwind CSS 3.4 + Bento Grid | Sistema de diseño premium |
| **Base de Datos** | Supabase (PostgreSQL + Realtime) | Persistencia y sincronización |
| **Auth** | Supabase Auth | Autenticación y autorización |
| **IA Architect** | Claude 3.5 Sonnet (OpenRouter) o Qwen 2.5 Coder 32B (Ollama) | Razonamiento y coordinación |
| **IA Workers** | Qwen 2.5 Coder 32B (OpenRouter) o Qwen 2.5 Coder 7B (Ollama) | Codificación eficiente |
| **Runner** | Node.js + PM2 | Daemon local (búnker) |
| **Deploy** | Vercel | Hosting frontend |

---

## 8. Páginas Disponibles

Una vez iniciado (`npm run dev`):

- **Dashboard** - http://localhost:3000/dashboard - Vista general del sistema
- **Chat** - http://localhost:3000/chat - Sala de chat colaborativa
- **Pipeline** - http://localhost:3000/pipeline - Cola de tareas A2A
- **Projects** - http://localhost:3000/projects - Portafolio de proyectos
- **Healing** - http://localhost:3000/healing - Eventos de auto-reparación
- **Settings** - http://localhost:3000/settings - Configuración del sistema

---

## 9. Migración Frontend → Monorepo

El proyecto fue unificado el 16/07/2026. Ver [MIGRACION.md](./MIGRACION.md) para detalles.

**Ventajas del monorepo:**
- ✅ Tipos compartidos entre frontend y runner
- ✅ Un solo archivo de configuración (.env.local)
- ✅ Versionado unificado en git
- ✅ Desarrollo simplificado (un comando para todo)
- ✅ Refactoring atómico
- ✅ Onboarding más fácil

---

## 10. Documentación Adicional

- [OLLAMA-SETUP.md](./OLLAMA-SETUP.md) - **Guía completa para usar Ollama local (gratis, sin API keys)**
- [CLAUDE.md](./CLAUDE.md) - Instrucciones para el agente Claude
- [GEMINI.md](./GEMINI.md) - Instrucciones para el agente Gemini
- [DOCUMENTACION.md](./DOCUMENTACION.md) - Documentación técnica detallada
- [prioridades_90.md](./prioridades_90.md) - OKRs y roadmap

---

## 11. Estado del Proyecto y Roadmap

### ✅ Fase 1: Integración de IA y Task Generator (COMPLETADO)
- ✅ Cliente LLM con OpenRouter (Claude + Qwen)
- ✅ Chat orchestrator con comandos `/new-app`, `/feature`, `@tairos`
- ✅ Task generator automático tras votación
- ✅ Self-healing con diagnóstico y parches
- ✅ Validador de configuración

### ✅ Fase 2: Git Manager y Workspace (COMPLETADO)
- ✅ Módulo git-manager.js para operaciones Git
- ✅ Clonado automático de repositorios
- ✅ Creación de branches y commits
- ✅ Push a remote
- ✅ Creación de Pull Requests con GitHub API
- ✅ Workspace local para proyectos (`/workspace`)
- ✅ Integración completa con el pipeline

### ✅ Fase 3: Self-Healing Avanzado (COMPLETADO)
- ✅ Aplicación automática de parches al código
- ✅ Creación de backups antes de modificar
- ✅ Commits automáticos con los fixes
- ✅ Re-ejecución automática tras aplicar parche
- ✅ Validación del fix (si pasa, continúa; si falla, reporta)
- ✅ Eventos detallados en healing_events

### ✅ Fase 4: Deploy Automático (COMPLETADO)
- ✅ Integración con Vercel API
- ✅ Deploy automático a preview tras QA
- ✅ Validación de deployment (health check)
- ✅ Actualización de URL en base de datos
- ✅ Notificaciones en chat con links
- ✅ Rollback automático disponible
- ✅ Monitoreo de estado del deploy

### ✅ Fase 5: Optimización y Analytics (COMPLETADO)
- ✅ Cost optimizer con cache inteligente
- ✅ Tracking de uso y costos por modelo
- ✅ Alertas de presupuesto diario
- ✅ Limpieza automática de cache antiguo
- ✅ Estadísticas de uso en tiempo real
- ✅ Ahorro automático con cache (24h)

---

## 12. Soporte y Contribución

Para preguntas o issues, contactar al equipo de Tayros.

**Estado del Proyecto:** ✅ En Desarrollo Activo

---

**Tairos OS** — De la intención al código, de forma soberana.
