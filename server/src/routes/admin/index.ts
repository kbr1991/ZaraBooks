import { Router } from 'express';
import dashboardRoutes from './dashboard';
import tenantsRoutes from './tenants';
import partnersRoutes from './partners';
import subscriptionsRoutes from './subscriptions';
import commissionsRoutes from './commissions';
import payoutsRoutes from './payouts';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/tenants', tenantsRoutes);
router.use('/partners', partnersRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/commissions', commissionsRoutes);
router.use('/payouts', payoutsRoutes);

export default router;
