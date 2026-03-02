'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  Wrench,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  ArrowRightLeft,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  userName: string
  userEmail: string
  pendingRegistrations?: number
  instrumentAlerts?: number
  pendingAuthorizations?: number
  isHodWithAdmin?: boolean
}

export function AdminSidebar({
  userName,
  userEmail,
  pendingRegistrations = 0,
  instrumentAlerts = 0,
  pendingAuthorizations = 0,
  isHodWithAdmin = false,
}: AdminSidebarProps) {
  const pathname = usePathname()

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, badge: 0 },
    { name: 'Staff Users', href: '/admin/users', icon: Users, badge: 0 },
    { name: 'Customer Accounts', href: '/admin/customers', icon: Building2, badge: 0 },
    {
      name: 'Registrations',
      href: '/admin/registrations',
      icon: UserCheck,
      badge: pendingRegistrations,
      badgeColor: 'bg-red-500',
    },
    { name: 'Certificates', href: '/admin/certificates', icon: FileText, badge: 0 },
    {
      name: 'Authorization',
      href: '/admin/authorization',
      icon: ShieldCheck,
      badge: pendingAuthorizations,
      badgeColor: 'bg-blue-500',
    },
    {
      name: 'Master Instruments',
      href: '/admin/instruments',
      icon: Wrench,
      badge: instrumentAlerts,
      badgeColor: 'bg-amber-500',
    },
    { name: 'Settings', href: '/admin/settings', icon: Settings, badge: 0 },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/hta-logo.jpg"
            alt="HTA Logo"
            width={40}
            height={40}
            className="rounded"
          />
          <div>
            <h1 className="text-lg font-bold text-gray-900">HTA Admin</h1>
            <p className="text-xs text-gray-500">Calibration System</p>
          </div>
        </Link>
      </div>

      {/* Role Switcher - Only for HoD with Admin access */}
      {isHodWithAdmin && (
        <div className="px-4 py-3 border-b border-gray-200">
          <Link
            href="/hod/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Switch to Manager View
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                active
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', active ? 'text-green-600' : 'text-gray-400')} />
              <span className="flex-1">{item.name}</span>
              {item.badge > 0 && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-semibold text-white rounded-full',
                    item.badgeColor || 'bg-gray-500'
                  )}
                >
                  {item.badge}
                </span>
              )}
              {active && <ChevronRight className="h-4 w-4 text-green-600" />}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-700 font-semibold text-sm">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
