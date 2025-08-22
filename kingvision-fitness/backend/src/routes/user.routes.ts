import express from 'express';
import { auth } from '../middleware/auth';

const router = express.Router();

// GET /api/users/profile
router.get('/profile', auth, async (req: any, res: any) => {
  res.json({
    success: true,
    data: req.user
  });
});

// PUT /api/users/profile
router.put('/profile', auth, async (req: any, res: any) => {
  // TODO: Implement profile update
  res.json({ success: true, message: 'Profile update endpoint' });
});

export default router;