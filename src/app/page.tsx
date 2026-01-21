import Link from 'next/link'
import { ArrowRight, FileText, Users, ClipboardCheck, Shield } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="size-10 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">HTA Calibration</h1>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">
            Digital Calibration Certificates
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Streamline your calibration workflow with our digital certificate management system.
            Create, review, and approve certificates with ease.
          </p>
          <Link
            href="/certificates/new"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg"
          >
            Create New Certificate
            <ArrowRight className="size-5" />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <FileText className="size-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Digital Forms</h3>
            <p className="text-sm text-slate-600">
              Complete calibration certificates with intuitive digital forms and auto-calculations.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <ClipboardCheck className="size-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Error Calculation</h3>
            <p className="text-sm text-slate-600">
              Automatic error calculation with out-of-limit flagging for accurate results.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Users className="size-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Approval Workflow</h3>
            <p className="text-sm text-slate-600">
              Multi-stage approval process with HoD review and customer sign-off.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Shield className="size-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Audit Trail</h3>
            <p className="text-sm text-slate-600">
              Complete audit trail with versioning and immutable signature records.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 mb-4">Quick Links:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/certificates/new"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              New Certificate
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-16">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>HTA Calibration Certificate Management System</p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
            Stage 1: Certificate Form
          </p>
        </div>
      </footer>
    </div>
  )
}
