/**
 * Script de prueba para verificar que qwen2.5-coder:7b responde correctamente
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env.local") });
const { callLLM } = require("./llm");

async function testModel() {
  console.log("🧪 Probando qwen2.5-coder:7b con prompt de arquitectura...\n");

  const systemPrompt = `Eres @tairos-architect, el agente experto de Tairos OS especializado en arquitectura de software.

Tu tarea es analizar la solicitud de "Sistema de Gestión de Inventario" y proponer una arquitectura técnica completa y profesional.

DEBES incluir en tu respuesta:

**Stack Técnico Propuesto:**
- Frontend: (Next.js, React, Vue, etc.)
- Backend: (Node.js, Python, etc.)
- Base de Datos: (PostgreSQL, MongoDB, etc.)
- Autenticación: (JWT, OAuth, Supabase Auth, etc.)
- Deploy: (Vercel, AWS, Railway, etc.)

**Arquitectura de Base de Datos:**
Lista las tablas principales con sus campos:
1. \`tabla_1\` — Descripción (id, campo1, campo2, created_at)
2. \`tabla_2\` — Descripción (id, campo1, campo2, created_at)

**Funcionalidades Core:**
- Funcionalidad 1
- Funcionalidad 2
- Funcionalidad 3

**Plan de Desarrollo:**
1. Fase 1: Base de datos y modelos
2. Fase 2: API endpoints
3. Fase 3: Frontend e integración
4. Fase 4: Testing y deployment

Sé técnico, específico y profesional. Responde en español.`;

  try {
    const start = Date.now();
    
    const { content, model, usage } = await callLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Solicitud: Sistema de Gestión de Inventario" },
      ],
      model: "architect",
      maxTokens: 1536,
      temperature: 0.7,
      useCache: false, // NO usar cache para esta prueba
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log("✅ RESPUESTA DEL MODELO:");
    console.log("=".repeat(80));
    console.log(content);
    console.log("=".repeat(80));
    console.log(`\n📊 ESTADÍSTICAS:`);
    console.log(`   Modelo: ${model}`);
    console.log(`   Tokens: ${usage.total_tokens || "N/A"}`);
    console.log(`   Tiempo: ${elapsed}s`);
    console.log(`   Longitud: ${content.length} caracteres\n`);

    // Validar que la respuesta tenga los elementos esperados
    const hasStack = content.includes("Stack") || content.includes("stack");
    const hasDB = content.includes("Base de Datos") || content.includes("Datos") || content.includes("tablas");
    const hasFuncionalidades = content.includes("Funcionalidad") || content.includes("Features");
    const hasPlan = content.includes("Fase") || content.includes("Plan");

    console.log("🔍 VALIDACIÓN:");
    console.log(`   ${hasStack ? "✅" : "❌"} Incluye Stack Técnico`);
    console.log(`   ${hasDB ? "✅" : "❌"} Incluye Base de Datos`);
    console.log(`   ${hasFuncionalidades ? "✅" : "❌"} Incluye Funcionalidades`);
    console.log(`   ${hasPlan ? "✅" : "❌"} Incluye Plan de Desarrollo`);
    console.log(`   ${content.length > 500 ? "✅" : "❌"} Respuesta suficientemente larga (${content.length} chars)`);

    if (hasStack && hasDB && hasFuncionalidades && hasPlan && content.length > 500) {
      console.log("\n🎉 ¡ÉXITO! El modelo qwen2.5-coder:7b está funcionando correctamente.");
    } else {
      console.log("\n⚠️ ADVERTENCIA: La respuesta no cumple todos los criterios.");
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    console.error("\n🔧 SOLUCIONES:");
    console.error("   1. Verifica que Ollama esté corriendo: ollama serve");
    console.error("   2. Verifica que el modelo esté instalado: ollama list | grep qwen2.5-coder:7b");
    console.error("   3. Verifica la configuración en .env.local");
  }

  process.exit(0);
}

testModel();
