# Majal — Votre espace de santé mentale

Majal is an Algerian mental health platform connecting patients with licensed psychologists for online therapy sessions.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Backend:** Vercel Serverless Functions
- **Database & Auth:** Supabase (PostgreSQL + RLS)
- **Realtime:** Supabase Realtime (chat)
- **Video:** Agora RTC
- **Payments:** Sofizpay (CIB)

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
  pages/        # Route-level components
  components/   # Shared UI components
  contexts/     # Auth & language context
  hooks/        # Custom React hooks
  integrations/ # Supabase client
  data/         # Static fallback data
  services/     # Service layer (chat, etc.)
api/            # Vercel serverless functions
supabase/       # DB migrations
```
