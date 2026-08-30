-- =========================================================
-- Ops Hub Supabase Database Schema & Realtime Setup
-- =========================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'Ops Specialist',
  department TEXT,
  status TEXT DEFAULT 'online',
  initials TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Spaces Table
CREATE TABLE IF NOT EXISTS public.spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Folder',
  color TEXT DEFAULT '#6366f1',
  description TEXT,
  statuses JSONB DEFAULT '[]'::jsonb,
  folders JSONB DEFAULT '[]'::jsonb,
  lists JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'normal',
  space_id TEXT NOT NULL,
  folder_id TEXT,
  list_id TEXT NOT NULL,
  assignee_ids JSONB DEFAULT '[]'::jsonb,
  due_date DATE,
  start_date DATE,
  estimated_hours NUMERIC DEFAULT 0,
  subtasks JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  time_logs JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  activity_logs JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SOP Documents (Knowledge Base) Table
CREATE TABLE IF NOT EXISTS public.sop_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  space_id TEXT,
  content TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  version TEXT DEFAULT '1.0',
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Automation Rules Table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,
  trigger_value TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT TRUE,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Clients & Vendors Directory Table
CREATE TABLE IF NOT EXISTS public.clients_vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'client',
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  sla_tier TEXT DEFAULT 'Standard',
  status TEXT DEFAULT 'active',
  active_contracts INTEGER DEFAULT 1,
  monthly_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable Realtime Publications for instant team sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_documents;

-- 9. Enable Row Level Security (RLS) & Public access policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_vendors ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all users (anon key access)
CREATE POLICY "Allow public read-write for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spaces" ON public.spaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for sop_documents" ON public.sop_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for automation_rules" ON public.automation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for clients_vendors" ON public.clients_vendors FOR ALL USING (true) WITH CHECK (true);
