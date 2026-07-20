/**
 * Script temporal para limpiar mensajes de chat
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearChat() {
  console.log("Limpiando mensajes de chat...");
  
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Borra todo
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("✓ Chat limpiado exitosamente");
  }
  
  process.exit(0);
}

clearChat();
