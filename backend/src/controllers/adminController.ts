import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      { count: totalPatients },
      { count: totalTherapists },
      { count: pendingTherapists },
      { count: totalBookings },
      { count: confirmedBookings },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'patient'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'psychologue'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'psychologue').eq('approval_status', 'pending'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]);

    // Revenue: sum price of all confirmed bookings
    const { data: revenueData } = await supabase
      .from('bookings')
      .select('price')
      .eq('status', 'confirmed');
    const totalRevenue = revenueData?.reduce((acc, b) => acc + (b.price || 0), 0) ?? 0;

    res.json({
      totalPatients,
      totalTherapists,
      pendingTherapists,
      totalBookings,
      confirmedBookings,
      totalRevenue,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, user_type, approval_status, is_admin, created_at, city, specialty')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch emails from auth.users via the admin API
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(authUsers?.users.map(u => [u.id, u.email]));

    const users = data?.map(p => ({
      ...p,
      email: emailMap.get(p.user_id) || '',
    }));

    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /api/admin/users/:id/status ────────────────────────────────────────
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { approval_status } = req.body; // 'approved' | 'rejected' | 'pending'

    if (!['approved', 'rejected', 'pending'].includes(approval_status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ approval_status })
      .eq('user_id', id);

    if (error) throw error;
    res.json({ message: `User status updated to ${approval_status}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /api/admin/users/:id/grant-admin ───────────────────────────────────
export const grantAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body; // true | false

    const { error } = await supabase
      .from('profiles')
      .update({ is_admin })
      .eq('user_id', id);

    if (error) throw error;
    res.json({ message: `Admin privileges ${is_admin ? 'granted' : 'revoked'}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/admin/bookings ───────────────────────────────────────────────────
export const getAllBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booked_at, status, duration_minutes, price, patient_id, psychologist_id, created_at')
      .order('booked_at', { ascending: false });

    if (error) throw error;

    // Enrich with names from profiles
    const userIds = [...new Set([...(data?.map(b => b.patient_id) ?? []), ...(data?.map(b => b.psychologist_id) ?? [])])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));

    const bookings = data?.map(b => ({
      ...b,
      patient_name: nameMap.get(b.patient_id) || 'Patient',
      psychologist_name: nameMap.get(b.psychologist_id) || 'Thérapeute',
    }));

    res.json({ bookings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/admin/reviews ────────────────────────────────────────────────────
export const getAllReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, patient_id, psychologist_id')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = [...new Set([...(data?.map(r => r.patient_id) ?? []), ...(data?.map(r => r.psychologist_id) ?? [])])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));

    const reviews = data?.map(r => ({
      ...r,
      patient_name: nameMap.get(r.patient_id) || 'Patient',
      psychologist_name: nameMap.get(r.psychologist_id) || 'Thérapeute',
    }));

    res.json({ reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/admin/reviews/:id ────────────────────────────────────────────
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Review deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
