# Secrets & Credentials Management

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Priority**: CRITICAL - Read this carefully!
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Why This Document Matters

**Secrets management is one of the most critical aspects of your application security.** A single leaked API key or database password can lead to:
- Complete data breach
- Financial losses
- Legal liability
- Reputation damage
- Regulatory fines

This document explains how to handle secrets properly.

---

## Part 1: What Are Secrets?

### Types of Secrets in HTA Calibration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TYPES OF SECRETS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYSTEM-LEVEL SECRETS (Shared across all tenants)                           │
│  ════════════════════════════════════════════════                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  DATABASE CREDENTIALS                                                │   │
│  │  • DATABASE_URL (connection string with password)                    │   │
│  │  • DATABASE_PASSWORD (if separate)                                   │   │
│  │                                                                      │   │
│  │  AUTHENTICATION SECRETS                                              │   │
│  │  • NEXTAUTH_SECRET (encrypts session cookies)                        │   │
│  │  • JWT_SIGNING_KEY (signs authentication tokens)                     │   │
│  │                                                                      │   │
│  │  INFRASTRUCTURE CREDENTIALS                                          │   │
│  │  • GCP_SERVICE_ACCOUNT_KEY (cloud access)                            │   │
│  │  • ENCRYPTION_MASTER_KEY (data encryption)                           │   │
│  │                                                                      │   │
│  │  EXTERNAL SERVICE CREDENTIALS                                        │   │
│  │  • SMTP_PASSWORD (email sending)                                     │   │
│  │  • OPENSIGN_API_KEY (digital signatures)                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TENANT-SPECIFIC SECRETS (Per customer)                                     │
│  ══════════════════════════════════════                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Each tenant might have:                                             │   │
│  │                                                                      │   │
│  │  TENANT: ACME Corp                                                   │   │
│  │  ├── acme-opensign-api-key      (their own OpenSign account)         │   │
│  │  ├── acme-smtp-credentials      (their own email server)             │   │
│  │  ├── acme-webhook-secret        (for webhook verification)           │   │
│  │  ├── acme-sso-client-secret     (Single Sign-On integration)         │   │
│  │  └── acme-encryption-key        (tenant-specific encryption)         │   │
│  │                                                                      │   │
│  │  TENANT: Globex Inc                                                  │   │
│  │  ├── globex-opensign-api-key                                         │   │
│  │  ├── globex-ldap-bind-password  (Active Directory integration)       │   │
│  │  └── globex-webhook-secret                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  USER-LEVEL SECRETS                                                         │
│  ══════════════════                                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  • User passwords (hashed, never stored in plain text!)              │   │
│  │  • API tokens (for programmatic access)                              │   │
│  │  • 2FA secrets (TOTP seeds)                                          │   │
│  │                                                                      │   │
│  │  NOTE: User passwords go in the DATABASE (hashed with bcrypt)        │   │
│  │  NOT in Secret Manager. They're handled differently.                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: The WRONG Way (Don't Do This!)

### Common Mistakes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ❌ MISTAKES THAT LEAK SECRETS ❌                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MISTAKE 1: Hardcoding in Source Code                                       │
│  ════════════════════════════════════                                       │
│                                                                             │
│  // ❌ NEVER DO THIS!                                                       │
│  const dbConnection = {                                                     │
│    host: 'db.example.com',                                                  │
│    password: 'super_secret_password_123'  // EXPOSED IN GIT!               │
│  }                                                                          │
│                                                                             │
│  WHY BAD:                                                                   │
│  • Anyone with repo access sees it                                          │
│  • Ends up in Git history forever                                           │
│  • If repo is public/leaked, password is compromised                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISTAKE 2: Committing .env Files                                           │
│  ════════════════════════════════                                           │
│                                                                             │
│  # .env file (committed to git)                                             │
│  DATABASE_URL=postgresql://admin:password123@db.com/hta                     │
│  API_KEY=sk_live_abc123                                                     │
│                                                                             │
│  WHY BAD:                                                                   │
│  • Same as hardcoding - visible in Git                                      │
│  • .env should ALWAYS be in .gitignore                                      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISTAKE 3: Logging Secrets                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  // ❌ NEVER DO THIS!                                                       │
│  console.log('Connecting with:', process.env.DATABASE_URL)                  │
│  logger.info('API Key:', apiKey)                                            │
│                                                                             │
│  WHY BAD:                                                                   │
│  • Secrets appear in log files                                              │
│  • Log aggregation services store them                                      │
│  • Support staff can see them                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISTAKE 4: Passing Secrets in URLs                                         │
│  ════════════════════════════════════                                       │
│                                                                             │
│  // ❌ NEVER DO THIS!                                                       │
│  fetch(`https://api.example.com/data?api_key=${apiKey}`)                    │
│                                                                             │
│  WHY BAD:                                                                   │
│  • URLs are logged by web servers                                           │
│  • Appear in browser history                                                │
│  • Visible in network monitoring                                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISTAKE 5: Using Same Secrets Everywhere                                   │
│  ══════════════════════════════════════                                     │
│                                                                             │
│  Dev, Staging, Production all use:                                          │
│  DATABASE_PASSWORD=production_password                                      │
│                                                                             │
│  WHY BAD:                                                                   │
│  • Developer with dev access has production access                          │
│  • Breach in one environment compromises all                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: The RIGHT Way - Google Secret Manager

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SECRET MANAGER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│   Developer                    GCP Console                                  │
│   ┌─────────┐                 ┌─────────────────────────────────────────┐  │
│   │         │  Creates/       │                                         │  │
│   │   You   │──Updates───────▶│        Google Secret Manager            │  │
│   │         │  secrets        │                                         │  │
│   └─────────┘                 │  ┌─────────────────────────────────┐   │  │
│                               │  │  project: hta-calibration-prod   │   │  │
│                               │  │                                   │   │  │
│                               │  │  secrets/                         │   │  │
│                               │  │  ├── database-url                 │   │  │
│                               │  │  │   └── versions/                │   │  │
│                               │  │  │       ├── 1 (disabled)         │   │  │
│                               │  │  │       ├── 2 (disabled)         │   │  │
│                               │  │  │       └── 3 (latest/active)    │   │  │
│                               │  │  │                                │   │  │
│                               │  │  ├── nextauth-secret              │   │  │
│                               │  │  ├── smtp-password                │   │  │
│                               │  │  │                                │   │  │
│                               │  │  └── tenants/                     │   │  │
│                               │  │      ├── acme/                    │   │  │
│                               │  │      │   └── opensign-key         │   │  │
│                               │  │      └── globex/                  │   │  │
│                               │  │          └── opensign-key         │   │  │
│                               │  │                                   │   │  │
│                               │  └─────────────────────────────────┘   │  │
│                               │                                         │  │
│                               │  Features:                              │  │
│                               │  • Encrypted at rest (AES-256)          │  │
│                               │  • Encrypted in transit (TLS)           │  │
│                               │  • Automatic replication                │  │
│                               │  • Version history                      │  │
│                               │  • Access audit logging                 │  │
│                               │                                         │  │
│                               └─────────────────────────────────────────┘  │
│                                              │                              │
│                                              │ Secrets are accessed         │
│                                              │ at RUNTIME (not build time)  │
│                                              ▼                              │
│                               ┌─────────────────────────────────────────┐  │
│                               │         GKE Kubernetes Cluster          │  │
│                               │                                         │  │
│                               │  ┌─────────────────────────────────┐   │  │
│                               │  │  External Secrets Operator       │   │  │
│                               │  │  (syncs secrets to K8s)          │   │  │
│                               │  └───────────────┬─────────────────┘   │  │
│                               │                  │                      │  │
│                               │                  ▼                      │  │
│                               │  ┌─────────────────────────────────┐   │  │
│                               │  │  Kubernetes Secrets              │   │  │
│                               │  │  (injected as env vars)          │   │  │
│                               │  └───────────────┬─────────────────┘   │  │
│                               │                  │                      │  │
│                               │                  ▼                      │  │
│                               │  ┌─────────────────────────────────┐   │  │
│                               │  │  Your Application Pod            │   │  │
│                               │  │                                   │   │  │
│                               │  │  process.env.DATABASE_URL        │   │  │
│                               │  │  process.env.NEXTAUTH_SECRET     │   │  │
│                               │  │                                   │   │  │
│                               │  └─────────────────────────────────┘   │  │
│                               │                                         │  │
│                               └─────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Creating Secrets (Step by Step)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CREATING SECRETS - STEP BY STEP                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  METHOD 1: GCP Console (UI)                                                 │
│  ═════════════════════════                                                  │
│                                                                             │
│  1. Go to: console.cloud.google.com                                         │
│  2. Navigate to: Security → Secret Manager                                  │
│  3. Click: "Create Secret"                                                  │
│  4. Enter:                                                                  │
│     • Name: database-url                                                    │
│     • Value: postgresql://user:pass@host:5432/db                            │
│  5. Click: "Create"                                                         │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  METHOD 2: gcloud CLI (Recommended for automation)                          │
│  ══════════════════════════════════════════════════                         │
│                                                                             │
│  # Create a secret                                                          │
│  echo -n "postgresql://user:pass@host:5432/db" | \                          │
│    gcloud secrets create database-url \                                     │
│    --data-file=- \                                                          │
│    --project=hta-calibration-prod                                           │
│                                                                             │
│  # Add a new version (rotate password)                                      │
│  echo -n "postgresql://user:NEW_PASS@host:5432/db" | \                      │
│    gcloud secrets versions add database-url \                               │
│    --data-file=-                                                            │
│                                                                             │
│  # Access a secret (for testing)                                            │
│  gcloud secrets versions access latest \                                    │
│    --secret=database-url \                                                  │
│    --project=hta-calibration-prod                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  METHOD 3: Terraform (Infrastructure as Code)                               │
│  ═════════════════════════════════════════════                              │
│                                                                             │
│  # terraform/modules/secrets/main.tf                                        │
│                                                                             │
│  resource "google_secret_manager_secret" "database_url" {                   │
│    secret_id = "database-url"                                               │
│    project   = var.project_id                                               │
│                                                                             │
│    replication {                                                            │
│      auto {}                                                                │
│    }                                                                        │
│                                                                             │
│    labels = {                                                               │
│      environment = "production"                                             │
│      managed_by  = "terraform"                                              │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  # Note: The actual secret VALUE is added manually or via CI/CD             │
│  # Never put secret values in Terraform code!                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Multi-Tenant Secret Management

### Per-Tenant Secrets Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT SECRETS ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SECRET NAMING CONVENTION:                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  System secrets:    {secret-name}                                           │
│  Tenant secrets:    tenant-{tenant-id}-{secret-name}                        │
│                                                                             │
│  EXAMPLES:                                                                  │
│  ─────────                                                                  │
│  database-url                        (system)                               │
│  nextauth-secret                     (system)                               │
│  tenant-acme-opensign-key            (tenant: acme)                         │
│  tenant-acme-webhook-secret          (tenant: acme)                         │
│  tenant-globex-opensign-key          (tenant: globex)                       │
│  tenant-globex-sso-client-secret     (tenant: globex)                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SECRET ORGANIZATION IN SECRET MANAGER:                                     │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│  hta-calibration-prod (project)                                             │
│  │                                                                          │
│  ├── SYSTEM SECRETS                                                         │
│  │   ├── database-url                                                       │
│  │   ├── nextauth-secret                                                    │
│  │   ├── jwt-signing-key                                                    │
│  │   ├── smtp-host                                                          │
│  │   ├── smtp-password                                                      │
│  │   └── master-encryption-key                                              │
│  │                                                                          │
│  ├── TENANT: ACME CORP (tenant-id: acme)                                    │
│  │   ├── tenant-acme-opensign-api-key                                       │
│  │   ├── tenant-acme-smtp-password        (if they have custom SMTP)        │
│  │   ├── tenant-acme-webhook-secret                                         │
│  │   └── tenant-acme-encryption-key       (for tenant data encryption)      │
│  │                                                                          │
│  ├── TENANT: GLOBEX INC (tenant-id: globex)                                 │
│  │   ├── tenant-globex-opensign-api-key                                     │
│  │   ├── tenant-globex-ldap-password      (AD integration)                  │
│  │   ├── tenant-globex-sso-client-secret                                    │
│  │   └── tenant-globex-webhook-secret                                       │
│  │                                                                          │
│  └── TENANT: WAYNE TECH (tenant-id: wayne)                                  │
│      ├── tenant-wayne-opensign-api-key                                      │
│      └── tenant-wayne-webhook-secret                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Accessing Tenant Secrets in Code

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACCESSING TENANT SECRETS IN CODE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // src/lib/secrets/tenant-secrets.ts                                       │
│                                                                             │
│  import { SecretManagerServiceClient } from '@google-cloud/secret-manager'; │
│                                                                             │
│  const client = new SecretManagerServiceClient();                           │
│                                                                             │
│  // Cache for performance (secrets don't change often)                      │
│  const secretCache = new Map<string, { value: string; expiresAt: number }>()│
│  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes                              │
│                                                                             │
│  export async function getTenantSecret(                                     │
│    tenantId: string,                                                        │
│    secretName: string                                                       │
│  ): Promise<string> {                                                       │
│    // Build the secret name                                                 │
│    const fullSecretName = `tenant-${tenantId}-${secretName}`;               │
│    const cacheKey = fullSecretName;                                         │
│                                                                             │
│    // Check cache first                                                     │
│    const cached = secretCache.get(cacheKey);                                │
│    if (cached && cached.expiresAt > Date.now()) {                           │
│      return cached.value;                                                   │
│    }                                                                        │
│                                                                             │
│    // Fetch from Secret Manager                                             │
│    const projectId = process.env.GCP_PROJECT_ID;                            │
│    const name = `projects/${projectId}/secrets/${fullSecretName}/versions/latest`;│
│                                                                             │
│    try {                                                                    │
│      const [version] = await client.accessSecretVersion({ name });          │
│      const value = version.payload?.data?.toString() || '';                 │
│                                                                             │
│      // Cache the result                                                    │
│      secretCache.set(cacheKey, {                                            │
│        value,                                                               │
│        expiresAt: Date.now() + CACHE_TTL                                    │
│      });                                                                    │
│                                                                             │
│      return value;                                                          │
│    } catch (error) {                                                        │
│      // Secret doesn't exist - use system default or throw                  │
│      console.error(`Secret not found: ${fullSecretName}`);                  │
│      throw new Error(`Tenant secret not configured: ${secretName}`);        │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  // Usage example:                                                          │
│  // const openSignKey = await getTenantSecret('acme', 'opensign-api-key');  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Secret Rotation

### Why Rotate Secrets?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRET ROTATION                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHY ROTATE SECRETS?                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│  • Employee leaves company (might know passwords)                           │
│  • Credentials might have been accidentally exposed                         │
│  • Compliance requirements (PCI-DSS, SOC2)                                  │
│  • Limit blast radius if a secret is compromised                            │
│                                                                             │
│  ROTATION FREQUENCY RECOMMENDATIONS:                                        │
│  ═════════════════════════════════════                                      │
│                                                                             │
│  ┌────────────────────────────┬─────────────────────────────────────────┐  │
│  │ Secret Type                │ Rotation Frequency                       │  │
│  ├────────────────────────────┼─────────────────────────────────────────┤  │
│  │ Database passwords         │ Every 90 days                            │  │
│  │ API keys                   │ Every 90-180 days                        │  │
│  │ JWT signing keys           │ Every 30-90 days                         │  │
│  │ Encryption keys            │ Every 365 days (or on compromise)        │  │
│  │ Service account keys       │ Every 90 days                            │  │
│  │ User API tokens            │ User-controlled (with max lifetime)      │  │
│  └────────────────────────────┴─────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ROTATION PROCESS (Zero Downtime)                                           │
│  ═════════════════════════════════                                          │
│                                                                             │
│  Step 1: Add new secret version                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  database-url                                                        │   │
│  │  ├── version 1: postgresql://user:OLD_PASS@db (disabled)            │   │
│  │  ├── version 2: postgresql://user:CURRENT@db (active)               │   │
│  │  └── version 3: postgresql://user:NEW_PASS@db (NEW - active)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 2: Application automatically picks up new version                     │
│          (cache expires or pod restarts)                                    │
│                                                                             │
│  Step 3: Verify application works with new credentials                      │
│                                                                             │
│  Step 4: Disable old version after confirmation                             │
│                                                                             │
│  Step 5: (Optional) Delete old version after grace period                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Access Control (IAM)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRET ACCESS CONTROL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRINCIPLE OF LEAST PRIVILEGE                                               │
│  ════════════════════════════                                               │
│  Only give access to the secrets that are NEEDED.                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  WHO NEEDS WHAT?                                                     │   │
│  │                                                                      │   │
│  │  ┌─────────────────────┬────────────────────────────────────────┐   │   │
│  │  │ Identity            │ Secrets Access                         │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ hta-app-sa          │ database-url, nextauth-secret,         │   │   │
│  │  │ (application)       │ smtp-password, tenant-*-*              │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ hta-worker-sa       │ database-url, smtp-password            │   │   │
│  │  │ (background jobs)   │ (NO auth secrets needed)               │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ hta-cicd-sa         │ NONE (only deploys, doesn't access)    │   │   │
│  │  │ (deployment)        │                                        │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ Developer           │ DEV secrets only (not PROD)            │   │   │
│  │  │ (human developer)   │                                        │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ Dev-Admin           │ All system + tenant secrets            │   │   │
│  │  │ (platform operator) │ (infrastructure management)            │   │   │
│  │  ├─────────────────────┼────────────────────────────────────────┤   │   │
│  │  │ Lab-Admin           │ NONE (no direct secret access)         │   │   │
│  │  │ (tenant admin)      │ Manages users via app, not secrets     │   │   │
│  │  └─────────────────────┴────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  IAM ROLES FOR SECRET MANAGER:                                              │
│  ══════════════════════════════                                             │
│                                                                             │
│  roles/secretmanager.viewer                                                 │
│    → Can see secret metadata (not values)                                   │
│                                                                             │
│  roles/secretmanager.secretAccessor                                         │
│    → Can read secret values                                                 │
│    → This is what your application needs                                    │
│                                                                             │
│  roles/secretmanager.admin                                                  │
│    → Can create/delete/modify secrets                                       │
│    → Only for administrators                                                │
│                                                                             │
│  TERRAFORM EXAMPLE:                                                         │
│  ──────────────────                                                         │
│                                                                             │
│  resource "google_secret_manager_secret_iam_member" "app_access" {          │
│    secret_id = google_secret_manager_secret.database_url.id                 │
│    role      = "roles/secretmanager.secretAccessor"                         │
│    member    = "serviceAccount:hta-app-sa@project.iam.gserviceaccount.com" │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Audit Logging

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUDIT LOGGING FOR SECRETS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Every secret access is automatically logged by GCP.                        │
│                                                                             │
│  WHAT'S LOGGED:                                                             │
│  ═══════════════                                                            │
│  • WHO accessed the secret (user or service account)                        │
│  • WHAT secret was accessed                                                 │
│  • WHEN it was accessed                                                     │
│  • FROM WHERE (IP address, project)                                         │
│  • RESULT (success or failure)                                              │
│                                                                             │
│  EXAMPLE LOG ENTRY:                                                         │
│  ───────────────────                                                        │
│                                                                             │
│  {                                                                          │
│    "logName": "projects/hta-calibration-prod/logs/cloudaudit.googleapis.com"│
│    "protoPayload": {                                                        │
│      "serviceName": "secretmanager.googleapis.com",                         │
│      "methodName": "google.cloud.secretmanager.v1.SecretManagerService.     │
│                      AccessSecretVersion",                                  │
│      "authenticationInfo": {                                                │
│        "principalEmail": "hta-app-sa@hta-calibration-prod.iam.gserviceaccount.com"│
│      },                                                                     │
│      "resourceName": "projects/hta-calibration-prod/secrets/database-url/   │
│                       versions/latest",                                     │
│      "status": {}  // empty means SUCCESS                                   │
│    },                                                                       │
│    "timestamp": "2026-03-17T10:30:00Z"                                      │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ALERTS TO SET UP:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  ⚠️  Alert: Secret accessed from unknown service account                    │
│  ⚠️  Alert: Failed secret access attempts (possible breach attempt)         │
│  ⚠️  Alert: Secret accessed outside business hours                          │
│  ⚠️  Alert: Bulk secret access (more than 10 secrets in 1 minute)          │
│  ⚠️  Alert: Secret accessed from unexpected IP range                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Local Development

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRETS IN LOCAL DEVELOPMENT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DIFFERENT FROM PRODUCTION!                                                 │
│  ═══════════════════════════                                                │
│                                                                             │
│  In development, we use .env.local files (NOT committed to Git)             │
│                                                                             │
│  PROJECT ROOT:                                                              │
│  ├── .env.example          (Template - committed to Git)                    │
│  ├── .env.local            (Your secrets - NOT in Git)                      │
│  └── .gitignore            (Must include .env.local!)                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  .env.example (Template for developers):                                    │
│  ─────────────────────────────────────────                                  │
│                                                                             │
│  # Database                                                                 │
│  DATABASE_URL=postgresql://user:password@localhost:5432/hta_dev             │
│                                                                             │
│  # Authentication                                                           │
│  NEXTAUTH_SECRET=generate-a-random-string-here                              │
│  NEXTAUTH_URL=http://localhost:3000                                         │
│                                                                             │
│  # External Services (use test/sandbox credentials)                         │
│  OPENSIGN_API_URL=https://sandbox.opensign.com                              │
│  OPENSIGN_API_KEY=your-sandbox-api-key                                      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  .gitignore (MUST include):                                                 │
│  ──────────────────────────                                                 │
│                                                                             │
│  # Local environment files                                                  │
│  .env.local                                                                 │
│  .env.*.local                                                               │
│  .env.development.local                                                     │
│  .env.production.local   # Should NEVER exist locally anyway!               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ONBOARDING NEW DEVELOPERS:                                                 │
│  ═══════════════════════════                                                │
│                                                                             │
│  1. Clone repository                                                        │
│  2. Copy .env.example to .env.local                                         │
│  3. Fill in values (get from team lead/password manager)                    │
│  4. Run: docker compose up                                                  │
│  5. Start developing!                                                       │
│                                                                             │
│  NEVER share production secrets with developers!                            │
│  They should only have access to dev/sandbox credentials.                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRETS MANAGEMENT CHECKLIST                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MUST DO:                                                                   │
│  ════════                                                                   │
│  ☐ Never commit secrets to Git                                             │
│  ☐ Use Google Secret Manager for production                                 │
│  ☐ Different secrets for dev/staging/production                             │
│  ☐ .env.local in .gitignore                                                 │
│  ☐ Rotate secrets regularly                                                 │
│  ☐ Audit who accesses secrets                                               │
│  ☐ Per-tenant secrets isolated                                              │
│                                                                             │
│  NEVER DO:                                                                  │
│  ═════════                                                                  │
│  ☐ Hardcode secrets in source code                                          │
│  ☐ Log secrets (even in debug mode)                                         │
│  ☐ Put secrets in URLs                                                      │
│  ☐ Share production secrets with all developers                             │
│  ☐ Use the same secrets across environments                                 │
│  ☐ Store secrets in plain text files on servers                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [04. Multi-Tenancy Design](./04_multi_tenancy.md) - Tenant isolation strategies
- [14. Security Architecture](./14_security.md) - Comprehensive security
