import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import {
  getStats,
  getAllUsers,
  updateUserStatus,
  grantAdmin,
  getAllBookings,
  getAllReviews,
  deleteReview,
} from '../controllers/adminController';

const router = Router();

// All routes below require a valid admin JWT
router.use(adminAuth);

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/grant-admin', grantAdmin);
router.get('/bookings', getAllBookings);
router.get('/reviews', getAllReviews);
router.delete('/reviews/:id', deleteReview);

export default router;
