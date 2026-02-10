import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import clientsRoutes from './clients';
import commissionsRoutes from './commissions';
import payoutsRoutes from './payouts';
import teamRoutes from './team';

const router = Router();

// Public routes (no auth required)
router.use('/auth', authRoutes);

// Protected routes (require partner context)
router.use('/dashboard', dashboardRoutes);
router.use('/clients', clientsRoutes);
router.use('/commissions', commissionsRoutes);
router.use('/payouts', payoutsRoutes);
router.use('/team', teamRoutes);

export default router;
