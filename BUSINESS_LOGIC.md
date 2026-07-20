# BUSINESS_LOGIC.md - Tairos OS

> Generado por SaaS Factory | Fecha: 2026-07-20

## 1. Problema de Negocio
**Dolor:** Construir software hoy exige mucho código manual, decisiones dispersas y poca autonomía de la IA. Un equipo pequeño no puede operar una “fábrica” completa sin un sistema que combine humanos (dirección) e IA (ejecución).
**Costo actual:** Tiempo de desarrollo alto, cuellos de botella en decisiones, y fábricas de software (como SaaS Factory) que viven en el chat del agente pero no como plataforma colaborativa con gobernanza humana.

## 2. Solucion
**Propuesta de valor:** Una plataforma de fábrica de software donde 3 humanos (Negocio, Frontend, Backend) interactúan con un agente de IA para decidir, y la IA construye sola cualquier producto reutilizando SaaS Factory V5.

**Flujo principal (Happy Path):**
1. Los 3 humanos + IA conversan la intención de un producto
2. La IA genera un plan (PRP) y pide aprobación democrática (≥2 de 3 votos)
3. Con aprobación, el pipeline A2A activa skills de SaaS Factory
4. El runner local fabrica la app en `workspace/apps/` (código, tests, self-healing)
5. Quality gates + voto de deploy → producto en producción

## 3. Usuario Objetivo
**Rol:** Equipo fundador de 3 ingenieros/directores (Negocio, Frontend, Backend) que dirigen por intención.
**Contexto:** Startup / estudio de software que quiere fabricar muchos SaaS con un enjambre de agentes, sin perder control humano en decisiones críticas.

## 4. Arquitectura de Datos
**Input:**
- Mensajes de chat (humanos + IA)
- Votos de aprobación (2 de 3)
- Intenciones / PRPs / especificaciones
- Eventos del runner (logs, errores, heartbeats)

**Output:**
- Planes aprobados (PRPs)
- Tareas del pipeline A2A
- Repositorios/apps en `workspace/apps/`
- Dashboards de pipeline, healing y outcomes
- Deploys / PRs

**Storage (Supabase tables sugeridas):**
- `members`: los 3 roles (Negocio | Frontend | Backend)
- `chat_messages`: sala colaborativa
- `decisions` / votos: aprobaciones 2/3
- `agent_tasks`: cola del pipeline
- `projects`: portafolio de apps fabricadas
- `runner_heartbeat`: salud del búnker
- `events`: outcomes / métricas (loop V5)

## 5. KPI de Exito
**Metrica principal:** Pasar de intención aprobada (2/3 votos) a app scaffold + primera feature funcionando en `workspace/apps/` sin que los humanos escriban código.

## 6. Especificacion Tecnica (Para el Agente)

### Features a Implementar (Feature-First)
```
src/features/
├── members/      # Roles de los 3 humanos
├── chat/         # Colaboración humano ↔ IA
├── decisions/    # Gobernanza: votos 2 de 3
├── pipeline/     # Orquestación A2A
├── factory/      # Bridge a SaaS Factory V5
├── projects/     # Apps fabricadas
├── healing/      # Self-healing
└── outcomes/     # Métricas del loop cerrado
```

### Stack Confirmado
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4
- **Backend:** Supabase (Auth + Database + Realtime + RLS)
- **Ejecución:** Runner local (PM2) en búnker
- **Fábrica:** Skills SaaS Factory V5 (reutilizados)
- **Validacion:** Zod
- **State:** Zustand (si necesario)

### Proximos Pasos
1. [x] Estructura de carpetas (este paso)
2. [ ] Enlazar/copiar skills de SaaS Factory V5
3. [ ] Feature `decisions` (votos 2/3)
4. [ ] Bridge `factory` → skills SF
5. [ ] Runner consume cola y escribe en `workspace/apps/`
6. [ ] Testing E2E del flujo intención → scaffold
7. [ ] Deploy de la plataforma Tairos OS
