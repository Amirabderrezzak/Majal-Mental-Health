import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Require a secret token to access this debug endpoint
  const secret = process.env.DEBUG_SECRET;
  const provided = req.headers['x-debug-secret'] || req.query?.secret;

  if (!secret || provided !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const checks: Record<string, any> = {
    env: {
      SUPABASE_URL:              !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      VITE_SUPABASE_PUBLISHABLE_KEY: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    supabase: 'not tested',
  };

  try {
    const { error } = await supabase.from('profiles').select('user_id').limit(1);
    checks.supabase = error ? `ERROR: ${error.message}` : 'OK — connected successfully';
  } catch (e: any) {
    checks.supabase = `EXCEPTION: ${e.message}`;
  }

  res.json(checks);
}
