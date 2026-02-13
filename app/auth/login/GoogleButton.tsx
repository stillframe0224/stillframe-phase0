'use client'

import { createClient } from '@/lib/supabase/client'

export default function GoogleButton() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    console.log('clicked')

    console.log('env check', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
      keyLen: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    })

    const session = await supabase.auth.getSession()
    console.log('getSession', session)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    console.log('signInWithOAuth result', { data, error })
    if (error) alert(error.message)
  }

  return (
    <button type="button" onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  )
}
