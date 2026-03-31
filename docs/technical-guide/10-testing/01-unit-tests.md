# Unit Tests Deep Dive

## Framework: Vitest

Vitest is a Vite-native testing framework compatible with Jest APIs.

```bash
# Install (already in project)
npm install -D vitest @vitejs/plugin-react jsdom
```

---

## Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',     // Browser-like DOM
    globals: true,            // describe/it/expect global
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

---

## Test Setup

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('DATABASE_URL', 'file:./test.db')

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    // ... other models
  },
}))
```

---

## Unit Test Examples

### Testing Pure Functions

```typescript
// src/lib/__tests__/tat-calculator.test.ts

import { describe, it, expect } from 'vitest'
import {
  calculateCertificateTAT,
  aggregateTATMetrics,
  type CertificateEvent,
} from '../utils/tat-calculator'

// Helper to create test events
function createEvent(
  type: string,
  hoursFromStart: number,
  certificateId = 'cert-1'
): CertificateEvent {
  const date = new Date('2024-01-01T00:00:00Z')
  date.setHours(date.getHours() + hoursFromStart)
  return {
    id: `event-${hoursFromStart}`,
    eventType: type,
    createdAt: date,
    certificateId,
  }
}

describe('TAT Calculator', () => {
  describe('calculateCertificateTAT', () => {
    it('returns null for empty events', () => {
      const result = calculateCertificateTAT([])
      expect(result).toBeNull()
    })

    it('calculates total TAT for completed certificate', () => {
      const events = [
        createEvent('SUBMITTED_FOR_REVIEW', 0),
        createEvent('REVIEWER_APPROVED', 5),
        createEvent('SENT_TO_CUSTOMER', 6),
        createEvent('CUSTOMER_APPROVED', 24),
        createEvent('ADMIN_AUTHORIZED', 25),
      ]

      const result = calculateCertificateTAT(events)

      expect(result).not.toBeNull()
      expect(result!.totalTAT.hours).toBe(25)
      expect(result!.totalTAT.isComplete).toBe(true)
    })

    it('tracks reviewer cycles correctly', () => {
      const events = [
        createEvent('SUBMITTED_FOR_REVIEW', 0),
        createEvent('REVISION_REQUESTED', 4),
        createEvent('RESUBMITTED_FOR_REVIEW', 6),
        createEvent('REVIEWER_APPROVED', 8),
      ]

      const result = calculateCertificateTAT(events)

      expect(result!.reviewer.cycleCount).toBe(2)
      expect(result!.engineerRevision.cycleCount).toBe(1)
    })
  })

  describe('aggregateTATMetrics', () => {
    it('handles empty array', () => {
      const result = aggregateTATMetrics([])
      expect(result.certificateCount).toBe(0)
      expect(result.totalTAT.avgHours).toBe(0)
    })
  })
})
```

### Testing with Mocks

```typescript
// src/lib/__tests__/route-guards.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSession } from '../auth/route-guards'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

import { getServerSession } from 'next-auth'

describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const result = await validateSession()

    expect(result).toBeNull()
  })

  it('returns session when authenticated', async () => {
    const mockSession = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'ENGINEER',
      },
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)

    const result = await validateSession()

    expect(result).toEqual(mockSession)
  })
})
```

### Testing Zustand Stores

```typescript
// src/lib/stores/__tests__/certificate-store.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { useCertificateStore } from '../certificate-store'

describe('Certificate Store', () => {
  beforeEach(() => {
    // Reset store state
    useCertificateStore.setState({
      certificate: null,
      parameters: [],
      isDirty: false,
    })
  })

  it('initializes with empty state', () => {
    const state = useCertificateStore.getState()

    expect(state.certificate).toBeNull()
    expect(state.parameters).toEqual([])
    expect(state.isDirty).toBe(false)
  })

  it('sets certificate data', () => {
    const mockCertificate = {
      id: 'cert-1',
      certificateNumber: 'HTA-2024-001',
      status: 'DRAFT',
    }

    useCertificateStore.getState().setCertificate(mockCertificate)

    const state = useCertificateStore.getState()
    expect(state.certificate).toEqual(mockCertificate)
    expect(state.isDirty).toBe(true)
  })

  it('adds parameter', () => {
    const param = {
      id: 'param-1',
      parameterName: 'Voltage',
      parameterUnit: 'V',
    }

    useCertificateStore.getState().addParameter(param)

    const state = useCertificateStore.getState()
    expect(state.parameters).toHaveLength(1)
    expect(state.parameters[0]).toEqual(param)
  })
})
```

---

## Mocking Strategies

### Mock Prisma Client

```typescript
// __mocks__/prisma.ts
import { vi } from 'vitest'

export const prisma = {
  certificate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(prisma)),
}

// In test file
import { prisma } from '@/lib/prisma'
import { vi } from 'vitest'

vi.mock('@/lib/prisma')

it('creates certificate', async () => {
  vi.mocked(prisma.certificate.create).mockResolvedValue({
    id: 'cert-1',
    certificateNumber: 'HTA-2024-001',
  })

  const result = await createCertificate({ ... })

  expect(prisma.certificate.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ ... }),
  })
})
```

### Mock Next.js Modules

```typescript
// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
  headers: () => new Headers(),
}))
```

### Mock API Fetch

```typescript
import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  global.fetch = vi.fn()
})

it('fetches data', async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
  } as Response)

  const result = await fetchCertificates()

  expect(fetch).toHaveBeenCalledWith('/api/certificates')
  expect(result).toEqual({ data: [] })
})
```

---

## Testing Components

```typescript
// src/components/__tests__/StatusBadge.test.tsx

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders draft status', () => {
    render(<StatusBadge status="DRAFT" />)

    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toHaveClass('bg-gray-100')
  })

  it('renders approved status with green color', () => {
    render(<StatusBadge status="APPROVED" />)

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toHaveClass('bg-green-100')
  })
})
```

---

## Running Unit Tests

```bash
# Run all unit tests
npm run test

# Watch mode
npm run test:watch

# Specific file
npx vitest run src/lib/__tests__/tat-calculator.test.ts

# With coverage
npm run test:coverage

# Filter by test name
npx vitest run -t "calculates total TAT"
```

---

## Debugging Tests

### VS Code Integration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vitest",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Console Debugging

```typescript
it('debugs a test', () => {
  const result = calculateSomething()

  console.log('Result:', result)  // Will show in test output
  console.dir(result, { depth: null })  // Deep object inspection

  expect(result).toBeDefined()
})
```

---

## Best Practices

### 1. Arrange-Act-Assert

```typescript
it('does something', () => {
  // Arrange
  const input = { ... }
  vi.mocked(prisma.certificate.findUnique).mockResolvedValue(mockCert)

  // Act
  const result = processInput(input)

  // Assert
  expect(result).toEqual(expected)
})
```

### 2. One Assertion per Test (When Practical)

```typescript
// Prefer multiple focused tests
it('returns correct status', () => {
  expect(getStatus(cert)).toBe('DRAFT')
})

it('returns correct label', () => {
  expect(getLabel(cert)).toBe('Draft')
})
```

### 3. Use Meaningful Test Names

```typescript
// Good
it('returns null when certificate not found')
it('throws error for invalid status transition')

// Bad
it('test 1')
it('works')
```

### 4. Isolate Tests

```typescript
beforeEach(() => {
  vi.clearAllMocks()  // Clear mock call history
  vi.resetAllMocks()  // Reset mock implementations
})
```
