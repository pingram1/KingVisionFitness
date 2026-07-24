import express, { Router } from 'express';
import { auth } from '../middleware/auth';

const router: Router = express.Router();

const NOT_IMPLEMENTED = {
  success: false,
  message: 'Messaging is not yet implemented.',
};

// @route   GET /api/messages
// @desc    Deprecated stub — messaging not yet implemented
// @access  Private
router.get('/', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// @route   POST /api/messages
// @desc    Deprecated stub — messaging not yet implemented
// @access  Private
router.post('/', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// @route   GET /api/messages/:userId
// @desc    Deprecated stub — messaging not yet implemented
// @access  Private
router.get('/:userId', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

export default router;
