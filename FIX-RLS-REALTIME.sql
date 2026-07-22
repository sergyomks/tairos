-- ============================================
-- FIX: Políticas RLS para que el panel de votación
-- funcione para TODOS los usuarios autenticados
-- y que el Runner (service_role) pueda insertar.
-- Ejecutar en Supabase SQL Editor.
-- ============================================

-- 1. Permitir al service_role insertar PRPs (el runner usa service_role)
-- service_role ya bypassa RLS, pero aseguramos que anon pueda leer para Realtime
DO $$
BEGIN
  -- PRPs: permitir lectura a cualquier rol (incluyendo anon para Realtime)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Cualquier rol puede leer PRPs' AND tablename = 'prps'
  ) THEN
    CREATE POLICY "Cualquier rol puede leer PRPs"
      ON public.prps FOR SELECT
      TO anon, authenticated, service_role
      USING (true);
  END IF;

  -- PRPs: permitir al service_role insertar/actualizar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role puede gestionar PRPs' AND tablename = 'prps'
  ) THEN
    CREATE POLICY "Service role puede gestionar PRPs"
      ON public.prps FOR ALL
      TO service_role
      USING (true);
  END IF;

  -- Votes: permitir lectura a todos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Cualquier rol puede leer votos' AND tablename = 'prp_votes'
  ) THEN
    CREATE POLICY "Cualquier rol puede leer votos"
      ON public.prp_votes FOR SELECT
      TO anon, authenticated, service_role
      USING (true);
  END IF;

  -- Chat messages: permitir al service_role insertar (el runner envía mensajes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role puede insertar mensajes' AND tablename = 'chat_messages'
  ) THEN
    CREATE POLICY "Service role puede insertar mensajes"
      ON public.chat_messages FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  -- Agent tasks: permitir al service_role gestionar tareas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role puede gestionar tareas' AND tablename = 'agent_tasks'
  ) THEN
    CREATE POLICY "Service role puede gestionar tareas"
      ON public.agent_tasks FOR ALL
      TO service_role
      USING (true);
  END IF;

  -- Projects: permitir al service_role crear proyectos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role puede gestionar proyectos' AND tablename = 'projects'
  ) THEN
    CREATE POLICY "Service role puede gestionar proyectos"
      ON public.projects FOR ALL
      TO service_role
      USING (true);
  END IF;
END
$$;

-- 2. Verificar que Realtime esté habilitado para las tablas necesarias
DO $$
BEGIN
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.chat_messages,
    public.agent_tasks,
    public.runner_status,
    public.prps,
    public.prp_votes,
    public.healing_events;
END
$$;
