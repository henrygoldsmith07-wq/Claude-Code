# Omni-Life: Autonomous Personal Operating System - Phase 1

A comprehensive personal operating system that integrates multiple LLMs, external services, and automation loops to orchestrate your entire digital life.

## Overview

Omni-Life is a centralized orchestrator built on Vercel serverless functions that:

- **Integrates** with 12+ external services (Google Workspace, Strava, Stripe, Twilio, etc.)
- **Routes** tasks to specialized LLMs (Claude for reasoning, Gemini for scanning, ChatGPT for execution)
- **Automates** three core loops: Morning Alignment, Continuous Optimization, and Evening Reflection
- **Stores** all data securely in Supabase PostgreSQL with Row Level Security
- **Communicates** via WhatsApp for notifications and user commands
- **Provides** a dashboard for monitoring and configuration

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL) with RLS
- **Authentication**: Supabase Auth + OAuth2
- **LLMs**: Claude (Anthropic), Gemini (Google), ChatGPT (OpenAI)
- **Messaging**: Twilio WhatsApp API
- **Deployment**: Vercel

## Project Structure

```
omni-life/
├── .env.local.example          # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── middleware.ts               # Supabase auth middleware
├── vercel.json                 # Cron job definitions
├── README.md
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── login/
    │   │   └── page.tsx
    │   ├── settings/
    │   │   └── page.tsx
    │   ├── api/
    │   │   ├── auth/
    │   │   │   └── callback/route.ts
    │   │   ├── webhooks/
    │   │   │   ├── strava/route.ts
    │   │   │   ├── stripe/route.ts
    │   │   │   └── twilio/route.ts
    │   │   ├── cron/
    │   │   │   ├── morning-alignment/route.ts
    │   │   │   ├── continuous-optimization/route.ts
    │   │   │   └── evening-reflection/route.ts
    │   │   └── whatsapp/
    │   │       └── send/route.ts
    │   └── globals.css
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts
    │   │   ├── server.ts
    │   │   └── middleware.ts
    │   ├── llm/
    │   │   ├── router.ts
    │   │   ├── claude.ts
    │   │   ├── gemini.ts
    │   │   └── chatgpt.ts
    │   ├── services/
    │   │   ├── twilio.ts
    │   │   └── openweather.ts
    │   ├── encryption.ts
    │   └── utils.ts
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   └── card.tsx
    │   ├── dashboard/
    │   │   ├── overview.tsx
    │   │   ├── sidebar.tsx
    │   │   └── header.tsx
    │   └── auth/
    │       └── login-form.tsx
    └── types/
        └── index.ts
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account with PostgreSQL database
- Vercel account with existing deployment
- API keys for: Twilio, OpenAI, Anthropic, Google, Stripe, Strava, OpenWeather

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd omni-life
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys and configuration
```

4. Set up Supabase database:
```bash
# Run the migration in supabase/migrations/001_initial_schema.sql
# via Supabase dashboard or CLI
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Database Schema

The system uses 10 core tables:

- **users**: User profiles and OAuth tokens (encrypted)
- **user_credentials**: Encrypted API keys and OAuth tokens for external services
- **automation_logs**: Execution logs for the three automation loops
- **calendar_events**: Synced events from Google Calendar and Outlook
- **health_metrics**: Fitness and health data from Strava, Hevy, Google Fit
- **financial_transactions**: Income and payouts from Stripe and Upwork
- **knowledge_items**: Notes and knowledge from Google Keep, NotebookLM
- **notifications**: Sent notifications via WhatsApp and other channels
- **tasks**: Tasks from Google Tasks and other sources
- **media_listening_history**: Listening history from Spotify and podcasts
- **settings**: User-specific configuration and preferences

All tables have Row Level Security enabled to ensure users can only access their own data.

## API Routes

### Authentication
- `POST /api/auth/callback` - OAuth callback handler

### Webhooks
- `POST /api/webhooks/twilio` - Twilio WhatsApp incoming messages
- `POST /api/webhooks/strava` - Strava activity events
- `POST /api/webhooks/stripe` - Stripe payment events

### Cron Jobs (Vercel)
- `GET /api/cron/morning-alignment` - Daily at 7:00 AM
- `GET /api/cron/continuous-optimization` - Every hour
- `GET /api/cron/evening-reflection` - Daily at 9:00 PM

### WhatsApp
- `POST /api/whatsapp/send` - Send WhatsApp messages

## LLM Router

The system implements intelligent routing to specialized LLMs:

- **Claude (Anthropic)**: Complex reasoning, analysis, and reflection
- **Gemini (Google)**: Context scanning, rapid analysis, and data extraction
- **ChatGPT (OpenAI)**: Execution, formatting, and structured output generation

Tasks are routed based on their type:
- `reasoning`: → Claude
- `context_scanning`: → Gemini
- `execution`: → ChatGPT

## Automation Loops

### 1. Morning Alignment (7:00 AM)
Gathers weather, calendar, messages, and health data, then sends a personalized briefing via WhatsApp.

### 2. Continuous Optimization (Hourly)
Processes financial transactions, monitors task status, and optimizes workflows based on real-time data.

### 3. Evening Reflection (9:00 PM)
Analyzes the day's activities, generates insights, and prepares recommendations for tomorrow.

## Security

- All sensitive data (API keys, OAuth tokens) is encrypted at rest
- Row Level Security (RLS) enforced on all database tables
- Supabase Auth handles user authentication
- Environment variables stored securely in Vercel
- HTTPS enforced for all communications

## Deployment

### Deploy to Vercel

1. Push to GitHub:
```bash
git push origin main
```

2. Connect repository to Vercel:
- Go to https://vercel.com/new
- Select your GitHub repository
- Add environment variables from `.env.local`
- Deploy

3. Configure cron jobs:
- Vercel automatically reads `vercel.json` and sets up cron jobs
- Verify in Vercel dashboard under "Cron Jobs"

## Development

### Running Tests
```bash
npm run test
```

### Type Checking
```bash
npm run type-check
```

### Building for Production
```bash
npm run build
npm run start
```

## Contributing

This is Phase 1 of the Omni-Life system. Future phases will include:
- Phase 2: Advanced automation and workflow optimization
- Phase 3: Multi-user collaboration and team features
- Phase 4: Mobile app and native integrations

## License

MIT

## Support

For issues and questions, please open an issue in the repository.
