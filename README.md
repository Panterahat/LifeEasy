# 🕰️ Life Easy

I got tired of having five different apps open just to run my day — one for tasks, one for expenses, one for notes, one for counting things I'm trying to build habits around. Life Easy is my attempt to put all of that in one place, wrapped in a fullscreen dashboard that doesn't feel like a spreadsheet.

It started as a personal project and has slowly grown into something I actually rely on daily. It's a vanilla JS web app under the hood, packaged into an Android APK with a WebView wrapper, and everything syncs to Supabase so I'm not locked into one phone.

## ✨ What's in it

- **Tasks** — the usual: add, prioritize, check off, filter by status.
- **Planner** — a real calendar view, not just a list. Jump to any date and see what's on it.
- **Money & Expenses** — multiple accounts, per-transaction logging, category breakdowns, and running balances calculated from your actual transaction history (not just a number you have to update by hand).
- **Counters** — tally trackers for habits or anything you want to count. Tap up, tap down.
- **Alarms** — with system notifications, so they actually go off.
- **Roadmaps** — break a big goal into steps and watch the progress bar move.
- **Attendance & Academic tracking** — built this for myself as a student: class routines, attendance logs, and academic records in one spot.
- **Notes** — a Google Keep–style board: colors, checklists, pinning, tags, the works.
- **Sleep tracker** — log your sleep and see a simple bar chart of recent nights against an "ideal" line.
- **Vault** — drag-and-drop file storage for stuff you want quick access to without digging through your phone's file manager.
- **Customizable dashboard** — the home screen is made of widgets you can show, hide, and reorder, including ones you can pin to a specific account, counter, or note.
- **Dark and light themes** — because staring at a bright white dashboard at 1am is not it.
AI ROUTINE SYNC FROM PDF

## ☁️ How the sync works

Everything writes to local storage first, so the app never feels like it's waiting on a network request. In the background, changes queue up and push to Supabase — and if you're offline, they just sit in a queue and retry automatically once you're back online (there's a small badge that shows up when something's pending). It's not fancy, but it means I can add an expense in a spotty-signal elevator and not lose it.

## 📥 Installing it

**On Android:**
1. Grab the latest `LifeEasy.apk` from the [Releases](../../releases) page.
2. Open it on your device and tap Install (you'll need to allow installs from unknown sources if you haven't already).

**In a browser:**
Just open nightfury.raverahat.workers.dev


## 🛠️ Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript. No React, no build tooling — just files you can open and read.
- **Backend:** [Supabase](https://supabase.com) for Postgres + auth.
- **Sync:** Offline-first, local-storage-backed queue with retry logic for spotty connections.
- **Android wrapper:** A native WebView shell (Kotlin/Java) that packages the web app as a standalone APK.

## 🚧 Status

Still actively being worked on. It's my daily driver, so most changes come from "this annoyed me yesterday" rather than a formal roadmap. Expect rough edges here and there.
(any suggestions would be looked into)





Agent:  
> Thought  
> **Crafting the Setup Guide**  
>   
> I'm currently structuring a beginner's setup guide. It involves step-by-step instructions on creating a free Supabase project and importing the SQL schema, ensuring complete table and Row setup.  
>   
>   
>   
Here is a complete, beginner-friendly **Setup & Configuration Guide** that you can share with anyone who wants to use **Life Easy** with their own free Supabase cloud database backend.

---

# 🚀 Life Easy — Complete Setup Guide

This guide will walk you through setting up your own free cloud database on **Supabase** and linking it to the **Life Easy** app in less than 5 minutes.

---

## 📌 Step 1: Create a Free Supabase Project

1. Go to [supabase.com](https://supabase.com) and click **Sign Up** (or log in with GitHub).
2. Click **New Project**.
3. Fill in your project details:
   - **Name**: `LifeEasy` (or any name you like)
   - **Database Password**: Create a password and keep it safe.
   - **Region**: Choose the region closest to you (e.g., *Singapore*, *Frankfurt*, *US East*).
   - **Pricing Plan**: Select the **Free Tier ($0/month)**.
4. Click **Create new project** and wait ~1 minute for Supabase to set up your database.

---

## 📌 Step 2: Run the SQL Database Setup

1. In your Supabase dashboard sidebar, click **SQL Editor** (icon: `>_`).
2. Click **+ New Query**.
3. Paste the entire SQL script below into the query editor:

```sql
-- =====================================================================
-- LIFE EASY — COMPLETE DATABASE & RLS POLICIES SETUP
-- =====================================================================

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- 2. USER SETTINGS
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'light',
  nav_layout_mode text NOT NULL DEFAULT 'bottom',
  planner_view text NOT NULL DEFAULT 'monthly',
  nav_preferences jsonb NOT NULL DEFAULT '["dash", "planner", "tasks", "counter", "money", "alarms", "roadmap", "attendance", "academic", "links", "vault", "expenses", "notes", "sleep", "tabs", "settings"]'::jsonb,
  hidden_nav_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  dash_widgets jsonb NOT NULL DEFAULT '["pending_tasks", "todays_events", "net_money", "active_counters", "redzone", "schedule", "classes", "tasks"]'::jsonb,
  dash_hidden_widgets jsonb NOT NULL DEFAULT '["alarms", "sleep", "roadmap", "specific_account", "specific_counter", "specific_note"]'::jsonb,
  dash_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  task_filter text NOT NULL DEFAULT 'active',
  money_filter text NOT NULL DEFAULT 'pending',
  task_categories jsonb NOT NULL DEFAULT '["Work", "Personal"]'::jsonb,
  event_categories jsonb NOT NULL DEFAULT '["Personal", "Work", "Academic"]'::jsonb,
  hidden_note_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_link_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  notifications_enabled boolean NOT NULL DEFAULT true,
  default_reminder text NOT NULL DEFAULT 'none',
  timezone text,
  locale text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- 3. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  task_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  priority integer DEFAULT 0,
  due_date date,
  reminder timestamp with time zone,
  completed boolean NOT NULL DEFAULT false,
  reminder_opt text,
  custom_reminder_time text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- 4. COUNTERS
CREATE TABLE IF NOT EXISTS public.counters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  step integer DEFAULT 1,
  value integer DEFAULT 0,
  color text,
  last_updated text,
  history jsonb,
  target numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own counters" ON public.counters FOR ALL USING (auth.uid() = user_id);

-- 5. PLANS / EVENTS
CREATE TABLE IF NOT EXISTS public.plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  desc text,
  date text,
  time text,
  end_time text DEFAULT '09:30',
  color text,
  category text DEFAULT 'Personal',
  duration text DEFAULT '30m',
  recurrence text DEFAULT 'none',
  repeat_days jsonb,
  reminder text DEFAULT 'none',
  custom_reminder_time text,
  completed boolean DEFAULT false,
  excluded_dates jsonb DEFAULT '[]'::jsonb,
  completed_dates jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON public.plans FOR ALL USING (auth.uid() = user_id);

-- 6. MONEY RECORDS
CREATE TABLE IF NOT EXISTS public.money (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person text NOT NULL,
  amount numeric NOT NULL,
  type text CHECK (type = ANY (ARRAY['lent'::text, 'borrowed'::text])),
  note text,
  due text,
  settled boolean DEFAULT false,
  reminder text,
  custom_reminder_time text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.money ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own money" ON public.money FOR ALL USING (auth.uid() = user_id);

-- 7. ALARMS
CREATE TABLE IF NOT EXISTS public.alarms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  time text,
  hour integer,
  minute integer,
  label text,
  days text,
  enabled boolean DEFAULT true,
  once_at bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alarms" ON public.alarms FOR ALL USING (auth.uid() = user_id);

-- 8. ROADMAPS & STEPS
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  desc text,
  category text,
  target text,
  color text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own roadmaps" ON public.roadmaps FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.steps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roadmap_id bigint REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  desc text,
  date text,
  "order" integer,
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own steps" ON public.steps FOR ALL USING (auth.uid() = user_id);

-- 9. ACADEMIC / EXAMS
CREATE TABLE IF NOT EXISTS public.academic (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  type text,
  date text,
  topic text,
  desc text,
  note text,
  time text,
  room text,
  reminder text,
  custom_reminder_time text,
  title text,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.academic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own academic" ON public.academic FOR ALL USING (auth.uid() = user_id);

-- 10. ACCOUNTS & EXPENSES
CREATE TABLE IF NOT EXISTS public.accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  balance numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  category text,
  note text,
  date text,
  time text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);

-- 11. NOTES
CREATE TABLE IF NOT EXISTS public.notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text,
  checklist jsonb,
  tags jsonb,
  color text,
  pinned boolean DEFAULT false,
  archived boolean DEFAULT false,
  trashed boolean DEFAULT false,
  is_whiteboard boolean DEFAULT false,
  wb_data jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);

-- 12. SLEEP LOGS
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date,
  bedtime text,
  wake_time text,
  duration_mins integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sleep" ON public.sleep_logs FOR ALL USING (auth.uid() = user_id);

-- 13. ATTENDANCE ROUTINES & LOGS
CREATE TABLE IF NOT EXISTS public.attendance_routines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  room text,
  start_time text,
  end_time text,
  day_of_week integer,
  reminder text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own routines" ON public.attendance_routines FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id bigint REFERENCES public.attendance_routines(id) ON DELETE CASCADE,
  date text,
  status text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attendance logs" ON public.attendance_logs FOR ALL USING (auth.uid() = user_id);

-- 14. VAULT FOLDERS & FILES
CREATE TABLE IF NOT EXISTS public.vault_folders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#7c6ef5',
  parent_id bigint REFERENCES public.vault_folders(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vault folders" ON public.vault_folders FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.vault (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text,
  filepath text,
  folder_id bigint REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  name text,
  type text,
  size bigint DEFAULT 0,
  url text,
  upload_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vault files" ON public.vault FOR ALL USING (auth.uid() = user_id);

-- 15. BOOKMARKS / LINKS
CREATE TABLE IF NOT EXISTS public.links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  url text NOT NULL,
  thumbnail text,
  category text,
  note text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own links" ON public.links FOR ALL USING (auth.uid() = user_id);

-- 16. TAGS
CREATE TABLE IF NOT EXISTS public.tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'note',
  color text,
  is_hidden boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON public.tags FOR ALL USING (auth.uid() = user_id);

-- 17. COVER TEMPLATES & DAILY REMINDERS
CREATE TABLE IF NOT EXISTS public.cover_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  bg_data text,
  fields jsonb,
  name text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.cover_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cover templates" ON public.cover_templates FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_reminders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  time text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.daily_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily reminders" ON public.daily_reminders FOR ALL USING (auth.uid() = user_id);

-- =====================================================================
-- SUCCESS! ALL TABLES & SECURITY POLICIES ARE CREATED.
-- =====================================================================
```

4. Click **Run** (or press `Ctrl + Enter`). You should see `"Success. No rows returned"`.

---

## 📌 Step 3: Get Your API Credentials

1. In your Supabase dashboard sidebar, click **Project Settings** (gear icon ⚙️ at the bottom left).
2. Click **API**.
3. Under **Project API keys**, copy these two values:
   - **Project URL**: e.g. `https://xxxxxxxxx.supabase.co`
   - **`anon` `public` key**: e.g. `eyJhbGciOiJIUzI1NiI...`

---

## 📌 Step 4: Connect Your Credentials in Life Easy

1. Open **Life Easy** (on Web or Android).
2. Go to **Settings** ⚙️ → **AI & Cloud API Credentials**.
3. Paste your copied credentials:
   - **Supabase URL**: Paste your Project URL.
   - **Supabase Anon Key**: Paste your `anon` `public` key.
4. Click **💾 Save Credentials**.
5. Done! Your app is now connected to your personal cloud backend with auto-sync enabled.

---

## 📌 Step 5: Add a Free Groq AI Key (Optional)

To enable the AI Assistant (Voice & Text parsing for schedule creation, tasks, and notes):

1. Go to [console.groq.com](https://console.groq.com) and create a free account.
2. Go to **API Keys** and click **Create API Key**.
3. Copy your API key (starts with `gsk_...`).
4. In **Life Easy**, go to **Settings** ⚙️ → **AI & Cloud API Credentials**, paste it into **Groq API Key**, and click **Save Credentials**.
