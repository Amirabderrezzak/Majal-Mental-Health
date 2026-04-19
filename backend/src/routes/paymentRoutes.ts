import { Router } from 'express';
import { createPaymentSession, paymentWebhook } from '../controllers/paymentController';

const router = Router();

// Route called by frontend to generate a checkout session
router.post('/checkout', createPaymentSession);

// Route called by Payment Gateway after successful payment
router.post('/webhook', paymentWebhook);

export default router;
