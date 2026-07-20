# Documentación Técnica del Proyecto: Tairos OS

Este documento detalla la estructura inicial, filosofía, decisiones de arquitectura y la configuración de agentes implementados para **Tairos OS** en base a las especificaciones y manuales proporcionados.

---

## 1. Filosofía de Operación (Dirección de Intenciones)

Tairos OS se fundamenta en la automatización agentica de ciclo cerrado. Los ingenieros humanos asumen el rol de **Arquitectos**, mientras que el código se convierte en un subproducto de la conversación y del diseño estructurado. 

### Características del Paradigma:
*   **Apalancamiento de Intenciones:** Definición de requerimientos técnicos y lógica de negocio mediante archivos Markdown estructurados (`PRPs`).
*   **Voto de Aprobación Democrático:** Se requiere el consenso de al menos 2 de los 3 humanos del equipo para autorizar cambios críticos en la base de datos o realizar despliegues automáticos a producción.
*   **Soberanía Cognitiva (Búnker Local):** Las operaciones pesadas del código, consultas en repositorios Git y el almacenamiento de vectores locales se gestionan en servidores locales (ej. Mac Mini o NAS con Docker/Linux), asegurando la confidencialidad de la propiedad intelectual.

---

## 2. Arquitectura de Infraestructura Híbrida

La plataforma se distribuye de manera modular para combinar accesibilidad en la nube y seguridad local:

```
[ Frontend: Next.js (Vercel) ] <--> [ DB / Realtime (Supabase) ] <--> [ Agent Runner (Local / PM2) ]
```

1.  **Dashboard Web & PWA (Nube - Vercel):** Hospedado de forma rápida para visualización del chat, colas de tareas del pipeline A2A y métricas de outcomes en tiempo real.
2.  **Base de Datos y Tiempo Real (Nube - Supabase):** Sincroniza la cola de tareas del pipeline A2A y los mensajes del chat interactivo instantáneamente.
3.  **Runner de Agentes (Local - Búnker):** Un daemon en Node.js supervisado por PM2 que corre de forma local. Escucha la cola de tareas de Supabase, maneja repositorios locales y ejecuta compilaciones, tests en Playwright y auto-reparaciones.

---

## 3. Herramientas Necesarias (Stack de Software y Servicios)

Para poder implementar, ejecutar y operar Tairos OS de manera exitosa, el equipo necesita configurar las siguientes herramientas externas (servicios en la nube) e internas (servidor local/búnker):

### 3.1. Servicios Externos (Nube)
*   **Supabase (Cuenta Gratuita/Pro):** 
    *   *Propósito:* Base de datos PostgreSQL para almacenar estados, mensajes de chat y tareas del runner, además de la sincronización en tiempo real (Websockets).
*   **Vercel (Cuenta Personal/Team):**
    *   *Propósito:* Alojamiento del frontend de la aplicación Next.js y distribución PWA móvil.
*   **GitHub (Repositorio Privado):**
    *   *Propósito:* Alojar los repositorios de Tairos OS y de los productos de software que este fabrique de manera versionada y segura.
*   **OpenRouter / Proveedor de LLM (API Key):**
    *   *Propósito:* Acceso unificado a modelos avanzados como **Claude 3.5 Sonnet** (para el rol de Architect) y modelos de bajo costo como **Qwen-Coder / DeepSeek-Coder** (para Workers).

### 3.2. Servidor Local / Búnker (NAS, Mac Mini o PC de Desarrollo dedicada)
*   **Node.js (v20+ o v22+):**
    *   *Propósito:* Entorno de ejecución para el Runner daemon local y compilación de Next.js.
*   **Git CLI:**
    *   *Propósito:* Clonar, editar y crear ramas o Pull Requests de forma automatizada por el agente.
*   **PM2 (Process Manager para Node.js):**
    *   *Propósito:* Mantener el Runner local corriendo en segundo plano de manera continua e ininterrumpida.
*   **Docker:**
    *   *Propósito:* Aislar los entornos de compilación y ejecución de pruebas de las apps generadas, evitando comprometer el sistema operativo anfitrión.
*   **Ollama (Opcional - Soberanía Total):**
    *   *Propósito:* Ejecutar modelos Open Source (como Llama-3 u Qwen) localmente en el búnker a costo cero de API.

---

## 4. Directorios y Archivos Creados

Se han creado los siguientes directorios y archivos de configuración en `/home/sergyo/Documentos/tairos os/tairos-os`:

### Archivos de Configuración del Proyecto
*   **`README.md`:** Resumen explicativo del propósito del proyecto, roles del equipo, arquitectura híbrida y flujos de trabajo cotidianos.
*   **`CLAUDE.md`:** Instrucciones principales para el agente sobre el flujo de aprobación, el pipeline A2A y las reglas de codificación.
*   **`GEMINI.md`:** Archivo espejo adaptado específicamente para guiar el comportamiento y las restricciones de Gemini durante las sesiones de desarrollo.
*   **`prioridades_90.md`:** Planificación trimestral alineada con los OKRs de desarrollo de Tairos OS y el lanzamiento del producto SaaS piloto global.
*   **`DOCUMENTACION.md`:** Este archivo guía con los detalles técnicos del proyecto.

### Estructura de Carpetas e Índices
*   **`.claude/`**:
    *   `skills/README.md`: Directorio de habilidades del agente (new-app, bucle-agentico, self-healing, quality-gates, etc.).
    *   `memory/README.md`: Directorio para la memoria persistente e indexada del proyecto que viaja con el repositorio Git.
    *   `PRPs/README.md`: Carpeta destinada a las propuestas técnicas de requisitos generadas por el Architect.
*   **`src/`** (Código de la aplicación):
    *   `app/README.md`: Rutas y páginas del dashboard Next.js (chat, mission-control, tareas).
    *   `features/README.md`: Componentes y lógica agrupados mediante arquitectura *Feature-First*.
    *   `shared/README.md`: Componentes comunes, layouts Bento Grid y librerías transversales.
*   **`runner/`**:
    *   `README.md`: Carpeta del daemon en segundo plano encargado de ejecutar de forma local las tareas de la base de datos de Supabase.

---

## 5. Pipeline Agent-to-Agent (A2A)

El flujo de trabajo automatizado se orquesta de la siguiente forma:

1.  **Intención:** Los humanos ingresan especificaciones técnicas en el chat de Tairos OS.
2.  **Planificación:** El agente **Architect** (Claude 3.5 Sonnet / Gemini 1.5 Pro) analiza la intención, genera un plan (PRP) y, tras la aprobación humana (mínimo 2 votos), desglosa el plan en tareas.
3.  **Codificación:** Los agentes **Workers** (Qwen-Coder / DeepSeek-Coder de bajo costo y optimizados) ejecutan concurrentemente las tareas de código y pruebas.
4.  **Autorreparación (Self-Healing):** Si surge un fallo de compilación o de pruebas, el agente **Auditor** recopila el stack trace del error y el agente **Refactor** genera e integra automáticamente la solución, presentando un Pull Request verificado.
