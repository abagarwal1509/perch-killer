'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
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

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      })
    } catch (error) {
      console.error('Error signing in:', error)
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
            <Button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="default"
              className="rounded-full"
            >
              {loading ? 'Signing in...' : 'Get started'}
            </Button>
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
            <Button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              size="lg"
              className="rounded-full text-lg px-8 py-6"
            >
              {loading ? 'Signing in...' : 'Start reading'}
            </Button>
          </div>

          {/* Right Illustration */}
          <div className="flex-1 flex justify-center lg:justify-end mt-12 lg:mt-0">
            <div className="relative">
              {/* Simple geometric illustration inspired by Medium */}
              <div className="w-80 h-80 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 rounded-full opacity-80"></div>
                <div className="absolute top-16 right-16 w-24 h-24 bg-green-500 rounded-full"></div>
                <div className="absolute top-8 right-8 w-16 h-16 bg-green-600 rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-40 h-20 bg-green-300 rounded-lg transform rotate-12"></div>
                <div className="absolute bottom-8 left-8 w-32 h-16 bg-green-400 rounded-lg transform -rotate-6"></div>
                {/* Scattered dots */}
                <div className="absolute top-24 left-12 w-2 h-2 bg-foreground rounded-full"></div>
                <div className="absolute top-32 left-24 w-2 h-2 bg-foreground rounded-full"></div>
                <div className="absolute bottom-32 right-12 w-2 h-2 bg-foreground rounded-full"></div>
                <div className="absolute bottom-24 right-24 w-2 h-2 bg-foreground rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sign In Modal Style - Welcome Back */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-6">Welcome back.</h2>
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-4">Signing you in...</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-center space-x-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Help</a>
            <a href="#" className="hover:text-foreground">Status</a>
            <a href="#" className="hover:text-foreground">About</a>
            <a href="#" className="hover:text-foreground">Careers</a>
            <a href="#" className="hover:text-foreground">Press</a>
            <a href="#" className="hover:text-foreground">Blog</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Text to speech</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
