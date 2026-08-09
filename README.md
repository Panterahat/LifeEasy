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
