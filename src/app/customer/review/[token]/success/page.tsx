import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Download, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ApprovalSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/hta-logo.jpg"
            alt="HTA Instrumentation"
            width={80}
            height={40}
            className="object-contain"
          />
        </div>

        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Certificate Approved!
        </h1>
        <p className="text-gray-600 mb-6">
          Thank you for approving the calibration certificate. Your signature has been recorded
          and the final certificate will be available for download shortly.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/customer/dashboard" className="block">
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
          <p className="text-sm text-gray-500">
            You can download the final certificate from your dashboard.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t">
          <p className="text-xs text-gray-400">
            HTA Instrumentation (P) Ltd.
          </p>
        </div>
      </div>
    </div>
  )
}
