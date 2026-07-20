/**
 * API Route: Webhook de Supabase para procesar mensajes del chat
 * 
 * Este endpoint es llamado por Supabase Database Webhooks cada vez que
 * se inserta un nuevo mensaje en la tabla chat_messages.
 * 
 * Vercel lo ejecuta como una Serverless Function.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase con privilegios de admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Importar la lógica del chat orchestrator (lo crearemos después)
import { handleChatMessage } from "@/lib/chat-handler";

export async function POST(request: NextRequest) {
  try {
    // Leer el payload del webhook
    const payload = await request.json();

    console.log("[Webhook] Mensaje recibido:", payload);

    // Verificar que es un INSERT en chat_messages
    if (payload.type !== "INSERT" || payload.table !== "chat_messages") {
      return NextResponse.json({ error: "Invalid webhook type" }, { status: 400 });
    }

    const message = payload.record;

    // Ignorar mensajes del bot
    if (!message.sender_id || message.sender_name === "@tairos-architect") {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Procesar el mensaje
    await handleChatMessage(supabase, message);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Configuración de Vercel para esta función
export const config = {
  maxDuration: 60, // 60 segundos máximo (suficiente para OpenRouter)
};
