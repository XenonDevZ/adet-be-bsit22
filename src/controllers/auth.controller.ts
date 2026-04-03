import type { Context } from 'hono'
import * as authService from '../services/auth.service.js'
import * as usersService from '../services/users.service.js'
import { signJwt } from '../utils/jwt.js'
import { ok, err } from '../utils/response.js'

// POST /auth/google
export const googleAuth = async (c: Context) => {
  try {
    const { idToken } = await c.req.json()

    if (!idToken) {
      return c.json(err('idToken is required'), 400)
    }

    // 1. Verify with Google
    const gUser = await authService.verifyGoogleToken(idToken)

    // 2. Domain restriction — @liceo.edu.ph only
    if (!gUser.email.endsWith('@liceo.edu.ph')) {
      return c.json(
        err('Access restricted to @liceo.edu.ph accounts', 'DOMAIN_RESTRICTED'),
        403
      )
    }

    // 3. Find or create user
    let user = await usersService.findByEmail(gUser.email)

    if (!user) {
      user = await usersService.create({
        google_id: gUser.sub,
        email:     gUser.email,
        name:      gUser.name,
        picture:   gUser.picture,
        role:      'STUDENT',
      })
    }

    // 4. Sign JWT
    const token = signJwt({
      sub:     user.id,
      email:   user.email,
      name:    user.name,
      picture: user.picture,
      role:    user.role,
    })

    return c.json(ok({
      token,
      user: {
        id:      user.id,
        email:   user.email,
        name:    user.name,
        picture: user.picture,
        role:    user.role,
      }
    }))
  } catch (e: any) {
    console.error('[googleAuth]', e.message)
    return c.json(err(e.message || 'Authentication failed'), 401)
  }
}

// GET /me
export const getMe = async (c: Context) => {
  const jwtUser = c.get('user')
  const user = await usersService.findById(jwtUser.sub)
  if (!user) return c.json(err('User not found'), 404)

  return c.json(ok({
    id:         user.id,
    email:      user.email,
    name:       user.name,
    picture:    user.picture,
    role:       user.role,
    created_at: user.created_at,
  }))
}