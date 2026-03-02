# Repository Refactoring Plan (Revised)

## Executive Summary

After re-analysis, the codebase structure is **mostly correct**. The initial assessment incorrectly flagged several patterns as issues when they're actually valid Next.js App Router conventions.

**What's Actually Fine:**
- Route groups used correctly (`(auth)`, `(dashboard)`)
- Regular folders used correctly for URL paths (`admin/`, `customer/`)
- Co-locating feature-specific components with pages is a valid pattern

**What Could Be Improved:**
- One shared component (`CustomerReviewClient`) should be moved
- Large files could be split for maintainability
- `lib/` folder could be better organized

## Minimal Changes (Recommended)

### Change 1: Move Shared Component

**Issue:** `CustomerReviewClient.tsx` is used in two places but sits in one feature folder.

**Current:**
```
src/app/customer/review/[token]/CustomerReviewClient.tsx
  └── Used by: [token]/page.tsx AND cert/[id]/page.tsx
```

**Action:**
```
Move to: src/components/customer/CustomerReviewClient.tsx
Update imports in:
  - src/app/customer/review/[token]/page.tsx
  - src/app/customer/review/cert/[id]/page.tsx
```

### Change 2: (Optional) Organize `lib/` folder

**Current:**
```
lib/
├── auth.ts
├── certificate-store.ts
├── consent-text.ts
├── master-instruments.ts
├── master-instrument-store.ts
├── notifications.ts
├── opensign.ts
├── pdf-generator.ts
├── pdf-storage.ts
├── prisma.ts
├── signing-evidence.ts
└── utils.ts
```

**Proposed:**
```
lib/
├── prisma.ts                    # Keep at root - core infrastructure
├── auth.ts                      # Keep at root - core infrastructure
├── utils.ts                     # Keep at root - general utilities
├── services/
│   ├── opensign.ts              # External service integration
│   ├── notifications.ts         # Notification service
│   └── pdf/
│       ├── generator.ts         # PDF generation
│       └── storage.ts           # PDF storage
├── stores/
│   ├── certificate-store.ts     # Certificate business logic
│   ├── master-instrument-store.ts
│   └── signing-evidence.ts
└── constants/
    └── consent-text.ts          # Static constants
```

### Change 3: (Optional) Split Large Files

**`certificate-store.ts` (23KB)** could be split:
```
stores/certificate/
├── index.ts           # Re-exports
├── types.ts           # CertificateFormData and related types
├── queries.ts         # Read operations
├── mutations.ts       # Write operations
└── utils.ts           # Helper functions
```

## Components Organization

### Current Component Architecture

The codebase uses a **hybrid component organization pattern**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT ORGANIZATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  src/components/          │  src/app/**/                        │
│  (Shared Components)      │  (Co-located Components)            │
│                           │                                      │
│  • Used across multiple   │  • Used only within one feature     │
│    features or pages      │  • Tightly coupled to the page      │
│  • Generic/reusable       │  • Feature-specific logic           │
│  • Domain-agnostic UI     │  • May have page-specific props     │
│                           │                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Shared Components (`src/components/`)

```
components/
│
├── ui/                         # Primitive UI components (shadcn/ui)
│   ├── button.tsx              # Base button component
│   ├── input.tsx               # Form input
│   ├── card.tsx                # Card container
│   ├── table.tsx               # Data table
│   ├── badge.tsx               # Status badges
│   ├── checkbox.tsx            # Checkbox input
│   ├── select.tsx              # Dropdown select
│   ├── textarea.tsx            # Multiline input
│   ├── label.tsx               # Form labels
│   ├── radio-group.tsx         # Radio button group
│   ├── separator.tsx           # Visual divider
│   └── alert-dialog.tsx        # Modal dialogs
│
├── layout/                     # App-wide layout components
│   ├── Header.tsx              # Staff portal header (dashboard, hod)
│   └── CustomerHeader.tsx      # Customer portal header
│
├── dashboard/                  # Dashboard components (used by multiple dashboards)
│   ├── CertificateTable.tsx    # Certificate list table (engineer)
│   ├── CustomerCertificateTable.tsx  # Customer's certificate view
│   ├── DashboardHeader.tsx     # Dashboard page header
│   └── StatusBadge.tsx         # Certificate status indicator
│
├── forms/                      # Certificate form sections
│   ├── FormSection.tsx         # Base section wrapper
│   ├── SummarySection.tsx      # Certificate summary fields
│   ├── UUCSection.tsx          # Unit Under Calibration
│   ├── EnvironmentalSection.tsx # Environmental conditions
│   ├── MasterInstrumentSection.tsx # Master instruments used
│   ├── ResultsSection.tsx      # Calibration results
│   ├── RemarksSection.tsx      # Remarks/notes
│   ├── ConclusionSection.tsx   # Conclusion fields
│   └── FinalizeSection.tsx     # Final submission
│
├── pdf/                        # PDF generation components
│   ├── CalibrationCertificatePDF.tsx  # Main PDF template
│   ├── PDFPreviewSection.tsx   # PDF preview wrapper
│   ├── pdf-layout.ts           # Layout utilities
│   ├── pdf-utils.ts            # Helper functions
│   ├── pdf-two-pass.ts         # Two-pass rendering logic
│   ├── logo-base64.ts          # Company logo asset
│   ├── watermark-base64.ts     # Watermark asset
│   └── index.ts                # Exports
│
├── signatures/                 # Signature capture components
│   ├── SignatureCanvas.tsx     # Draw signature pad
│   ├── SignatureModal.tsx      # Signature capture modal
│   └── TypedSignature.tsx      # Type-to-sign option
│
├── notifications/              # Notification UI components
│   ├── NotificationBell.tsx    # Header notification icon
│   ├── NotificationDropdown.tsx # Notification list dropdown
│   └── NotificationItem.tsx    # Single notification row
│
├── feedback/                   # Feedback/chat sidebars
│   ├── FeedbackSidebar.tsx     # General feedback panel
│   ├── CustomerFeedbackSidebar.tsx # Customer-specific feedback
│   └── HistorySidebar.tsx      # Message history panel
│
├── admin/                      # Admin panel components
│   └── AdminSidebar.tsx        # Admin navigation sidebar
│
└── providers/                  # React context providers
    └── session-provider.tsx    # NextAuth session wrapper
```

### Co-located Components (Feature-Specific)

These components are intentionally placed alongside their pages because they:
- Are only used within a single feature
- Have tight coupling to page-specific data/logic
- Would not be reused elsewhere

#### HoD Review Feature
Location: `src/app/(dashboard)/hod/review/[id]/`

```
[id]/
├── page.tsx                    # Main page (server component)
│
├── ReviewPageWrapper.tsx       # Client wrapper, manages state
│   └── Uses: ReviewContent
│
├── ReviewContent.tsx           # Main content area (58KB)
│   ├── Displays certificate data in readonly view
│   ├── Uses: ReviewActions, PDFPreviewButton
│   └── Handles tab navigation (Details, Results, etc.)
│
├── ReviewActions.tsx           # Action buttons panel (33KB)
│   ├── Submit for HOD approval
│   ├── Request revision
│   ├── Send to customer
│   └── Uses: ApproveModal
│
├── ApproveModal.tsx            # HOD approval modal (15KB)
│   ├── Signature capture
│   ├── Consent checkbox
│   └── Submit approval
│
├── PDFPreviewButton.tsx        # PDF preview trigger (10KB)
│   └── Opens PDF in modal/new tab
│
├── CustomerShareSection.tsx    # Customer sharing UI (8KB)
│   └── Email input, send button
│
├── CustomerRevisionStatus.tsx  # Customer feedback display (40KB)
│   ├── Shows customer messages
│   ├── Revision request details
│   └── Response input
│
├── SentToCustomerStatus.tsx    # Sent status display (10KB)
│   └── Shows when/who sent to customer
│
└── ReviewPageClient.tsx        # Legacy client component (1KB)
```

**Why co-located:** These components form a cohesive feature unit. They share complex state (certificate data, approval flow), have interdependencies, and are never used outside the HoD review flow.

#### Customer Dashboard Feature
Location: `src/app/customer/dashboard/components/`

```
components/
├── DashboardClient.tsx         # Main dashboard orchestrator
│   ├── Tab navigation
│   ├── Data fetching
│   └── Uses all table components below
│
├── Sidebar.tsx                 # Dashboard sidebar navigation
│   └── Links, company info
│
├── PendingReviewTable.tsx      # Certificates awaiting review
│   └── View, approve actions
│
├── AwaitingResponseTable.tsx   # Certificates with messages
│   └── View, respond actions
│
├── AuthorizedTable.tsx         # Fully authorized certificates
│   └── Download PDF action
│
├── CompletedTable.tsx          # Completed certificates
│   └── Historical view
│
└── TraceabilityTable.tsx       # Traceability records
    └── Reference number lookup
```

**Why co-located:** Customer dashboard is self-contained. The table components share the same data structure and are orchestrated by DashboardClient. They won't be reused in staff dashboards.

#### Customer Review Feature
Location: `src/app/customer/review/[token]/`

```
[token]/
├── page.tsx                    # Token-based review page
├── CustomerReviewClient.tsx    # Review UI ⚠️ SHARED (used in 2 places)
└── CustomerPDFViewer.tsx       # PDF display component
```

**Issue identified:** `CustomerReviewClient.tsx` is imported by both:
- `src/app/customer/review/[token]/page.tsx`
- `src/app/customer/review/cert/[id]/page.tsx`

This violates the co-location principle and should be moved to `src/components/customer/`.

### Component Placement Guidelines

When adding new components, use this decision tree:

```
Is this component used by multiple features/pages?
│
├── YES → Place in src/components/
│         └── Group by domain (pdf/, signatures/, admin/)
│
└── NO → Is it tightly coupled to page-specific logic?
         │
         ├── YES → Co-locate with the page
         │         └── Create components/ subfolder if >3 files
         │
         └── NO → Could it be reused in the future?
                  │
                  ├── LIKELY → Place in src/components/
                  └── UNLIKELY → Co-locate with page
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Page components | `*Client.tsx`, `*Wrapper.tsx` | `DashboardClient.tsx` |
| Feature components | `*Section.tsx`, `*Panel.tsx` | `SummarySection.tsx` |
| UI primitives | lowercase | `button.tsx`, `input.tsx` |
| Modals | `*Modal.tsx` | `ApproveModal.tsx` |
| Tables | `*Table.tsx` | `AuthorizedTable.tsx` |
| Sidebars | `*Sidebar.tsx` | `AdminSidebar.tsx` |

## What NOT to Change

### Keep Route Structure As-Is
```
app/
├── (auth)/        ✓ Route group - URL: /login
├── (dashboard)/   ✓ Route group - URL: /dashboard, /hod/...
├── admin/         ✓ Regular folder - URL: /admin/...
├── customer/      ✓ Regular folder - URL: /customer/...
└── certificates/  ✓ Regular folder - URL: /certificates/...
```

### Keep Co-located Components
These are feature-specific and only used within their features:

**HoD Review (`src/app/(dashboard)/hod/review/[id]/`):**
- ReviewContent.tsx, ReviewActions.tsx, ApproveModal.tsx, etc.
- All used only within this feature - keep co-located

**Customer Dashboard (`src/app/customer/dashboard/components/`):**
- DashboardClient.tsx, AuthorizedTable.tsx, PendingReviewTable.tsx, etc.
- All used only within this feature - keep co-located

## Implementation

### If Only Doing Minimal Changes:

1. Move `CustomerReviewClient.tsx`:
   ```bash
   mkdir -p src/components/customer
   mv src/app/customer/review/[token]/CustomerReviewClient.tsx src/components/customer/
   ```

2. Update imports in affected files

3. Run build to verify: `npm run build`

### If Doing Full Reorganization:

1. Create new folder structure in `lib/`
2. Move files one at a time
3. Update imports after each move
4. Run TypeScript check after each change
5. Run build at the end

## Conclusion

The codebase follows reasonable conventions. The main issue is just one misplaced shared component. The other changes (reorganizing `lib/`, splitting large files) are optional improvements for maintainability, not corrections of problems.

**Priority:**
1. **High:** Move `CustomerReviewClient.tsx` (fixes actual inconsistency)
2. **Low:** Reorganize `lib/` (nice to have)
3. **Low:** Split large files (nice to have)
