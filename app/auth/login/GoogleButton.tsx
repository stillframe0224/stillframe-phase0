'use client'

import { createClient } from '@/lib/supabase/client'

export default function GoogleButton({ next }: { next?: string }) {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (next) callbackUrl.searchParams.set('next', next);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) alert(error.message)
  }

  return (
    <button type="button" onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  )
}
