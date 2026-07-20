# Arquitectura de actores — Tairos OS

```
                    ┌─────────────────────────────────────┐
                    │         CHAT (tiempo real)           │
                    │  Negocio · Frontend · Backend · IA   │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  DECISIONS — voto ≥ 2 de 3 humanos   │
                    └─────────────────┬───────────────────┘
                                      │ aprobado
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  PIPELINE A2A                        │
                    │  Architect → Workers → Quality Gates │
                    └─────────────────┬───────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
              ┌──────────────────┐      ┌──────────────────┐
              │ SaaS Factory V5  │      │ runner/ (búnker) │
              │ 30 skills        │◄────►│ ejecuta + git    │
              └────────┬─────────┘      └────────┬─────────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                       ┌────────────────────────┐
                       │  workspace/apps/[app]  │
                       │  producto fabricado    │
                       └────────────────────────┘
```

## Roles humanos (fijos)

1. **Negocio** — qué y por qué
2. **Frontend** — experiencia y UI
3. **Backend** — datos, APIs, seguridad

Ninguno escribe el producto final a mano: **dirigen y aprueban**.
