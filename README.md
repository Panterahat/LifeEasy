# 🕰️ Life Easy — Personal Productivity Dashboard

Life Easy (aka ProFlow) is a fullscreen, all-in-one productivity dashboard built as a web app and packaged for Android. It brings together task management, expense tracking, planning, and more into a single glanceable interface — with your data synced to the cloud so it's never tied to one device.

## ✨ Features

* **Smart Task Manager** — Track and organize high-priority tasks with reminders.
* **Planner & Calendar** — A dedicated calendar view for scheduling and jumping to specific dates.
* **Money & Expense Tracking** — Manage accounts, log expenses, and track lent/borrowed money with automatic balance calculations.
* **Counters** — Simple tally/counter tracking for habits or recurring events.
* **Alarms** — Set alarms with system notification support.
* **Roadmaps** — Break down long-term goals into steps and track progress.
* **Attendance & Academic Tracking** — Built for students: track class attendance and academic records.
* **Personal Vault** — Drag-and-drop file storage for quick access to personal files.
* **Cloud Sync (Offline-First)** — Powered by Supabase. Changes save locally instantly and sync to the cloud in the background, with automatic retry queuing when you're offline.
* **Multiple Themes** — Switch between dark and light themes.
* **Account System** — Sign up / sign in to keep your data synced across devices.

## 📥 Download & Install

You do not need to build this from source to use it on Android.

1. Go to the [Releases](../../releases) page.
2. Download the latest `LifeEasy.apk` file.
3. Open the file on your Android device and tap **Install** (if prompted, allow installations from "Unknown Sources").

You can also run it directly as a web app in any modern browser — just open `index.html`.

## 📸 Screenshots

<p align="center">
  <img src="link_to_dashboard_screenshot.jpg" width="300" />
  <img src="link_to_planner_screenshot.jpg" width="300" />
</p>

## 🛠️ Tech Stack

* **Frontend:** Native HTML5, CSS3, and Vanilla JavaScript (no frameworks).
* **Backend:** [Supabase](https://supabase.com) (Postgres database + auth) for cloud sync.
* **Sync Architecture:** Offline-first — a local-storage-backed sync queue with automatic retries handles connectivity gaps and keeps the UI responsive even without a network connection.
* **Android Wrapper:** Native Android WebView (Kotlin/Java) packaging the web app as a standalone APK.
* **Architecture:** Modular single-page application (SPA) design using direct DOM manipulation — no build step required.

## 🚧 Project Status

This project is under active development. Some previously included features (Notes and Sleep Log) have been removed in the current version and may return in a future update.
