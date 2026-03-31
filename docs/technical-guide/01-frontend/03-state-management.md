# State Management with Zustand

## Overview

The application uses **Zustand** for client-side state management, providing a simple, performant alternative to Redux.

---

## Store Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZUSTAND STORES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useCertificateStore                                       │   │
│  │  ├── formData (entire certificate form state)            │   │
│  │  ├── parameters[] (calibration parameters)               │   │
│  │  ├── isDirty, isSaving, validationErrors                 │   │
│  │  └── Actions: setFormField, addParameter, saveDraft...   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useSigningEvidenceStore                                   │   │
│  │  ├── evidenceChain[] (signatures with hashes)            │   │
│  │  └── Actions: appendEvidence, verifyChain                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useMasterInstrumentStore                                  │   │
│  │  ├── instruments[] (available instruments)               │   │
│  │  └── Actions: fetch, filter, select                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Certificate Store

The main store managing the certificate form:

```typescript
// src/lib/stores/certificate-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface CertificateStore {
  // State
  formData: CertificateFormData
  parameters: Parameter[]
  isDirty: boolean
  isSaving: boolean
  validationErrors: Record<string, string>
  isHydrated: boolean
  certificateId: string | null

  // Actions
  setFormField: (field: string, value: any) => void
  setParameter: (index: number, field: string, value: any) => void
  addParameter: () => void
  removeParameter: (index: number) => void
  setResult: (paramIndex: number, resultIndex: number, field: string, value: any) => void
  addResult: (paramIndex: number) => void
  removeResult: (paramIndex: number, resultIndex: number) => void
  calculateError: (paramIndex: number, resultIndex: number) => void
  recalculateAllErrors: (paramIndex: number) => void
  saveDraft: () => Promise<void>
  loadCertificate: (id: string) => Promise<void>
  reset: () => void
}
```

### Form Data Structure

```typescript
interface CertificateFormData {
  // Meta
  certificateNumber: string
  status: CertificateStatus
  lastSaved: Date | null

  // Section 1: Summary
  calibrationLocation: 'LAB' | 'SITE'
  dateOfCalibration: Date
  dateOfIssue: Date
  nextCalibrationDue: Date
  calibrationTenure: number  // months
  customerName: string
  customerAddress: string
  customerPONumber: string
  reviewerId: string | null

  // Section 2: UUC (Under Unit Calibration)
  uucDescription: string
  uucMake: string
  uucModel: string
  uucSerialNumber: string
  uucIdNumber: string
  uucRange: string
  uucLeastCount: string
  uucAccuracy: string

  // Section 4: Environmental
  ambientTemperature: number | null
  relativeHumidity: number | null

  // Section 6: Remarks
  stickerApplied: 'YES' | 'NO' | 'NA'
  remarks: string

  // Section 7: Conclusion
  conclusion: string
}
```

### Parameter Structure

```typescript
interface Parameter {
  id: string
  parameterName: string
  parameterUnit: string

  // Range
  rangeMin: number
  rangeMax: number
  rangeUnit: string

  // Accuracy Configuration
  accuracyType: 'PERCENT_READING' | 'PERCENT_SCALE' | 'ABSOLUTE'
  accuracy: number
  accuracyUnit: string

  // Binning (for range-specific accuracy)
  requiresBinning: boolean
  bins: AccuracyBin[]

  // Error formula
  errorFormula: 'A-B' | 'B-A'  // A = Standard, B = UUC

  // Results
  results: CalibrationResult[]
}

interface CalibrationResult {
  id: string
  standardReading: number
  uucReading: number
  errorObserved: number  // Calculated
  errorLimit: number     // Calculated
  isOutOfLimit: boolean  // Calculated
}

interface AccuracyBin {
  rangeStart: number
  rangeEnd: number
  accuracy: number
}
```

---

## Store Implementation

### Creating the Store

```typescript
// src/lib/stores/certificate-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useCertificateStore = create<CertificateStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      formData: defaultFormData,
      parameters: [],
      isDirty: false,
      isSaving: false,
      validationErrors: {},
      isHydrated: false,
      certificateId: null,

      // Actions
      setFormField: (field, value) => {
        set((state) => {
          state.formData[field] = value
          state.isDirty = true

          // Auto-calculate due date when calibration date changes
          if (field === 'dateOfCalibration' && state.formData.calibrationTenure) {
            state.formData.nextCalibrationDue = addMonths(
              value,
              state.formData.calibrationTenure
            )
          }
        })
      },

      setParameter: (index, field, value) => {
        set((state) => {
          state.parameters[index][field] = value
          state.isDirty = true

          // Recalculate errors if accuracy-related field changed
          const accuracyFields = ['accuracyType', 'accuracy', 'bins', 'errorFormula']
          if (accuracyFields.includes(field)) {
            // Trigger recalculation
            get().recalculateAllErrors(index)
          }
        })
      },

      addParameter: () => {
        set((state) => {
          state.parameters.push({
            id: crypto.randomUUID(),
            parameterName: '',
            parameterUnit: '',
            rangeMin: 0,
            rangeMax: 0,
            rangeUnit: '',
            accuracyType: 'ABSOLUTE',
            accuracy: 0,
            accuracyUnit: '',
            requiresBinning: false,
            bins: [],
            errorFormula: 'A-B',
            results: []
          })
          state.isDirty = true
        })
      },

      removeParameter: (index) => {
        set((state) => {
          state.parameters.splice(index, 1)
          state.isDirty = true
        })
      },

      // ... more actions
    })),
    {
      name: 'certificate-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        formData: state.formData,
        parameters: state.parameters,
        certificateId: state.certificateId
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      }
    }
  )
)
```

### Error Calculation Logic

```typescript
calculateError: (paramIndex, resultIndex) => {
  set((state) => {
    const param = state.parameters[paramIndex]
    const result = param.results[resultIndex]

    // Calculate error based on formula
    const error = param.errorFormula === 'A-B'
      ? result.standardReading - result.uucReading
      : result.uucReading - result.standardReading

    result.errorObserved = error

    // Calculate error limit based on accuracy type
    let limit: number

    if (param.requiresBinning) {
      // Find matching bin
      const bin = param.bins.find(b =>
        result.standardReading >= b.rangeStart &&
        result.standardReading <= b.rangeEnd
      )
      if (bin) {
        limit = calculateLimit(param.accuracyType, bin.accuracy, result, param)
      } else {
        limit = Infinity  // No matching bin
      }
    } else {
      limit = calculateLimit(param.accuracyType, param.accuracy, result, param)
    }

    result.errorLimit = limit
    result.isOutOfLimit = Math.abs(error) > limit
  })
},

// Helper function
function calculateLimit(
  accuracyType: string,
  accuracy: number,
  result: CalibrationResult,
  param: Parameter
): number {
  switch (accuracyType) {
    case 'PERCENT_READING':
      return (accuracy * Math.abs(result.standardReading)) / 100
    case 'PERCENT_SCALE':
      const range = Math.abs(param.rangeMax - param.rangeMin)
      return (accuracy * range) / 100
    case 'ABSOLUTE':
    default:
      return accuracy
  }
}
```

### Save Draft Action

```typescript
saveDraft: async () => {
  const { formData, parameters, certificateId } = get()

  set({ isSaving: true })

  try {
    const url = certificateId
      ? `/api/certificates/${certificateId}`
      : '/api/certificates'

    const method = certificateId ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        parameters
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save')
    }

    const data = await response.json()

    set((state) => {
      state.certificateId = data.id
      state.formData.lastSaved = new Date()
      state.isDirty = false
    })

    return data
  } catch (error) {
    console.error('Save failed:', error)
    throw error
  } finally {
    set({ isSaving: false })
  }
}
```

---

## Using the Store

### In Components

```typescript
// src/components/forms/SummarySection.tsx
'use client'

import { useCertificateStore } from '@/lib/stores/certificate-store'

export function SummarySection() {
  // Subscribe to specific slices to prevent unnecessary re-renders
  const formData = useCertificateStore((state) => state.formData)
  const setFormField = useCertificateStore((state) => state.setFormField)
  const isDirty = useCertificateStore((state) => state.isDirty)

  return (
    <div>
      <Input
        value={formData.customerName}
        onChange={(e) => setFormField('customerName', e.target.value)}
      />
      {isDirty && <span className="text-yellow-600">Unsaved changes</span>}
    </div>
  )
}
```

### Selector Pattern (Performance)

```typescript
// Bad: Subscribes to entire store
const store = useCertificateStore()
const name = store.formData.customerName  // Re-renders on ANY state change

// Good: Subscribe to specific value
const customerName = useCertificateStore(
  (state) => state.formData.customerName
)  // Only re-renders when customerName changes

// Good: Multiple values with shallow equality
import { shallow } from 'zustand/shallow'

const { customerName, isDirty } = useCertificateStore(
  (state) => ({
    customerName: state.formData.customerName,
    isDirty: state.isDirty
  }),
  shallow
)
```

### Actions Outside Components

```typescript
// Can access store outside React components
const saveDraft = useCertificateStore.getState().saveDraft
const formData = useCertificateStore.getState().formData

// Subscribe to changes
const unsubscribe = useCertificateStore.subscribe(
  (state) => state.isDirty,
  (isDirty) => {
    if (isDirty) {
      // Auto-save logic
    }
  }
)
```

---

## Signing Evidence Store

For capturing cryptographic signing evidence:

```typescript
// src/lib/stores/signing-evidence.ts
import { create } from 'zustand'
import { sha256 } from '@/lib/utils/crypto'

interface SigningEvidence {
  timestamp: string
  signerType: 'ENGINEER' | 'REVIEWER' | 'ADMIN' | 'CUSTOMER'
  signerName: string
  signerEmail: string
  signerId: string
  signature: string  // Base64 image or typed name
  documentHash: string  // SHA-256 of PDF at time of signing
  previousHash: string  // Hash chain
  contextLayer: {
    ip: string
    userAgent: string
    timezone: string
    screenResolution: string
  }
  consentLayer: {
    consentVersion: string
    acceptedAt: string
  }
}

interface SigningEvidenceStore {
  evidenceChain: SigningEvidence[]
  appendSigningEvidence: (evidence: Omit<SigningEvidence, 'previousHash'>) => void
  verifyEvidenceChain: () => boolean
  buildSigningEvidencePayload: (type: string) => SigningEvidence
}

export const useSigningEvidenceStore = create<SigningEvidenceStore>((set, get) => ({
  evidenceChain: [],

  appendSigningEvidence: (evidence) => {
    set((state) => {
      const previousHash = state.evidenceChain.length > 0
        ? sha256(JSON.stringify(state.evidenceChain[state.evidenceChain.length - 1]))
        : 'GENESIS'

      return {
        evidenceChain: [
          ...state.evidenceChain,
          { ...evidence, previousHash }
        ]
      }
    })
  },

  verifyEvidenceChain: () => {
    const chain = get().evidenceChain

    for (let i = 1; i < chain.length; i++) {
      const expectedHash = sha256(JSON.stringify(chain[i - 1]))
      if (chain[i].previousHash !== expectedHash) {
        return false  // Chain broken
      }
    }

    return true
  },

  buildSigningEvidencePayload: (type) => {
    return {
      timestamp: new Date().toISOString(),
      signerType: type,
      contextLayer: {
        ip: 'captured-server-side',
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${screen.width}x${screen.height}`
      },
      consentLayer: {
        consentVersion: '1.0',
        acceptedAt: new Date().toISOString()
      }
      // Other fields filled by caller
    }
  }
}))
```

---

## Persistence

### Session Storage

```typescript
// Persists across page refreshes, clears on tab close
persist(
  (set, get) => ({ ... }),
  {
    name: 'certificate-store',
    storage: createJSONStorage(() => sessionStorage)
  }
)
```

### Local Storage

```typescript
// Persists across sessions
persist(
  (set, get) => ({ ... }),
  {
    name: 'user-preferences',
    storage: createJSONStorage(() => localStorage)
  }
)
```

### Partial Persistence

```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: 'certificate-store',
    partialize: (state) => ({
      // Only persist these fields
      formData: state.formData,
      parameters: state.parameters,
      certificateId: state.certificateId
      // Don't persist: isDirty, isSaving, validationErrors
    })
  }
)
```

---

## Hydration Handling

```typescript
// Handle SSR/hydration mismatch
export function CertificateForm() {
  const isHydrated = useCertificateStore((state) => state.isHydrated)

  if (!isHydrated) {
    return <Loading />  // Show loading until store is hydrated
  }

  return <ActualForm />
}

// In store
{
  isHydrated: false,
  setHydrated: (value) => set({ isHydrated: value }),
}

// Persist middleware option
{
  onRehydrateStorage: () => (state) => {
    state?.setHydrated(true)
  }
}
```

---

## DevTools Integration

```typescript
import { devtools } from 'zustand/middleware'

export const useCertificateStore = create<CertificateStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ... store implementation
      })),
      { name: 'certificate-store' }
    ),
    { name: 'CertificateStore' }  // Name in Redux DevTools
  )
)
```

Open Redux DevTools in browser to:
- View current state
- Time-travel through actions
- Export/import state
