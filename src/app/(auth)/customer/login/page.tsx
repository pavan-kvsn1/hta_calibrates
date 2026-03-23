'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, getCsrfToken } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

function CustomerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/customer/dashboard'
  const error = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | undefined>()

  // Fetch CSRF token on mount
  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError(null)

    try {
      const result = await signIn('customer-credentials', {
        email,
        password,
        redirect: false,
        csrfToken,
      })

      if (result?.error) {
        setLoginError('Invalid email or password')
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setLoginError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Logo and Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/hta-logo.jpg"
            alt="HTA Instrumentation"
            width={120}
            height={60}
            className="object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          HTA Calibration System
        </h1>
        <p className="text-gray-600 mt-2">Customer Portal</p>
      </div>

      {/* Error Messages */}
      {(error || loginError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            {loginError || 'Authentication failed. Please try again.'}
          </p>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="w-full"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-green-700 hover:bg-green-800"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      {/* Help Text */}
      <div className="mt-6 text-center border-t pt-6">
        <p className="text-sm text-gray-600">
          Don&apos;t have an account? Contact your company administrator
          or reach out to HTA to set up your account.
        </p>
      </div>

      {/* Staff Login Link */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          HTA Staff?{' '}
          <a
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Login here
          </a>
        </p>
      </div>
    </div>
  )
}

function LoginFormSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="size-8 animate-spin text-green-600" />
      </div>
    </div>
  )
}

export default function CustomerLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <Suspense fallback={<LoginFormSkeleton />}>
          <CustomerLoginForm />
        </Suspense>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-4">
          HTA Instrumentation (P) Ltd.
        </p>
      </div>
    </div>
  )
}
