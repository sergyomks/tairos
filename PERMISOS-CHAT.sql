-- ============================================
-- PERMISOS ADICIONALES PARA EL CHAT
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Permitir a usuarios autenticados eliminar mensajes del chat
CREATE POLICY "Usuarios autenticados pueden eliminar mensajes del chat"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (true);

-- Permitir actualizar PRPs (cambiar status cuando hay quórum)
CREATE POLICY "Usuarios autenticados pueden actualizar PRPs"
ON public.prps
FOR UPDATE
TO authenticated
USING (true);
