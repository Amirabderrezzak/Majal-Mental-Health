import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Routes
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Majal Backend is running!' });
});

// Diagnostic endpoint — tests env variables and Supabase connection
app.get('/api/debug', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {
    env: {
      SUPABASE_URL:              !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY:         !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      FRONTEND_URL:              process.env.FRONTEND_URL || '(not set)',
      PORT:                      process.env.PORT || '(not set)',
    },
    supabase: 'not tested',
  };

  try {
    const { data, error } = await supabase.from('profiles').select('user_id').limit(1);
    checks.supabase = error ? `ERROR: ${error.message}` : 'OK — connected successfully';
  } catch (e: any) {
    checks.supabase = `EXCEPTION: ${e.message}`;
  }

  res.json(checks);
});

// NOTE: All admin data access is handled via Supabase RLS directly from the frontend.
// No unprotected profile dump routes should exist here.


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
