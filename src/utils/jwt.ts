import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { JwtPayload } from '../types/index.js'

const EXPIRES_IN = '24h'

export const signJwt = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export const verifyJwt = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload
  } catch {
    return null
  }
}
