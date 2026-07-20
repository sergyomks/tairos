# Agent Runner Daemon (Búnker Local)

Este directorio alojará el runner local que correrá en segundo plano (supervisado por PM2 o systemd).

## Responsabilidades:
1.  Escuchar de forma activa (polling) la cola de tareas `agent_tasks` en Supabase.
2.  Ejecutar en la máquina local/búnker los comandos de consola necesarios (git clone, npm install, playwright, build, typecheck, etc.).
3.  Reportar el progreso y logs de ejecución de vuelta a Supabase.
4.  Capturar los fallos del build o de tests e iniciar el flujo de parcheo automático (*self-healing*).
