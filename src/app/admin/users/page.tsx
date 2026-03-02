import { Suspense } from 'react'
import { UserListClient } from './UserListClient'

export default function UsersPage() {
  return (
    <div className="p-8">
      <Suspense fallback={<UserListSkeleton />}>
        <UserListClient />
      </Suspense>
    </div>
  )
}

function UserListSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
      <div className="h-10 w-full bg-gray-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  )
}
