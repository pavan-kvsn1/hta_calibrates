# Schema Deep Dive

## File Location

```
prisma/schema.prisma (867 lines)
```

This file defines ALL database tables, their columns, relationships, and indexes.

---

## Schema Structure Overview

```
prisma/schema.prisma
│
├── Generator & Datasource (lines 1-7)
├── User Models (lines 9-147)
│   ├── User (staff)
│   ├── CustomerUser
│   └── CustomerAccount
├── Auth Models (lines 149-220)
│   ├── AllowedGoogleEmail
│   ├── CustomerRegistration
│   └── CustomerRequest
├── Instruments (lines 222-268)
│   └── MasterInstrument
├── Certificates (lines 270-435)
│   ├── Certificate
│   ├── CertificateEvent
│   ├── CertificateRevision
│   └── ReviewFeedback
├── Parameters (lines 437-527)
│   ├── Parameter
│   ├── CalibrationResult
│   └── CertificateMasterInstrument
├── Signatures (lines 529-594)
│   ├── Signature
│   └── ApprovalToken
├── System (lines 596-818)
│   ├── AuditLog
│   ├── Notification
│   ├── OpenSignDocument
│   ├── SigningEvidence
│   ├── ChatThread/Message/Attachment
│   ├── UUCImage
│   ├── JobQueue
│   ├── RealtimeEvent
│   └── InternalRequest
```

---

## Core Models Explained

### User (Staff Members)

```prisma
model User {
  // ═══════════════════════════════════════════════════════════
  // PRIMARY KEY
  // ═══════════════════════════════════════════════════════════
  id            String   @id @default(uuid())
  // UUID v4, automatically generated
  // Example: "550e8400-e29b-41d4-a716-446655440000"

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION FIELDS
  // ═══════════════════════════════════════════════════════════
  email         String   @unique
  // Must be unique across all users
  // Used for login

  passwordHash  String?
  // Nullable - Google OAuth users won't have a password
  // Stored as bcrypt hash with cost factor 12
  // NEVER store plain text passwords

  googleId      String?  @unique
  // Google OAuth subject ID (sub claim)
  // Set when user logs in via Google

  authProvider  String   @default("PASSWORD")
  // "PASSWORD" or "GOOGLE"
  // Determines how user authenticates

  // ═══════════════════════════════════════════════════════════
  // PROFILE FIELDS
  // ═══════════════════════════════════════════════════════════
  name          String
  // Display name

  profileImageUrl String?
  // From Google profile, or uploaded

  signatureUrl  String?
  // Path to signature image in GCS

  // ═══════════════════════════════════════════════════════════
  // ROLE & PERMISSIONS
  // ═══════════════════════════════════════════════════════════
  role          String   @default("ENGINEER")
  // Possible values: "ENGINEER", "ADMIN"
  // This is the PRIMARY role field

  adminType     String?
  // Only set for ADMIN role
  // Possible values: "MASTER", "WORKER", null
  // MASTER = super admin (full control)
  // WORKER = reviewer/HoD (limited admin)

  isAdmin       Boolean  @default(false)
  // LEGACY FIELD - kept for migration
  // Use role == "ADMIN" instead

  // ═══════════════════════════════════════════════════════════
  // ORGANIZATIONAL HIERARCHY
  // ═══════════════════════════════════════════════════════════
  assignedAdminId String?
  // Which admin this engineer reports to
  // Null for admins

  assignedAdmin   User?    @relation("EngineerToAdmin", fields: [assignedAdminId], references: [id])
  // The admin user object

  engineers       User[]   @relation("EngineerToAdmin")
  // Inverse: engineers assigned to this admin
  // Only populated for admins

  // ═══════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════
  isActive      Boolean  @default(true)
  // false = account disabled, cannot login

  // ═══════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ═══════════════════════════════════════════════════════════
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // @updatedAt automatically updates on any change

  // ═══════════════════════════════════════════════════════════
  // RELATIONS (what this user owns/created)
  // ═══════════════════════════════════════════════════════════
  createdCertificates   Certificate[] @relation("CertificateCreator")
  modifiedCertificates  Certificate[] @relation("CertificateModifier")
  reviewedCertificates  Certificate[] @relation("CertificateReviewer")
  events                CertificateEvent[]    @relation("EventActor")
  // ... many more relations
}
```

**Usage in Code**:
```typescript
// Find user by email
const user = await prisma.user.findUnique({
  where: { email: 'kiran@htaipl.com' }
})

// Find all engineers assigned to an admin
const engineers = await prisma.user.findMany({
  where: { assignedAdminId: adminId }
})

// Check if user is master admin
const isMaster = user.role === 'ADMIN' && user.adminType === 'MASTER'
```

---

### CustomerUser (Customer Portal Users)

```prisma
model CustomerUser {
  id                 String   @id @default(uuid())
  email              String   @unique
  name               String
  passwordHash       String?
  // Nullable until account is activated (POC workflow)

  // ═══════════════════════════════════════════════════════════
  // COMPANY ASSOCIATION
  // ═══════════════════════════════════════════════════════════
  companyName        String?
  // DEPRECATED - use customerAccount.companyName
  // Kept for backward compatibility during migration

  customerAccountId  String?
  // Link to CustomerAccount
  // Will become required after migration

  customerAccount    CustomerAccount?  @relation("CustomerUsers", fields: [customerAccountId], references: [id])

  // ═══════════════════════════════════════════════════════════
  // POC (Primary Point of Contact) WORKFLOW
  // ═══════════════════════════════════════════════════════════
  isActive           Boolean  @default(false)
  // DEFAULT FALSE! Customer must activate account
  // Set to true after:
  // 1. Admin creates account with password, OR
  // 2. POC receives activation email and sets password

  isPoc              Boolean  @default(false)
  // Is this user the Primary Point of Contact?
  // POC can request new users, transfer POC role

  activatedAt        DateTime?
  // When user activated their account

  activationToken    String?  @unique
  // Token sent in activation email
  // Single-use, expires after activationExpiry

  activationExpiry   DateTime?
  // When activation token expires (usually 7 days)

  pocForAccount      CustomerAccount?  @relation("PrimaryPOC")
  // Inverse relation - account where this user is POC

  // ═══════════════════════════════════════════════════════════
  // TIMESTAMPS & RELATIONS
  // ═══════════════════════════════════════════════════════════
  createdAt          DateTime @default(now())
  updatedAt          DateTime @default(now()) @updatedAt

  signatures         Signature[]
  approvalTokens     ApprovalToken[]
  notifications      Notification[]
  events             CertificateEvent[]
  chatMessages       ChatMessage[]
  requestedRequests  CustomerRequest[]

  @@index([customerAccountId])
  @@index([activationToken])
}
```

**POC Workflow Explained**:
```
1. Admin creates CustomerAccount
2. Admin creates CustomerUser with isPoc=true
3. System sends activation email with token
4. Customer clicks link, sets password
5. activatedAt is set, isActive becomes true
6. POC can now:
   - Request new users (CustomerRequest type=USER_ADDITION)
   - Transfer POC role (CustomerRequest type=POC_CHANGE)
```

---

### Certificate (Core Business Object)

```prisma
model Certificate {
  id                String   @id @default(uuid())

  // ═══════════════════════════════════════════════════════════
  // IDENTIFICATION
  // ═══════════════════════════════════════════════════════════
  certificateNumber String   @unique
  // Human-readable ID, e.g., "HTA-2024-001"
  // Must be unique across all certificates

  // ═══════════════════════════════════════════════════════════
  // WORKFLOW STATUS
  // ═══════════════════════════════════════════════════════════
  status            String   @default("DRAFT")
  // State machine - see diagram below

  currentRevision   Int      @default(1)
  // Incremented each time certificate goes through review cycle

  reviewerId        String?
  // Engineer assigned to review this certificate
  // Part of peer review model

  reviewer          User?    @relation("CertificateReviewer", ...)

  // ═══════════════════════════════════════════════════════════
  // SECTION 1: CALIBRATION SUMMARY
  // ═══════════════════════════════════════════════════════════
  calibratedAt       String?
  // "LAB" or "SITE"

  srfNumber          String?
  // Service Request Form number

  srfDate            DateTime?
  dateOfCalibration  DateTime?

  calibrationTenure      Int      @default(12)
  // Months until next calibration due

  dueDateAdjustment      Int      @default(0)
  // Manual adjustment to due date (days)

  calibrationDueDate     DateTime?
  // Computed or manually set

  dueDateNotApplicable   Boolean  @default(false)
  // Some instruments don't need recalibration

  customerName           String?
  customerAddress        String?

  // ═══════════════════════════════════════════════════════════
  // SECTION 2: UUC (Unit Under Calibration) DETAILS
  // ═══════════════════════════════════════════════════════════
  uucDescription  String?
  // Instrument description

  uucMake         String?
  uucModel        String?
  uucSerialNumber String?
  uucInstrumentId String?
  // Reference to customer's instrument ID

  uucLocationName String?
  uucMachineName  String?

  // ═══════════════════════════════════════════════════════════
  // SECTION 4: ENVIRONMENTAL CONDITIONS
  // ═══════════════════════════════════════════════════════════
  ambientTemperature String?
  // e.g., "25 ± 2 °C"

  relativeHumidity   String?
  // e.g., "55 ± 10 %RH"

  // ═══════════════════════════════════════════════════════════
  // SECTION 6: REMARKS
  // ═══════════════════════════════════════════════════════════
  calibrationStatus String?
  // JSON array stored as string
  // e.g., '["Within tolerance", "Adjusted"]'

  stickerOldRemoved String?
  // "yes", "no", "na"

  stickerNewAffixed String?

  statusNotes       String?
  // Used for rejection feedback from customer

  // ═══════════════════════════════════════════════════════════
  // SECTION 7: CONCLUSION
  // ═══════════════════════════════════════════════════════════
  selectedConclusionStatements String?
  // JSON array of selected statement IDs

  additionalConclusionStatement String?
  // Custom free-text conclusion

  // ═══════════════════════════════════════════════════════════
  // WORKFLOW TRACKING
  // ═══════════════════════════════════════════════════════════
  customerApprovedAt DateTime?
  // When customer approved - used for TAT calculation

  // ═══════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdById      String
  lastModifiedById String

  createdBy        User     @relation("CertificateCreator", ...)
  lastModifiedBy   User     @relation("CertificateModifier", ...)

  // ═══════════════════════════════════════════════════════════
  // RELATED DATA
  // ═══════════════════════════════════════════════════════════
  parameters        Parameter[]
  masterInstruments CertificateMasterInstrument[]
  events            CertificateEvent[]
  revisions         CertificateRevision[]
  feedbacks         ReviewFeedback[]
  signatures        Signature[]
  approvalTokens    ApprovalToken[]
  signedPdfPath     String?
  openSignDocuments OpenSignDocument[]
  signingEvidence   SigningEvidence[]
  notifications     Notification[]
  chatThreads       ChatThread[]
  uucImages         UUCImage[]
  internalRequests  InternalRequest[]

  @@index([status])
  @@index([createdById])
  @@index([reviewerId])
}
```

---

## Certificate Status State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CERTIFICATE STATUS FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────┐                                                                 │
│   │ DRAFT  │ ◄─── Certificate created                                       │
│   └───┬────┘                                                                 │
│       │ engineer submits                                                     │
│       ▼                                                                      │
│   ┌──────────────────┐                                                       │
│   │ PENDING_REVIEW   │ ◄─── Waiting for reviewer                            │
│   └───┬──────────────┘                                                       │
│       │                                                                      │
│       ├─── reviewer approves ───────────────────────────────┐               │
│       │                                                     │               │
│       ▼                                                     ▼               │
│   ┌───────────────────────┐                    ┌──────────────────────────┐ │
│   │ REVISION_REQUIRED     │ ◄── revisions ──── │ PENDING_CUSTOMER_APPROVAL│ │
│   └───────────────────────┘     requested      └───────────┬──────────────┘ │
│       │                                                    │                │
│       │ engineer fixes                                     │                │
│       │ and resubmits                                      │                │
│       ▼                                                    │                │
│   Back to PENDING_REVIEW                                   │                │
│                                                            │                │
│                          customer approves ◄───────────────┤                │
│                                   │                        │                │
│                                   │         customer requests revision      │
│                                   │                        │                │
│                                   ▼                        ▼                │
│                    ┌─────────────────────────┐  ┌─────────────────────────┐ │
│                    │PENDING_ADMIN_AUTHORIZATN│  │CUSTOMER_REVISION_REQUIRED│ │
│                    └───────────┬─────────────┘  └─────────────────────────┘ │
│                                │                           │                │
│                                │                           │                │
│                     admin authorizes               back to engineer         │
│                                │                                            │
│                                ▼                                            │
│                         ┌────────────┐                                      │
│                         │ AUTHORIZED │                                      │
│                         └─────┬──────┘                                      │
│                               │                                             │
│                         final approval                                      │
│                               │                                             │
│                               ▼                                             │
│                         ┌──────────┐                                        │
│                         │ APPROVED │ ◄─── Certificate complete              │
│                         └──────────┘                                        │
│                                                                              │
│   ┌──────────┐                                                              │
│   │ REJECTED │ ◄─── Can happen at any review stage                         │
│   └──────────┘                                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Sourcing Model

### CertificateEvent (Immutable Log)

Every change to a certificate is recorded as an event:

```prisma
model CertificateEvent {
  id             String   @id @default(uuid())
  certificateId  String

  // ═══════════════════════════════════════════════════════════
  // ORDERING
  // ═══════════════════════════════════════════════════════════
  sequenceNumber Int
  // Monotonically increasing within certificate
  // Used to replay events in order

  revision       Int
  // Which revision cycle this event belongs to

  // ═══════════════════════════════════════════════════════════
  // EVENT DATA
  // ═══════════════════════════════════════════════════════════
  eventType      String
  // See event types below

  eventData      String
  // JSON payload (stored as string for SQLite compatibility)
  // Structure depends on eventType

  // ═══════════════════════════════════════════════════════════
  // ACTOR
  // ═══════════════════════════════════════════════════════════
  userId         String?
  // For staff events (engineer, admin)

  customerId     String?
  // For customer events

  userRole       String
  // "ENGINEER", "ADMIN", "CUSTOMER"

  createdAt      DateTime @default(now())
  // Immutable - events are never updated

  @@unique([certificateId, sequenceNumber])
  @@index([certificateId, createdAt])
  @@index([certificateId, revision])
}
```

### Event Types

| Event Type | eventData Structure | When Created |
|------------|---------------------|--------------|
| `CERTIFICATE_CREATED` | `{}` | Certificate first saved |
| `FIELD_UPDATED` | `{ field, oldValue, newValue }` | Single field changed |
| `BULK_FIELDS_UPDATED` | `{ changes: [{field, old, new}] }` | Multiple fields saved |
| `PARAMETER_ADDED` | `{ parameterId, parameterName }` | New parameter added |
| `PARAMETER_UPDATED` | `{ parameterId, changes }` | Parameter modified |
| `PARAMETER_DELETED` | `{ parameterId }` | Parameter removed |
| `STATUS_CHANGED` | `{ oldStatus, newStatus, reason? }` | Status transition |
| `SUBMITTED_FOR_REVIEW` | `{ revision }` | Engineer submits |
| `REVIEW_APPROVED` | `{ reviewerId, notes? }` | Reviewer approves |
| `REVISION_REQUESTED` | `{ reviewerId, comments }` | Reviewer requests changes |
| `SENT_TO_CUSTOMER` | `{ customerEmail }` | Sent for customer approval |
| `CUSTOMER_APPROVED` | `{ customerId, signature? }` | Customer approves |
| `CUSTOMER_REJECTED` | `{ customerId, reason }` | Customer rejects |
| `SIGNATURE_ADDED` | `{ signerType, signerName }` | Signature collected |
| `PDF_GENERATED` | `{ pdfPath }` | Final PDF created |

---

## Indexes Explained

```prisma
// On Certificate:
@@index([status])
// Fast filtering by status (dashboard queries)

@@index([createdById])
// Fast lookup of engineer's certificates

@@index([reviewerId])
// Fast lookup of certificates assigned to reviewer

// On CertificateEvent:
@@unique([certificateId, sequenceNumber])
// Ensures no duplicate sequence numbers

@@index([certificateId, createdAt])
// Fast retrieval of events in chronological order

@@index([certificateId, revision])
// Fast retrieval of events for specific revision
```

**Why These Indexes?**

```sql
-- Without index on status:
-- Full table scan (slow with 10,000+ certificates)
SELECT * FROM Certificate WHERE status = 'PENDING_REVIEW';

-- With index:
-- Index seek (fast)
SELECT * FROM Certificate WHERE status = 'PENDING_REVIEW';
```

---

## JSON Fields (SQLite Compatibility)

Several fields store JSON as strings because SQLite doesn't have native JSON type:

```prisma
// These are JSON stored as String:
calibrationStatus          String?  // '["Within tolerance"]'
selectedConclusionStatements String?  // '["STMT_001", "STMT_002"]'
rangeData                  String?  // '[{min: 0, max: 100, unit: "V"}]'
eventData                  String   // '{field: "name", oldValue: "a"}'
snapshotData              String   // Full certificate JSON snapshot
```

**Parsing in Code**:
```typescript
// Reading
const statuses = JSON.parse(certificate.calibrationStatus || '[]')

// Writing
await prisma.certificate.update({
  where: { id },
  data: {
    calibrationStatus: JSON.stringify(['Within tolerance', 'Adjusted'])
  }
})
```

**PostgreSQL Alternative** (if we drop SQLite support):
```prisma
// Could use native JSON type
calibrationStatus Json?
```

---

## Schema Validation

Run these checks when modifying schema:

```bash
# Format schema
npx prisma format

# Validate schema
npx prisma validate

# Generate client (catches type errors)
npx prisma generate

# Dry-run migration
npx prisma migrate dev --create-only
```

---

## Adding a New Field

1. **Add to schema**:
```prisma
model Certificate {
  // ... existing fields
  newField String?  // Start nullable for existing data
}
```

2. **Run migration**:
```bash
npx prisma db push  # Dev
# or
npx prisma migrate dev --name add_new_field  # With migration file
```

3. **Update seed if needed**:
```typescript
// prisma/seed.ts
await prisma.certificate.create({
  data: {
    // ... existing
    newField: 'default value',
  }
})
```

4. **Update TypeScript types** (auto-generated by Prisma):
```bash
npx prisma generate
```

5. **Use in code**:
```typescript
const cert = await prisma.certificate.findUnique({ where: { id } })
console.log(cert.newField)  // TypeScript knows about it
```
