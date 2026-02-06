import Link from 'next/link'
import Image from 'next/image'
import { Clock, Home, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RevisionRequestedPage() {
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

        {/* Icon */}
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-10 h-10 text-orange-600" />
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Revision Requested
        </h1>
        <p className="text-gray-600 mb-6">
          Your feedback has been submitted to the HTA team. They will review your comments and
          make the necessary corrections. You will receive a new review link once the certificate
          is updated.
        </p>

        {/* Status Info */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-orange-700">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Awaiting Revision</span>
          </div>
          <p className="text-sm text-orange-600 mt-1">
            You will be notified when the updated certificate is ready.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/customer/dashboard" className="block">
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
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
