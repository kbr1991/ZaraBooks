import { Router } from 'express';
import dashboardRoutes from './dashboard';
import companiesRoutes from './companies';
import usersRoutes from './users';
import subscriptionRoutes from './subscription';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/companies', companiesRoutes);
router.use('/users', usersRoutes);
router.use('/subscription', subscriptionRoutes);

export default router;
