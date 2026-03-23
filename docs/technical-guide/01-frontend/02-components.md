# Component Architecture

## Directory Structure

```
src/components/
├── ui/                    # Shadcn UI primitives
├── forms/                 # Certificate form sections
├── layout/                # Layout components
├── chat/                  # Chat/messaging
├── notifications/         # Notification system
├── feedback/              # Review feedback
├── signatures/            # Electronic signatures
├── pdf/                   # PDF generation
├── certificate/           # Certificate display
├── dashboard/             # Dashboard widgets
├── admin/                 # Admin-specific
├── customer/              # Customer-specific
├── uuc-images/            # Image management
├── providers/             # Context providers
└── tat/                   # Turnaround time
```

---

## UI Components (Shadcn)

Shadcn/UI provides accessible, customizable primitives built on Radix UI.

### Button

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export function Button({ className, variant, size, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### Usage

```tsx
<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Small Outline</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

### Available UI Components

| Component | File | Usage |
|-----------|------|-------|
| `Button` | `ui/button.tsx` | Actions, submissions |
| `Input` | `ui/input.tsx` | Text inputs |
| `Label` | `ui/label.tsx` | Form labels |
| `Select` | `ui/select.tsx` | Dropdowns |
| `Checkbox` | `ui/checkbox.tsx` | Boolean inputs |
| `RadioGroup` | `ui/radio-group.tsx` | Single selection |
| `Textarea` | `ui/textarea.tsx` | Multi-line text |
| `Dialog` | `ui/dialog.tsx` | Modal windows |
| `AlertDialog` | `ui/alert-dialog.tsx` | Confirm dialogs |
| `Card` | `ui/card.tsx` | Content containers |
| `Table` | `ui/table.tsx` | Data tables |
| `Badge` | `ui/badge.tsx` | Status indicators |
| `Separator` | `ui/separator.tsx` | Visual dividers |

---

## Form Section Components

The certificate form is split into collapsible sections:

```
┌─────────────────────────────────────────────────────────────────┐
│                  CERTIFICATE FORM STRUCTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FormSection (wrapper)                                     │   │
│  │  ├── Header with expand/collapse                         │   │
│  │  └── Content                                              │   │
│  │      └── SummarySection                                   │   │
│  │          ├── Certificate number                           │   │
│  │          ├── Calibration dates                            │   │
│  │          ├── Customer info                                │   │
│  │          └── Reviewer selection                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FormSection                                               │   │
│  │  └── UUCSection                                           │   │
│  │      ├── Description, make, model, serial                │   │
│  │      └── Parameters with accuracy config                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FormSection                                               │   │
│  │  └── MasterInstrumentSection                              │   │
│  │      └── Instrument selection grid                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FormSection                                               │   │
│  │  └── EnvironmentalSection                                 │   │
│  │      ├── Temperature (with category-based validation)    │   │
│  │      └── Humidity                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ... ResultsSection, RemarksSection, ConclusionSection ...      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FinalizeSection                                           │   │
│  │  ├── Save Draft button                                    │   │
│  │  └── Submit for Review button                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### FormSection Wrapper

```typescript
// src/components/forms/FormSection.tsx
interface FormSectionProps {
  title: string
  icon?: React.ReactNode
  defaultExpanded?: boolean
  children: React.ReactNode
  feedbackCount?: number
}

export function FormSection({
  title,
  icon,
  defaultExpanded = true,
  children,
  feedbackCount
}: FormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-lg font-semibold">{title}</h2>
          {feedbackCount > 0 && (
            <Badge variant="destructive">{feedbackCount}</Badge>
          )}
        </div>
        <ChevronDown className={cn(
          'transition-transform',
          isExpanded && 'rotate-180'
        )} />
      </button>
      {isExpanded && (
        <div className="p-6 pt-0 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  )
}
```

### SummarySection

```typescript
// src/components/forms/SummarySection.tsx
export function SummarySection({ isNewCertificate = false }) {
  const { formData, setFormField } = useCertificateStore()
  const [numberExists, setNumberExists] = useState(false)

  // Debounced certificate number check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.certificateNumber) {
        const res = await fetch(
          `/api/certificates/check-number?number=${formData.certificateNumber}`
        )
        const data = await res.json()
        setNumberExists(data.exists)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.certificateNumber])

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <Label>Certificate Number</Label>
        <Input
          value={formData.certificateNumber}
          onChange={(e) => setFormField('certificateNumber', e.target.value)}
          disabled={!isNewCertificate}
          className={numberExists ? 'border-red-500' : ''}
        />
        {numberExists && (
          <p className="text-red-500 text-sm">This number already exists</p>
        )}
      </div>
      {/* More fields... */}
    </div>
  )
}
```

---

## Layout Components

### DashboardSidebar

```typescript
// src/components/layout/DashboardSidebar.tsx
'use client'

import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/certificates', label: 'Certificates', icon: FileText },
  { href: '/dashboard/reviewer', label: 'Reviews', icon: CheckCircle },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-64 bg-white border-r h-full">
      <div className="p-6">
        <Logo />
      </div>

      <nav className="px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg',
              pathname === item.href
                ? 'bg-primary text-white'
                : 'hover:bg-slate-100'
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 w-full p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar>{session?.user?.name?.[0]}</Avatar>
          <div>
            <p className="font-medium">{session?.user?.name}</p>
            <p className="text-sm text-gray-500">{session?.user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full mt-2"
        >
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
```

### DashboardHeader

```typescript
// src/components/layout/DashboardHeader.tsx
export function DashboardHeader() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">
        {/* Page title from context or props */}
      </h1>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
```

---

## Signature Components

### SignatureCanvas

```typescript
// src/components/signatures/SignatureCanvas.tsx
'use client'

import { useRef, useState, useEffect } from 'react'

export function SignatureCanvas({ onSave, onClear }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const startDrawing = (e: React.MouseEvent) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleSave = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="border rounded-lg"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <div className="flex gap-2 mt-2">
        <Button onClick={handleSave}>Save Signature</Button>
        <Button variant="outline" onClick={onClear}>Clear</Button>
      </div>
    </div>
  )
}
```

### TypedSignature

```typescript
// src/components/signatures/TypedSignature.tsx
// Uses Caveat font for handwritten appearance

export function TypedSignature({ name, timestamp }) {
  return (
    <div className="text-center">
      <p className="font-caveat text-3xl text-primary">{name}</p>
      <p className="text-sm text-gray-500">
        Signed: {format(timestamp, 'PPpp')}
      </p>
    </div>
  )
}
```

---

## PDF Components

### CalibrationCertificatePDF

```typescript
// src/components/pdf/CalibrationCertificatePDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: 'bold' },
  // ... more styles
})

export function CalibrationCertificatePDF({ certificate, parameters, results }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoBase64} style={{ width: 100 }} />
          <View>
            <Text style={styles.title}>Calibration Certificate</Text>
            <Text>No: {certificate.certificateNumber}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.label}>Customer:</Text>
          <Text>{certificate.customerName}</Text>
        </View>

        {/* Results Table */}
        <View style={styles.table}>
          {/* Table header */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Parameter</Text>
            <Text style={styles.tableCell}>Standard</Text>
            <Text style={styles.tableCell}>UUC</Text>
            <Text style={styles.tableCell}>Error</Text>
          </View>
          {/* Table rows */}
          {results.map((result, i) => (
            <View key={i} style={styles.tableRow}>
              {/* ... */}
            </View>
          ))}
        </View>

        {/* Signatures */}
        {/* Footer with page numbers */}
      </Page>
    </Document>
  )
}
```

---

## Status Components

### StatusBadge

```typescript
// src/components/dashboard/StatusBadge.tsx
const statusConfig = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  IN_REVIEW: { label: 'In Review', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  SENT_TO_CUSTOMER: { label: 'Sent to Customer', className: 'bg-purple-100 text-purple-700' },
  CUSTOMER_APPROVED: { label: 'Customer Approved', className: 'bg-teal-100 text-teal-700' },
  ADMIN_AUTHORIZED: { label: 'Authorized', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.DRAFT

  return (
    <span className={cn(
      'px-2 py-1 rounded-full text-xs font-medium',
      config.className
    )}>
      {config.label}
    </span>
  )
}
```

### TATBadge

```typescript
// src/components/tat/TATBadge.tsx
import { formatDuration } from '@/lib/utils/tat-calculator'

export function TATBadge({ hours, isOverdue = false }) {
  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-1 rounded text-xs',
      isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
    )}>
      <Clock className="w-3 h-3" />
      <span>{formatDuration(hours)}</span>
    </div>
  )
}
```

---

## Component Best Practices

### 1. Colocate Related Files

```
components/
└── certificate/
    ├── CertificateCard.tsx
    ├── CertificateCard.test.tsx
    └── CertificateCard.types.ts
```

### 2. Use Composition

```tsx
// Compose smaller components
<Card>
  <CardHeader>
    <CardTitle>Certificate</CardTitle>
  </CardHeader>
  <CardContent>
    <StatusBadge status={status} />
    <TATBadge hours={tatHours} />
  </CardContent>
  <CardFooter>
    <Button>View</Button>
  </CardFooter>
</Card>
```

### 3. Separate Logic with Custom Hooks

```typescript
// hooks/useCertificateValidation.ts
export function useCertificateValidation(formData) {
  const errors = useMemo(() => {
    const validationErrors = []
    if (!formData.customerName) validationErrors.push('Customer required')
    // ... more validation
    return validationErrors
  }, [formData])

  return { errors, isValid: errors.length === 0 }
}
```

### 4. Memoize Expensive Computations

```typescript
const requirements = useMemo(() => {
  return calculateEnvironmentalRequirements(selectedCategories)
}, [selectedCategories])
```
