# 01 - Frontend Architecture

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-nextjs-app-router.md](./01-nextjs-app-router.md) | App Router, layouts, routing patterns | Understanding routing |
| [02-components.md](./02-components.md) | Component architecture, UI library | Building UI |
| [03-state-management.md](./03-state-management.md) | Zustand stores, form state | Managing state |
| [04-styling.md](./04-styling.md) | Tailwind CSS, theming, patterns | Styling components |

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework (App Router) |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | - | Accessible component library |
| Lucide React | - | Icon library |
| React Hook Form | - | Form handling |
| Zod | - | Schema validation |

---

## Directory Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Authentication routes (no layout)
│   │   ├── login/            # Staff login
│   │   └── customer/
│   │       └── login/        # Customer login
│   ├── (dashboard)/           # Protected routes (shared layout)
│   │   ├── dashboard/        # Main dashboard
│   │   ├── certificates/     # Certificate management
│   │   ├── master-instruments/ # Instrument database
│   │   └── admin/            # Admin features
│   ├── customer/              # Customer portal
│   │   └── dashboard/        # Customer dashboard
│   └── api/                   # API routes
├── components/
│   ├── ui/                    # shadcn/ui base components
│   ├── certificates/          # Certificate-specific components
│   ├── layout/               # Layout components
│   └── shared/               # Reusable components
├── hooks/                     # Custom React hooks
├── lib/                       # Utilities
└── types/                     # TypeScript definitions
```

---

## App Router Concepts

### Route Groups
Route groups `(folder)` organize routes without affecting the URL:

```
app/
├── (auth)/           # Group for auth pages
│   └── login/       # → /login
└── (dashboard)/      # Group for protected pages
    └── certificates/ # → /certificates
```

### Layouts
Each route group can have its own layout:

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### Server vs Client Components

**Server Components** (default):
- Fetch data directly
- Access backend resources
- No interactivity
- Smaller bundle size

**Client Components** (`'use client'`):
- Event handlers
- Browser APIs
- React hooks (useState, useEffect)
- Interactive UI

```typescript
// Server Component (default)
async function CertificateList() {
  const certificates = await prisma.certificate.findMany()
  return <ul>{certificates.map(c => <li key={c.id}>{c.certificateNumber}</li>)}</ul>
}

// Client Component
'use client'
function SearchInput() {
  const [query, setQuery] = useState('')
  return <input value={query} onChange={e => setQuery(e.target.value)} />
}
```

---

## Component Patterns

### 1. shadcn/ui Components

Located in `src/components/ui/`, these are copied (not imported from npm):

```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
```

**Customization**: Edit the component files directly.

### 2. Form Pattern

Using React Hook Form + Zod:

```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: z.infer<typeof schema>) => {
    // Handle submit
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('email')} />
      {form.formState.errors.email && <span>{form.formState.errors.email.message}</span>}
      <Button type="submit">Login</Button>
    </form>
  )
}
```

### 3. Data Fetching Pattern

**Server Component (preferred)**:
```typescript
// app/certificates/page.tsx
import { prisma } from '@/lib/prisma'

export default async function CertificatesPage() {
  const certificates = await prisma.certificate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return <CertificateTable data={certificates} />
}
```

**Client Component (when needed)**:
```typescript
'use client'
import useSWR from 'swr'

export function RealtimeCertificates() {
  const { data, error, isLoading } = useSWR('/api/certificates', fetcher, {
    refreshInterval: 5000,
  })

  if (isLoading) return <Skeleton />
  if (error) return <ErrorMessage />
  return <CertificateTable data={data} />
}
```

---

## Styling

### Tailwind CSS

Utility classes for styling:

```tsx
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-md">
  <span className="text-sm font-medium text-gray-600">Status:</span>
  <Badge variant="success">Approved</Badge>
</div>
```

### CSS Variables (Theme)

Defined in `src/app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### Responsive Design

Mobile-first breakpoints:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>
```

| Prefix | Min Width |
|--------|-----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

---

## Authentication UI

### Login Flow

```
/login (Staff) ──────────────────────────────┐
                                             │
/customer/login (Customer) ──────────────────┤
                                             ▼
                                    NextAuth signIn()
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                  ▼
           Success: redirect to                              Failure: show error
           /dashboard or /customer/dashboard                 on login page
```

### Protected Routes

Using NextAuth `auth()` in server components:

```typescript
// app/(dashboard)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <Navbar user={session.user} />
      {children}
    </div>
  )
}
```

---

## Common Failure Modes

### 1. Hydration Mismatch

**Symptom**: "Text content did not match" error

**Cause**: Server and client render different content

**Fix**:
```typescript
// Use useEffect for client-only data
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null
```

### 2. "use client" Missing

**Symptom**: "useState is not a function" or similar

**Cause**: Using hooks in server component

**Fix**: Add `'use client'` at top of file

### 3. Import Errors with @ Alias

**Symptom**: Module not found `@/components/...`

**Cause**: TypeScript path mapping issue

**Fix**: Check `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4. CSRF Token Missing

**Symptom**: Login fails silently

**Cause**: NextAuth CSRF token not sent

**Fix**: Fetch CSRF token before sign in:
```typescript
import { getCsrfToken } from 'next-auth/react'

const csrfToken = await getCsrfToken()
signIn('credentials', { ...data, csrfToken })
```

---

## Performance Tips

1. **Use Server Components** by default - smaller bundle
2. **Lazy load** heavy components: `const Chart = dynamic(() => import('./Chart'))`
3. **Image optimization**: Use `next/image` for automatic optimization
4. **Avoid layout shifts**: Set explicit dimensions on images/skeletons

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout (html, body, providers) |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout (sidebar, navbar) |
| `src/components/ui/` | Base UI components |
| `src/app/globals.css` | Global styles + CSS variables |
| `tailwind.config.ts` | Tailwind configuration |
| `next.config.ts` | Next.js configuration |

---

## Next Steps

- [02 - Backend](../02-backend/) - API routes and server actions
- [04 - Authentication](../04-authentication/) - Auth deep dive
