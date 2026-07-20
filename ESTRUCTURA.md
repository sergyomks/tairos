# Tairos OS — Estructura de la Plataforma

> Fábrica de software: **3 humanos + 1 agente IA**.
> Los humanos deciden. La IA construye sola (reutilizando SaaS Factory V5).
> Este documento describe **cómo se organiza** el sistema. Sin implementación aún.

---

## Idea en una frase

Una plataforma donde tres roles humanos (Negocio, Frontend, Backend) conversan y votan con un agente de IA; la IA orquesta la fábrica (SaaS Factory) y fabrica cualquier software de forma autónoma tras aprobación democrática (mínimo 2 de 3 votos).

---

## Actores

| Actor | Rol | Qué hace |
|-------|-----|----------|
| Humano **Negocio** | Director de intención | Define el problema, KPI, prioridad |
| Humano **Frontend** | Director de experiencia | Aprueba UX, diseño, flujos |
| Humano **Backend** | Director técnico | Aprueba datos, APIs, seguridad |
| **Architect (IA)** | Cerebro | Traduce intención → PRP/plan, pide votos |
| **Workers (IA)** | Manos | Ejecutan código, tests, self-healing |
| **SaaS Factory** | Caja de herramientas | 30 skills (login, pagos, IA, quality-gates…) |

```
[3 Humanos] ⇄ Chat + Votos ⇄ [Architect IA]
                                    │
                                    ▼ (plan aprobado 2/3)
                            [Pipeline A2A / Workers]
                                    │
                                    ▼
                         [SaaS Factory skills]
                                    │
                                    ▼
                         [workspace/apps/*]  ← software fabricado
```

---

## Árbol de carpetas (cómo queda)

```
tairos-os/
│
├── ESTRUCTURA.md              ← Este mapa
├── BUSINESS_LOGIC.md          ← Lógica de negocio de la plataforma
├── CLAUDE.md / GEMINI.md      ← Cerebro del agente
├── README.md / DOCUMENTACION.md
│
├── src/                       ← App de la plataforma (Next.js)
│   ├── app/                   ← Rutas UI
│   │   ├── chat/              ← Sala 3 humanos + IA
│   │   ├── dashboard/         ← Pulso del sistema
│   │   ├── pipeline/          ← Cola A2A en vivo
│   │   ├── projects/          ← Portafolio de apps fabricadas
│   │   ├── healing/           ← Self-healing
│   │   ├── settings/          ← Config
│   │   └── login/
│   │
│   ├── features/              ← Dominios de negocio (Feature-First)
│   │   ├── members/           ← Los 3 roles humanos
│   │   ├── chat/              ← Colaboración humano↔IA
│   │   ├── decisions/         ← Votos / aprobación 2 de 3
│   │   ├── pipeline/          ← Orquestación A2A (tareas)
│   │   ├── factory/           ← Puente a SaaS Factory (skills)
│   │   ├── projects/          ← Apps creadas por la fábrica
│   │   ├── healing/           ← Auto-reparación
│   │   └── outcomes/          ← Métricas reales (loop V5)
│   │
│   ├── shared/                ← UI, tipos, supabase, tema
│   └── lib/                   ← llm-client, chat-handler
│
├── runner/                    ← Daemon local (búnker): ejecuta tareas
│
├── factory/                   ← Punto de anclaje a SaaS Factory V5
│                              ← (skills + template; se enlaza/copia después)
│
├── workspace/
│   └── apps/                  ← Productos fabricados (1 carpeta por app)
│
├── docs/                      ← Docs de producto / arquitectura
│
└── .claude/
    ├── skills/                ← Skills Tairos + (luego) skills SF V5
    │   ├── governance/        ← Reglas de voto 2/3
    │   ├── a2a-pipeline/      ← Architect → Workers
    │   ├── self-healing/      ← Auditor → Refactor
    │   └── knowledge-graph/   ← Memoria de código / contexto
    ├── memory/                ← Memoria del equipo (git)
    ├── PRPs/                  ← Planes antes de construir
    └── design-systems/        ← Sistemas visuales heredados de SF
```

---

## Capas del sistema

| Capa | Dónde vive | Responsabilidad |
|------|------------|-----------------|
| **UI / PWA** | `src/app` | Chat, votos, pipeline, portafolio |
| **Dominio** | `src/features/*` | Lógica de cada capacidad |
| **Datos** | Supabase | members, chat, votes, tasks, projects |
| **Ejecución** | `runner/` | Corre en el búnker local (PM2) |
| **Fábrica** | `factory/` + skills SF | Construye cualquier SaaS |
| **Output** | `workspace/apps/` | Código de los productos nacidos |

---

## Flujo de decisión (estructura lógica)

1. Un humano escribe intención en **chat**
2. **Architect** genera PRP / plan
3. Feature **decisions** abre votación (Negocio / Frontend / Backend)
4. Con **≥ 2 votos a favor** → pasa a **pipeline**
5. **factory** activa skills de SaaS Factory (new-app, add-login, prp, bucle…)
6. **runner** ejecuta en el búnker → escribe en `workspace/apps/[nombre]`
7. Si falla → **healing**; si pasa quality-gates → deploy (con nuevo voto si es prod)

---

## Reutilizar SaaS Factory (pendiente de enlace)

Fuente: repositorio SaaS Factory V5 (skills + cerebro).

Próximo paso (cuando lo apruebes):
- Enlazar o copiar los **30 skills** a `.claude/skills/`
- Enlazar design-systems y PRP base a `.claude/`
- Dejar `factory/` como referencia al template base de apps

Por ahora: carpetas listas, skills Tairos stub, sin copiar contenido aún.

---

## Qué NO es esta estructura todavía

- No hay lógica de votos implementada
- No hay bridge real a SaaS Factory
- No se fabrican apps todavía

Es el **esqueleto** para construir encima.
