---
name: a2a-pipeline
description: "Pipeline Agent-to-Agent de Tairos OS: Architect planifica, Workers ejecutan, cola en Supabase, runner local consume."
---

# A2A Pipeline

## Flujo
1. Architect genera plan/tareas tras aprobación humana
2. Tareas → tabla `agent_tasks`
3. Runner local toma tareas y ejecuta (código, tests)
4. Resultado → chat / pipeline UI / healing si falla

## Estado
Stub estructural. Implementación pendiente en `src/features/pipeline/` + `runner/`.
