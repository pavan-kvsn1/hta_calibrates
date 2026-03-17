# Security Architecture

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Introduction

Security is not optional. This document covers the security measures protecting HTA Calibration at every layer.

---

## Part 1: Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEFENSE IN DEPTH                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Security at EVERY layer - if one fails, others still protect:              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   USER                                                               │   │
│  │     │                                                                │   │
│  │     ▼                                                                │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  LAYER 1: EDGE SECURITY                                     │    │   │
│  │   │  • Cloud Armor (WAF, DDoS protection)                       │    │   │
│  │   │  • SSL/TLS encryption                                       │    │   │
│  │   │  • Rate limiting                                            │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │     │                                                                │   │
│  │     ▼                                                                │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  LAYER 2: NETWORK SECURITY                                  │    │   │
│  │   │  • VPC isolation                                            │    │   │
│  │   │  • Private IPs for internal services                        │    │   │
│  │   │  • Firewall rules                                           │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │     │                                                                │   │
│  │     ▼                                                                │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  LAYER 3: APPLICATION SECURITY                              │    │   │
│  │   │  • Authentication (NextAuth.js)                             │    │   │
│  │   │  • Authorization (role-based access)                        │    │   │
│  │   │  • Input validation                                         │    │   │
│  │   │  • CSRF protection                                          │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │     │                                                                │   │
│  │     ▼                                                                │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  LAYER 4: DATA SECURITY                                     │    │   │
│  │   │  • Tenant isolation (tenant_id filtering)                   │    │   │
│  │   │  • Row-Level Security (RLS)                                 │    │   │
│  │   │  • Encryption at rest                                       │    │   │
│  │   │  • Encryption in transit                                    │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │     │                                                                │   │
│  │     ▼                                                                │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  LAYER 5: SECRETS MANAGEMENT                                │    │   │
│  │   │  • Google Secret Manager                                    │    │   │
│  │   │  • No hardcoded credentials                                 │    │   │
│  │   │  • Regular rotation                                         │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Authentication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HOW USERS PROVE THEIR IDENTITY:                                            │
│  ═══════════════════════════════                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   1. User enters email/password                                      │   │
│  │      ┌──────────────────────┐                                       │   │
│  │      │ Email: john@hta.com  │                                       │   │
│  │      │ Pass:  ••••••••••••  │                                       │   │
│  │      │      [Login]         │                                       │   │
│  │      └──────────────────────┘                                       │   │
│  │                │                                                     │   │
│  │                ▼                                                     │   │
│  │   2. Server validates credentials                                    │   │
│  │      • Hash password with bcrypt                                     │   │
│  │      • Compare with stored hash                                      │   │
│  │      • Verify user is active and tenant is active                    │   │
│  │                │                                                     │   │
│  │                ▼                                                     │   │
│  │   3. Server creates JWT token                                        │   │
│  │      {                                                               │   │
│  │        "sub": "user_123",                                            │   │
│  │        "tenantId": "hta",                                            │   │
│  │        "role": "ENGINEER",                                           │   │
│  │        "exp": 1679000000                                             │   │
│  │      }                                                               │   │
│  │      Signed with server secret                                       │   │
│  │                │                                                     │   │
│  │                ▼                                                     │   │
│  │   4. Token stored in HTTP-only cookie                                │   │
│  │      Set-Cookie: auth-token=eyJ...; HttpOnly; Secure; SameSite=Lax   │   │
│  │                │                                                     │   │
│  │                ▼                                                     │   │
│  │   5. Subsequent requests include cookie                              │   │
│  │      Server validates token on each request                          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PASSWORD SECURITY:                                                         │
│  ══════════════════                                                         │
│                                                                             │
│  • Minimum 8 characters                                                     │
│  • Hashed with bcrypt (cost factor 12)                                      │
│  • Never stored in plain text                                               │
│  • Rate limiting on login attempts (5 per minute)                           │
│  • Account lockout after 10 failed attempts                                 │
│                                                                             │
│  TOKEN SECURITY:                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  • Short expiry (24 hours)                                                  │
│  • HTTP-only cookies (no JavaScript access)                                 │
│  • Secure flag (HTTPS only)                                                 │
│  • SameSite=Lax (CSRF protection)                                           │
│  • Signed with strong secret from Secret Manager                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHORIZATION (RBAC)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ROLE-BASED ACCESS CONTROL:                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │   ROLE        │ PERMISSIONS                                        │    │
│  │   ────────────│────────────────────────────────────────────────── │    │
│  │   DEV_ADMIN   │ • All system operations                           │    │
│  │   (System)    │ • Provision tenants                               │    │
│  │               │ • Access all data (for support)                   │    │
│  │               │ • Infrastructure management                       │    │
│  │   ────────────│────────────────────────────────────────────────── │    │
│  │   LAB_ADMIN   │ • Manage users in their tenant                    │    │
│  │   (Tenant)    │ • View all certificates in tenant                 │    │
│  │               │ • Authorize certificates                          │    │
│  │               │ • Configure tenant settings                       │    │
│  │   ────────────│────────────────────────────────────────────────── │    │
│  │   ENGINEER    │ • Create certificates                             │    │
│  │   (Tenant)    │ • Edit own certificates                           │    │
│  │               │ • Submit for review                               │    │
│  │               │ • Respond to revision requests                    │    │
│  │   ────────────│────────────────────────────────────────────────── │    │
│  │   REVIEWER    │ • Review submitted certificates                   │    │
│  │   (Tenant)    │ • Approve or request revisions                    │    │
│  │               │ • Cannot create certificates                      │    │
│  │   ────────────│────────────────────────────────────────────────── │    │
│  │   CUSTOMER    │ • View certificates issued to them                │    │
│  │   (Tenant)    │ • Provide feedback                                │    │
│  │               │ • Download PDFs                                   │    │
│  │                                                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  AUTHORIZATION CHECK:                                                       │
│  ═════════════════════                                                      │
│                                                                             │
│  // middleware/authorize.ts                                                 │
│  export function authorize(allowedRoles: Role[]) {                          │
│    return async (req, res, next) => {                                       │
│      const session = await getSession(req);                                 │
│                                                                             │
│      if (!session) {                                                        │
│        return res.status(401).json({ error: 'Not authenticated' });         │
│      }                                                                      │
│                                                                             │
│      if (!allowedRoles.includes(session.user.role)) {                       │
│        return res.status(403).json({ error: 'Insufficient permissions' });  │
│      }                                                                      │
│                                                                             │
│      // Ensure tenant isolation                                             │
│      req.tenantId = session.user.tenantId;                                  │
│      next();                                                                │
│    };                                                                       │
│  }                                                                          │
│                                                                             │
│  // Usage                                                                   │
│  app.post('/api/certificates',                                              │
│    authorize(['ENGINEER', 'LAB_ADMIN']),                                    │
│    createCertificate                                                        │
│  );                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: OWASP Top 10 Protection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OWASP TOP 10 PROTECTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. INJECTION (SQL, NoSQL, Command)                                         │
│  ══════════════════════════════════                                         │
│  • Use Prisma ORM (parameterized queries)                                   │
│  • Never concatenate user input into queries                                │
│  • Input validation with Zod schemas                                        │
│                                                                             │
│  // ✅ Safe (Prisma parameterizes automatically)                            │
│  await prisma.certificate.findMany({                                        │
│    where: { tenantId, status: userInput }                                   │
│  });                                                                        │
│                                                                             │
│  // ❌ Dangerous (raw query with string concat)                             │
│  await prisma.$queryRaw`SELECT * FROM certs WHERE status = ${userInput}`    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  2. BROKEN AUTHENTICATION                                                   │
│  ═════════════════════════                                                  │
│  • Strong password requirements                                             │
│  • Secure session management (HTTP-only cookies)                            │
│  • Rate limiting on login                                                   │
│  • Account lockout                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  3. SENSITIVE DATA EXPOSURE                                                 │
│  ═════════════════════════                                                  │
│  • All traffic encrypted (HTTPS)                                            │
│  • Secrets in Secret Manager (not code)                                     │
│  • Database encryption at rest                                              │
│  • Don't log sensitive data                                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  4. XSS (Cross-Site Scripting)                                              │
│  ═════════════════════════════                                              │
│  • React auto-escapes output                                                │
│  • Content-Security-Policy header                                           │
│  • Don't use dangerouslySetInnerHTML                                        │
│                                                                             │
│  // Next.js headers                                                         │
│  Content-Security-Policy:                                                   │
│    default-src 'self';                                                      │
│    script-src 'self' 'unsafe-inline';                                       │
│    style-src 'self' 'unsafe-inline';                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  5. BROKEN ACCESS CONTROL                                                   │
│  ═════════════════════════                                                  │
│  • Always check authorization                                               │
│  • Always filter by tenantId                                                │
│  • Verify ownership before actions                                          │
│                                                                             │
│  // Always verify the user can access this certificate                      │
│  const cert = await prisma.certificate.findFirst({                          │
│    where: {                                                                 │
│      id: certId,                                                            │
│      tenantId: session.user.tenantId,  // CRITICAL!                         │
│    }                                                                        │
│  });                                                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  6. CSRF (Cross-Site Request Forgery)                                       │
│  ═════════════════════════════════════                                      │
│  • SameSite cookie attribute                                                │
│  • CSRF tokens for state-changing operations                                │
│  • Verify Origin header                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Infrastructure Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE SECURITY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NETWORK SECURITY:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   INTERNET                                                           │   │
│  │       │                                                              │   │
│  │       │ HTTPS only                                                   │   │
│  │       ▼                                                              │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  Cloud Armor (WAF)                                           │   │   │
│  │   │  • Block malicious IPs                                       │   │   │
│  │   │  • Rate limiting                                             │   │   │
│  │   │  • SQL injection protection                                  │   │   │
│  │   │  • XSS protection                                            │   │   │
│  │   └───────────────────────────┬─────────────────────────────────┘   │   │
│  │                               │                                      │   │
│  │   ════════════════════════════│══════════════════════════════════   │   │
│  │          VPC BOUNDARY         │                                      │   │
│  │   ════════════════════════════│══════════════════════════════════   │   │
│  │                               │                                      │   │
│  │                               ▼                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  Load Balancer (internal)                                    │   │   │
│  │   └───────────────────────────┬─────────────────────────────────┘   │   │
│  │                               │                                      │   │
│  │                               ▼                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  GKE Cluster (private nodes)                                 │   │   │
│  │   │  • No public IPs on nodes                                    │   │   │
│  │   │  • Workload Identity                                         │   │   │
│  │   │  • Pod security policies                                     │   │   │
│  │   └───────────────────────────┬─────────────────────────────────┘   │   │
│  │                               │                                      │   │
│  │                               ▼                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  Cloud SQL (private IP only)                                 │   │   │
│  │   │  • No public IP                                              │   │   │
│  │   │  • Encrypted connections                                     │   │   │
│  │   │  • Encrypted at rest                                         │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  IAM SECURITY:                                                              │
│  ═════════════                                                              │
│                                                                             │
│  • Principle of least privilege                                             │
│  • Service accounts for applications (not user accounts)                    │
│  • No long-lived keys (use Workload Identity)                               │
│  • Regular access reviews                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY CHECKLIST                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ☐ HTTPS everywhere                                                         │
│  ☐ Strong authentication (bcrypt, JWT, HTTP-only cookies)                   │
│  ☐ Role-based access control                                                │
│  ☐ Tenant isolation (tenant_id on every query)                              │
│  ☐ Input validation (Zod schemas)                                           │
│  ☐ Parameterized queries (Prisma ORM)                                       │
│  ☐ Secrets in Secret Manager                                                │
│  ☐ Private network for internal services                                    │
│  ☐ WAF protection (Cloud Armor)                                             │
│  ☐ Rate limiting                                                            │
│  ☐ Audit logging                                                            │
│  ☐ Regular security updates                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [13. Secrets Management](./13_secrets_management.md) - Handling credentials
- [15. Monitoring & Observability](./15_monitoring.md) - Detecting security issues
