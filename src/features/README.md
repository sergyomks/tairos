# Features — Tairos OS (Feature-First)

Cada carpeta es un dominio de la plataforma. Por ahora: **solo estructura**.

| Feature | Propósito |
|---------|-----------|
| `members/` | Los 3 humanos: Negocio, Frontend, Backend |
| `chat/` | Sala colaborativa humano ↔ IA |
| `decisions/` | Votos y aprobación democrática (2 de 3) |
| `pipeline/` | Cola A2A: Architect → Workers |
| `factory/` | Puente a SaaS Factory V5 (skills / template) |
| `projects/` | Portafolio de apps fabricadas |
| `healing/` | Self-healing (Auditor → Refactor) |
| `outcomes/` | Métricas reales del loop cerrado V5 |

Dentro de cada feature:

```
[feature]/
├── components/
├── hooks/
├── services/
├── types/
└── store/
```
