# Current Codebase Structure (Reference)

## Architecture Pattern

The codebase uses a **hybrid component organization**:
- **Shared/reusable components** → `src/components/`
- **Feature-specific components** → Co-located with pages (valid Next.js pattern)

## File Counts

| Directory | Count | Description |
|-----------|-------|-------------|
| src/app/ pages | ~37 page.tsx | Next.js pages |
| src/app/api/ | 46 route.ts | API endpoints |
| src/components/ | 40 files | Shared components |
| src/lib/ | 13 files | Utilities and services |
| Co-located components | ~20 files | Feature-specific (in page folders) |

## Route Structure

```
app/
├── (auth)/                 # Route group → URL: /login, /customer/login
│   ├── login/
│   └── customer/login/
├── (dashboard)/            # Route group → URL: /dashboard, /hod/...
│   ├── dashboard/          # → /dashboard
│   ├── hod/                # → /hod/dashboard, /hod/review/[id]
│   └── notifications/      # → /notifications
├── admin/                  # Regular → URL: /admin/...
│   ├── authorization/
│   ├── certificates/
│   ├── customers/
│   ├── instruments/
│   ├── registrations/
│   └── users/
├── certificates/           # Regular → URL: /certificates/...
│   ├── new/
│   └── [id]/edit/
├── customer/               # Regular → URL: /customer/...
│   ├── dashboard/
│   ├── register/
│   └── review/
└── api/                    # API routes
```

## Shared Components (`src/components/`)

```
components/
├── admin/
│   └── AdminSidebar.tsx
├── dashboard/
│   ├── CertificateTable.tsx
│   ├── CustomerCertificateTable.tsx
│   ├── DashboardHeader.tsx
│   └── StatusBadge.tsx
├── feedback/
│   ├── CustomerFeedbackSidebar.tsx
│   ├── FeedbackSidebar.tsx
│   └── HistorySidebar.tsx
├── forms/
│   ├── ConclusionSection.tsx
│   ├── EnvironmentalSection.tsx
│   ├── FinalizeSection.tsx
│   ├── FormSection.tsx
│   ├── MasterInstrumentSection.tsx
│   ├── RemarksSection.tsx
│   ├── ResultsSection.tsx
│   ├── SummarySection.tsx
│   └── UUCSection.tsx
├── layout/
│   ├── CustomerHeader.tsx
│   └── Header.tsx
├── notifications/
│   ├── NotificationBell.tsx
│   ├── NotificationDropdown.tsx
│   └── NotificationItem.tsx
├── pdf/
│   ├── CalibrationCertificatePDF.tsx
│   ├── index.ts
│   ├── logo-base64.ts
│   ├── pdf-layout.ts
│   ├── PDFPreviewSection.tsx
│   ├── pdf-two-pass.ts
│   ├── pdf-utils.ts
│   └── watermark-base64.ts
├── providers/
│   └── session-provider.tsx
├── signatures/
│   ├── SignatureCanvas.tsx
│   ├── SignatureModal.tsx
│   └── TypedSignature.tsx
└── ui/                     # shadcn/ui primitives
    └── (12 files)
```

## Co-located Components (Feature-Specific)

### HoD Review Feature
Location: `src/app/(dashboard)/hod/review/[id]/`
```
├── ApproveModal.tsx
├── CustomerRevisionStatus.tsx
├── CustomerShareSection.tsx
├── PDFPreviewButton.tsx
├── ReviewActions.tsx
├── ReviewContent.tsx
├── ReviewPageClient.tsx
├── ReviewPageWrapper.tsx
└── SentToCustomerStatus.tsx
```
*All used only within this feature - correctly co-located*

### Customer Dashboard Feature
Location: `src/app/customer/dashboard/components/`
```
├── AuthorizedTable.tsx
├── AwaitingResponseTable.tsx
├── CompletedTable.tsx
├── DashboardClient.tsx
├── PendingReviewTable.tsx
├── Sidebar.tsx
└── TraceabilityTable.tsx
```
*All used only within this feature - correctly co-located*

### Customer Review Feature
Location: `src/app/customer/review/[token]/`
```
├── CustomerPDFViewer.tsx
└── CustomerReviewClient.tsx  ⚠️ Used in 2 places - should be shared
```

## Library Files (`src/lib/`)

```
lib/
├── auth.ts                    # NextAuth configuration
├── certificate-store.ts       # Certificate business logic (23KB)
├── consent-text.ts            # Static consent text
├── master-instruments.ts      # Master instrument utilities
├── master-instrument-store.ts # Store logic
├── notifications.ts           # Notification service (13KB)
├── opensign.ts                # OpenSign integration
├── pdf-generator.ts           # Server-side PDF generation
├── pdf-storage.ts             # PDF storage
├── prisma.ts                  # Prisma client
├── signing-evidence.ts        # Signing evidence chain
└── utils.ts                   # General utilities
```

## Issues Identified

| Issue | Location | Priority |
|-------|----------|----------|
| `CustomerReviewClient.tsx` shared but not in components/ | customer/review/[token]/ | Medium |
| `certificate-store.ts` large (23KB) | lib/ | Low |
| `lib/` mixes services/stores/utils | lib/ | Low |
