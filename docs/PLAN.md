# Health App — Implementation Plan

## Overview
A React Native (Expo) mobile app with a Node/Express + SQLite backend, covering four feature areas: fitness tracking, nutrition/diet logging, a wellness dashboard, and habit/medication tracking.

## Stack
- **Mobile**: React Native via Expo, TypeScript, React Navigation
- **Backend**: Node.js + Express, TypeScript
- **Database**: SQLite (via better-sqlite3 or Prisma+SQLite) — simple to run locally, upgradeable to Postgres later
- **Auth**: JWT-based email/password auth (single-user friendly, no third-party dependency)
- **State/data fetching**: React Query for API calls and caching

## Data Model (initial)
- `users` (id, email, password_hash, name, created_at)
- `workouts` (id, user_id, type, duration_min, calories, notes, date)
- `meals` (id, user_id, name, calories, protein, carbs, fat, date, meal_type)
- `metrics` (id, user_id, type [steps|sleep|water|weight|mood], value, unit, date) — powers the wellness dashboard
- `habits` (id, user_id, name, frequency, reminder_time, created_at)
- `habit_logs` (id, habit_id, date, completed)
- `medications` (id, user_id, name, dosage, schedule)
- `medication_logs` (id, medication_id, date, taken)

## API Surface (REST, versioned under /api/v1)
- `POST /auth/register`, `POST /auth/login`
- `GET/POST /workouts`, `GET/PUT/DELETE /workouts/:id`
- `GET/POST /meals`, `GET/PUT/DELETE /meals/:id`
- `GET/POST /metrics`
- `GET/POST /habits`, `POST /habits/:id/log`
- `GET/POST /medications`, `POST /medications/:id/log`
- `GET /dashboard/summary` — aggregated view for the home screen

## Mobile App Screens
1. **Auth**: Login / Register
2. **Dashboard (Home)**: today's summary — steps, water, sleep, calories, habit streaks, medication reminders
3. **Fitness**: workout list, add/edit workout, simple weekly chart
4. **Nutrition**: meal log (breakfast/lunch/dinner/snack), daily calorie/macro totals
5. **Habits & Meds**: checklist for today, streak view, medication schedule with taken/skipped toggle
6. **Profile/Settings**: user info, logout, units (metric/imperial)

## Repo Layout
```
/backend        Node/Express API + SQLite
  /src
    /routes
    /models
    /middleware (auth)
    server.ts
/mobile          Expo React Native app
  /src
    /screens
    /components
    /api (React Query hooks)
    /navigation
docs/PLAN.md    this file
```

## Build Order
1. Backend: scaffold Express + SQLite schema + auth (register/login/JWT middleware)
2. Backend: CRUD routes for workouts, meals, metrics, habits, medications + dashboard summary endpoint
3. Mobile: scaffold Expo app, navigation shell, auth screens wired to backend
4. Mobile: Dashboard screen consuming `/dashboard/summary`
5. Mobile: Fitness, Nutrition, Habits/Meds screens (CRUD forms + lists)
6. Polish: loading/error states, basic charts on dashboard, input validation on both ends
7. Tests: backend route tests (supertest), mobile component smoke tests

## Out of Scope (for now)
- Push notifications / reminders (medication schedule stored but not actively notified)
- Social features, wearable device sync, third-party nutrition database integration
- Deployment/hosting setup
