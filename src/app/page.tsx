'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
    }
    checkUser()
  }, [router, supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
          return
        }
        router.push('/dashboard')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
          return
        }
        // If email confirmation is disabled, a session is returned immediately.
        if (data.session) {
          router.push('/dashboard')
        } else {
          setInfo('Account created. Check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-semibold">BlogHub</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Our story</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Membership</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Write</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center min-h-[80vh]">
          {/* Left Content */}
          <div className="flex-1 max-w-xl lg:pr-16">
            <h1 className="text-6xl lg:text-7xl font-serif leading-tight mb-8">
              Human
              <br />
              stories & ideas
            </h1>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
              A place to read, write, and deepen your understanding of the blogs you love most.
            </p>
          </div>

          {/* Right: Auth Card */}
          <div className="flex-1 flex justify-center lg:justify-end mt-12 lg:mt-0 w-full">
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-1">
                {mode === 'signin' ? 'Welcome back.' : 'Create your account'}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {mode === 'signin' ? 'Sign in to continue reading.' : 'Start reading the blogs you love.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="••••••••"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
                {info && <p className="text-sm text-green-600">{info}</p>}

                <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
                  {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground mt-4 text-center">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
                  className="text-foreground font-medium hover:underline"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-center space-x-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Help</a>
            <a href="#" className="hover:text-foreground">Status</a>
            <a href="#" className="hover:text-foreground">About</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
