import { Router } from 'express';
import { CompaniesController } from '../controllers/companiesController';
import { authGuard } from '../middlewares/auth';
import { generalRateLimit } from '../middlewares';

const router = Router();
const companiesController = new CompaniesController();

// Dev or Admin middleware
const devOrAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  
  // In development, allow all authenticated users
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // In production, require admin role
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// All routes require authentication + devOrAdmin check
router.post(
  '/',
  authGuard,
  devOrAdmin,
  generalRateLimit,
  companiesController.createCompany.bind(companiesController)
);

router.get(
  '/',
  authGuard,
  devOrAdmin,
  companiesController.listCompanies.bind(companiesController)
);

router.get(
  '/:id',
  authGuard,
  devOrAdmin,
  companiesController.getCompany.bind(companiesController)
);

router.patch(
  '/:id',
  authGuard,
  devOrAdmin,
  generalRateLimit,
  companiesController.updateCompany.bind(companiesController)
);

router.delete(
  '/:id',
  authGuard,
  devOrAdmin,
  generalRateLimit,
  companiesController.deleteCompany.bind(companiesController)
);

export default router;

