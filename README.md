# ✧ LUCENT
### High-Performance, Real-Time Messaging redefined.

Lucent is a modern, production-grade messaging platform built for speed, reliability, and precision. It features a backend-authoritative delivery system that ensures your message status is always accurate, across all devices.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-purple.svg)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat&logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)

---

## 🚀 Key Features

- **Backend-Authoritative Delivery**: A strict state machine (`sending` → `sent` → `delivered` → `read`) where the backend is the single source of truth. No client-side guesswork.
- **Real-Time Synergy**: Powered by WebSockets and Redis Pub/Sub for sub-100ms message delivery.
- **Obsidian Design System**: A premium, layered dark mode UI following "Liquid Glass" physics, built with Tailwind CSS and shadcn/ui.
- **Mobile First**: Optimized for iOS Safari and Android Chrome, featuring gesture-safe interactions and robust life-cycle handling.
- **Reliability Core**: Explicit timestamp tracking for every message state, ensuring data integrity even after hard reloads or network drops.

## 🛠 Tech Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, Framer Motion, Zustand.
- **Backend**: Fastify, Node.js, PostgreSQL, Redis.
- **Infrastructure**: Turborepo (Monorepo architecture), Docker Support.

## 📦 Project Structure

```text
├── apps
│   ├── web          # React frontend (Vite)
│   └── server       # Fastify backend
├── packages
│   └── shared       # Unified types and protocols
```

## 🚥 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/thealbinantony7/messaging-app.git
   cd messaging-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Configure `.env` files in `apps/server` and `apps/web`.

4. **Run Database Migrations**
   ```bash
   psql -d lucent -f apps/server/src/db/schema.sql
   ```

5. **Start Development Mode**
   ```bash
   npm run dev
   ```

## 🛡 License
Licensed under the MIT License. Built with ❤️ by Albin Antony.

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| ⚡ **Lines of Code** | **504,423** |
| 📁 **Total Files** | 24,924 |
| ⏱️ **Dev Time** | 1 Day, 6 Hours |
| 🚀 **Total Commits** | 68 |
| 📦 **Project Size** | 182.5 MB |

*More detailed metrics can be found in [PROJECT_STATS.md](./PROJECT_STATS.md)*

