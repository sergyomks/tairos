-- ==========================================
-- SCRIPT DE MIGRACIÓN INICIAL PARA TAIROS OS
-- Ejecutar en el SQL Editor de tu proyecto de Supabase
-- ==========================================

-- 1. Habilitar la generación de UUIDs si no está activa
create extension if not exists "uuid-ossp";

-- 2. Tabla de Miembros (Los 3 humanos ingenieros)
create table public.members (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    role text check (role in ('Negocio', 'Frontend', 'Backend')) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS en members
alter table public.members enable row level security;

-- Políticas de seguridad para members
create policy "Cualquier usuario autenticado puede leer miembros"
    on public.members for select
    to authenticated
    using (true);

create policy "Los usuarios pueden gestionar su propio perfil de miembro"
    on public.members for all
    to authenticated
    using (auth.uid() = id);

-- 3. Tabla de Proyectos (SaaS construidos por la fábrica)
create table public.projects (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    repository_url text,
    status text default 'planning' check (status in ('planning', 'developing', 'testing', 'deployed', 'failed')) not null,
    outcomes_data jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

create policy "Usuarios autenticados pueden ver todos los proyectos"
    on public.projects for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden crear y modificar proyectos"
    on public.projects for all
    to authenticated
    using (true);

-- 4. Tabla del Chat Realtime (Humano-Agente y Humano-Humano)
create table public.chat_messages (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects on delete cascade, -- null significa chat general de la fábrica
    sender_id uuid references auth.users on delete set null,      -- null significa que el mensaje lo envió la IA
    sender_name text not null,                                    -- Nombre del humano o "Tairos Agent"
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.chat_messages enable row level security;

create policy "Usuarios autenticados pueden ver todos los mensajes"
    on public.chat_messages for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden insertar mensajes"
    on public.chat_messages for insert
    to authenticated
    with check (true);

-- 5. Tabla de la Cola de Tareas A2A (Para el Runner Local)
create table public.agent_tasks (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects on delete cascade not null,
    phase text check (phase in ('prp', 'database', 'api', 'frontend', 'qa', 'deploy')) not null,
    status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')) not null,
    logs jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_tasks enable row level security;

create policy "Usuarios autenticados pueden ver todas las tareas de agentes"
    on public.agent_tasks for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden actualizar y crear tareas"
    on public.agent_tasks for all
    to authenticated
    using (true);

-- 6. Tabla del Estado del Búnker Local (Runner)
create table if not exists public.runner_status (
    id text primary key,
    is_online boolean default true,
    cpu text,
    ram text,
    tasks_processed integer default 0,
    uptime text,
    last_heartbeat timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.runner_status enable row level security;

create policy "Cualquier usuario autenticado puede leer el estado del runner"
    on public.runner_status for select
    to authenticated
    using (true);

create policy "El runner puede insertar y actualizar su estado"
    on public.runner_status for all
    to anon, authenticated, service_role
    using (true);

-- 7. Tabla de Propuestas de Requisitos (PRPs)
create table if not exists public.prps (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects on delete cascade,
    title text not null,
    description text not null,
    sprint text,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.prps enable row level security;

create policy "Usuarios autenticados pueden ver todas las PRPs"
    on public.prps for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden crear y modificar PRPs"
    on public.prps for all
    to authenticated
    using (true);

-- 8. Tabla de Votos de PRP (Sistema Democrático)
create table if not exists public.prp_votes (
    id uuid default gen_random_uuid() primary key,
    prp_id uuid references public.prps on delete cascade not null,
    member_id uuid references auth.users on delete cascade not null,
    member_name text not null,
    vote text check (vote in ('approved', 'rejected', 'pending')) not null,
    voted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(prp_id, member_id)
);

alter table public.prp_votes enable row level security;

create policy "Usuarios autenticados pueden ver todos los votos"
    on public.prp_votes for select
    to authenticated
    using (true);

create policy "Usuarios pueden insertar y actualizar sus propios votos"
    on public.prp_votes for all
    to authenticated
    using (auth.uid() = member_id);

-- 9. Tabla de Eventos de Self-Healing
create table if not exists public.healing_events (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects on delete cascade,
    event_type text check (event_type in ('error', 'diagnosis', 'fix', 'success')) not null,
    title text not null,
    detail text,
    agent text,
    old_code text,
    new_code text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.healing_events enable row level security;

create policy "Usuarios autenticados pueden ver todos los eventos de healing"
    on public.healing_events for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden crear eventos de healing"
    on public.healing_events for insert
    to authenticated
    with check (true);

-- 10. Tabla de Configuración del Sistema
create table if not exists public.system_settings (
    id text primary key,
    settings jsonb default '{}'::jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_by uuid references auth.users on delete set null
);

alter table public.system_settings enable row level security;

create policy "Usuarios autenticados pueden ver la configuración"
    on public.system_settings for select
    to authenticated
    using (true);

create policy "Usuarios autenticados pueden actualizar la configuración"
    on public.system_settings for all
    to authenticated
    using (true);

-- 11. Habilitar la Publicación en Tiempo Real (Realtime) de Supabase
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table public.chat_messages, public.agent_tasks, public.runner_status, public.prps, public.prp_votes, public.healing_events;
commit;
