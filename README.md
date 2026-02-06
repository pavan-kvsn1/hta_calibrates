# HTA Calibration Certificate Management System

A web application for managing calibration certificates, including multi-stage approval workflows, digital signatures, and PDF generation.

## Features

### Certificate Management
- Create and edit calibration certificates with comprehensive form sections
- Support for multiple calibration parameters with measurement results
- Master instrument tracking and assignment
- Event sourcing for complete audit trail of all changes

### Approval Workflow
- **Engineer** → Creates and submits certificates for review
- **Head of Department (HoD)** → Reviews, approves, requests revisions, or rejects
- **Customer** → Reviews and approves certificates via secure token links or dashboard

### Digital Signatures
- Canvas-based signature capture for HoD and customer approval
- Signatures embedded directly in generated PDFs
- Signature storage with signer metadata and timestamps

### PDF Generation
- Dynamic calibration certificate PDF generation using `@react-pdf/renderer`
- Two-pass rendering with binary search for optimal spacing
- Signature blocks with embedded images
- Customer acknowledgment section

### Signed PDF Storage & Download
- Server-side PDF generation after customer approval
- Filesystem storage under `uploads/certificates/{id}/signed.pdf`
- Auth-gated download endpoint for engineers, HoD, and customers

### Notifications
- Real-time notification system for workflow events
- Bell icon with unread count in navigation
- Notifications for: submissions, approvals, revisions, customer actions

### OpenSign Integration (Optional)
- Integration with self-hosted OpenSign for legally compliant e-signatures
- Best-effort digital signing with fallback to local signatures
- Webhook handler for signing completion events
- Health check and retry endpoints

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js
- **PDF Generation**: @react-pdf/renderer
- **UI Components**: Tailwind CSS, Radix UI, Lucide Icons
- **Form Handling**: React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/pavan-kvsn1/hta_calibrates.git
cd hta_calibrates

# Install dependencies
npm install

# Set up the database
npx prisma generate
npx prisma migrate dev

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenSign (optional - for digital signing)
OPENSIGN_SERVER_URL="http://localhost:8080/app"
OPENSIGN_API_KEY="your-opensign-api-key"

# App URL (for email links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/           # Staff dashboard routes
│   │   ├── engineer/          # Engineer pages
│   │   └── hod/               # HoD pages (dashboard, review)
│   ├── api/                   # API routes
│   │   ├── certificates/      # Certificate CRUD, review, download
│   │   ├── customer/          # Customer approval endpoints
│   │   ├── notifications/     # Notification endpoints
│   │   └── opensign/          # OpenSign integration
│   ├── certificates/          # Certificate view/edit pages
│   └── customer/              # Customer portal
├── components/
│   ├── dashboard/             # Dashboard components
│   ├── feedback/              # Review feedback sidebars
│   ├── forms/                 # Certificate form sections
│   ├── notifications/         # Notification components
│   ├── pdf/                   # PDF generation components
│   └── signatures/            # Signature capture components
├── lib/
│   ├── auth.ts                # NextAuth configuration
│   ├── notifications.ts       # Notification helpers
│   ├── opensign.ts            # OpenSign API client
│   ├── pdf-generator.ts       # Server-side PDF generation
│   ├── pdf-storage.ts         # PDF filesystem storage
│   └── prisma.ts              # Prisma client
└── types/                     # TypeScript type definitions
```

## Database Schema

Key models:

- **User** - Staff users (Engineer, HoD, Admin)
- **CustomerUser** - Customer accounts
- **Certificate** - Calibration certificates with all form data
- **CertificateEvent** - Immutable event log (event sourcing)
- **CertificateRevision** - Snapshots at workflow transitions
- **Parameter** - Calibration parameters with results
- **Signature** - Stored signatures (Engineer, HoD, Customer)
- **ApprovalToken** - Secure tokens for customer review links
- **Notification** - User notifications
- **OpenSignDocument** - OpenSign integration tracking

## User Roles

| Role | Capabilities |
|------|-------------|
| **Engineer** | Create certificates, submit for review, respond to revision requests |
| **HoD** | Review submissions, approve/reject/request revisions, send to customers, override dates |
| **Admin** | All HoD capabilities + user management |
| **Customer** | View assigned certificates, approve or request revisions |

## Workflow States

```
DRAFT
  ↓ (Engineer submits)
PENDING_HOD_REVIEW
  ↓ (HoD approves)        → REVISION_REQUIRED (back to Engineer)
  ↓                       → REJECTED (terminal)
PENDING_CUSTOMER_APPROVAL
  ↓ (Customer approves)   → CUSTOMER_REVISION_REQUIRED (HoD responds)
  ↓
APPROVED (terminal - signed PDF generated)
```

## API Endpoints

### Certificates
- `POST /api/certificates` - Create certificate
- `GET /api/certificates/[id]` - Get certificate
- `PUT /api/certificates/[id]` - Update certificate
- `POST /api/certificates/[id]/submit` - Submit for review
- `POST /api/certificates/[id]/review` - HoD review action
- `POST /api/certificates/[id]/send-to-customer` - Send to customer
- `GET /api/certificates/[id]/download-signed` - Download signed PDF

### Customer
- `GET /api/customer/review/[token]/certificate` - Get certificate data
- `POST /api/customer/review/[token]/approve` - Approve certificate
- `POST /api/customer/review/[token]/reject` - Request revision

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/mark-read` - Mark as read
- `GET /api/notifications/unread-count` - Get unread count

### OpenSign (optional)
- `POST /api/opensign/send-for-signature` - Send to OpenSign
- `POST /api/opensign/webhook` - Webhook handler
- `GET /api/opensign/health` - Health check
- `POST /api/opensign/retry` - Retry failed signings

## Development

```bash
# Run development server
npm run dev

# Run type checking
npx tsc --noEmit

# Run Prisma Studio (database GUI)
npx prisma studio

# Create a migration
npx prisma migrate dev --name migration-name

# Reset database
npx prisma migrate reset
```

## License

Proprietary - HTA Instrumentation
