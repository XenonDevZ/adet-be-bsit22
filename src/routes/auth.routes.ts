import { Hono } from 'hono'
import { googleAuth, getMe } from '../controllers/auth.controller.js'
import { authMiddleware } from '../middleware/auth.js'

export const authRoutes = new Hono()

// Public
authRoutes.post('/google', googleAuth)

// Protected
authRoutes.get('/me', authMiddleware, getMe)