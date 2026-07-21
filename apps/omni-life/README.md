# Omni-Life: Autonomous Personal Operating System

A comprehensive personal operating system that integrates multiple LLMs, external services, and automation loops to orchestrate your entire digital life.

## Overview

Omni-Life is a centralized orchestrator built on Vercel serverless functions that:

- **Integrates** with 12+ external services (Google Workspace, Strava, Stripe, Twilio, etc.)
- **Routes** tasks to specialized LLMs (Claude for reasoning, Gemini for scanning, ChatGPT for execution)
- **Automates** three core loops: Morning Alignment, Continuous Optimization, and Evening Reflection
- **Stores** all data securely in Supabase PostgreSQL with Row Level Security
- **Communicates** via WhatsApp for notifications and user commands
- **Provides** a dark-theme command-center dashboard (mobile-friendly sidebar, refresh, error states)

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL) with RLS
- **Authentication**: Supabase Auth + OAuth2
- **LLMs**: Claude (Anthropic), Gemini (Google), ChatGPT (OpenAI)
- **Messaging**: Twilio WhatsApp API
- **Deployment**: Vercel

## Dashboard UX (recent polish)

- Consistent dark theme across header, sidebar, and cards
- Mobile drawer navigation with backdrop
- Skeleton loading + retry on dashboard fetch errors
- Manual refresh for live data
- Inline save feedback on settings (no browser alerts)
- Safer empty states for tasks and notifications

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account with PostgreSQL database
- Vercel account with existing deployment
- API keys for: Twilio, OpenAI, Anthropic, Google, Stripe, Strava, OpenWeather

### Installation

```bash
cd apps/omni-life
npm install
cp .env.example .env.local   # fill in keys
# Run supabase/migrations/001_initial_schema.sql
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Automation Loops

1. **Morning Alignment (7:00 AM)** — weather, calendar, messages, health → WhatsApp briefing
2. **Continuous Optimization (Hourly)** — finance, tasks, workflow checks
3. **Evening Reflection (9:00 PM)** — day insights and tomorrow recommendations

## Security

- Sensitive tokens encrypted at rest
- RLS on all tables
- Supabase Auth for identity
- Secrets only in Vercel env / `.env.local`

## License

MIT
