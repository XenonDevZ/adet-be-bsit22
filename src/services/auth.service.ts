import { env } from '../config/env.js'

interface GoogleTokenInfo {
  sub: string
  email: string
  name: string
  picture: string
  aud: string
  email_verified: string
}

export const verifyGoogleToken = async (idToken: string): Promise<GoogleTokenInfo> => {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  )

  if (!res.ok) {
    throw new Error('Google token verification failed')
  }

  const data = (await res.json()) as GoogleTokenInfo

  // Verify the token was issued for our app
  if (data.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch — possible token hijack attempt')
  }

  if (data.email_verified !== 'true') {
    throw new Error('Google email is not verified')
  }

  return data
}