-- ============================================
-- AGREGAR SOPORTE PARA IMÁGENES EN EL CHAT
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna para URL de imagen en mensajes
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Crear bucket de storage para imágenes del chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de storage para el bucket
CREATE POLICY "Usuarios autenticados pueden subir imágenes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Imágenes del chat son públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-images');

CREATE POLICY "Usuarios pueden eliminar sus propias imágenes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images');
