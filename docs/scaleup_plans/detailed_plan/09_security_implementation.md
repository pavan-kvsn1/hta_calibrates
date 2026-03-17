# Phase 3H: Security Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before implementing security measures, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Security Architecture** | [14_security.md](../../system_design/14_security.md) | Defense in depth, OWASP Top 10, security layers |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Credential protection |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Tenant isolation |
| **Container Orchestration** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | Container security |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | IAM, Cloud Armor |

> **Tip**: If terms like "defense in depth", "zero trust", "RBAC", or "CVE" are unfamiliar, read `14_security.md` first!

---

## Overview

This document covers the security implementation for the HTA Calibration system, including network security, application security, authentication/authorization, and compliance considerations.

---

## Security Architecture

```
+---------------------------------------------------------------------------+
|                         DEFENSE IN DEPTH                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  LAYER 1: PERIMETER SECURITY                                                |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Cloud Armor (WAF)                                                    |  |
|  |  - DDoS protection                                                    |  |
|  |  - OWASP Top 10 rules                                                 |  |
|  |  - Rate limiting                                                      |  |
|  |  - Geo-blocking (if needed)                                           |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              v                                              |
|  LAYER 2: NETWORK SECURITY                                                  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  VPC + Firewall Rules                                                 |  |
|  |  - Private subnets for workloads                                      |  |
|  |  - No public IPs on nodes                                             |  |
|  |  - Egress restrictions                                                |  |
|  |  - Private service connections                                        |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              v                                              |
|  LAYER 3: CLUSTER SECURITY                                                  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  GKE Security                                                         |  |
|  |  - Workload Identity                                                  |  |
|  |  - Network Policies                                                   |  |
|  |  - Pod Security Standards                                             |  |
|  |  - Binary Authorization                                               |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              v                                              |
|  LAYER 4: APPLICATION SECURITY                                              |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Next.js Application                                                  |  |
|  |  - Authentication (NextAuth.js)                                       |  |
|  |  - Authorization (RBAC)                                               |  |
|  |  - Input validation                                                   |  |
|  |  - CSRF protection                                                    |  |
|  |  - Security headers                                                   |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              v                                              |
|  LAYER 5: DATA SECURITY                                                     |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Data Protection                                                      |  |
|  |  - Encryption at rest (CMEK)                                          |  |
|  |  - Encryption in transit (TLS 1.3)                                    |  |
|  |  - Row-Level Security                                                 |  |
|  |  - Secret Manager                                                     |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Cloud Armor (WAF)

### Security Policy Configuration

```hcl
# terraform/modules/security/cloud_armor.tf

resource "google_compute_security_policy" "default" {
  name = "hta-calibration-security-policy"

  # Default rule - allow all (will be filtered by specific rules)
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # Rate limiting
  rule {
    action   = "throttle"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
    }
    description = "Rate limit: 1000 requests per minute per IP"
  }

  # SQL Injection protection
  rule {
    action   = "deny(403)"
    priority = "2000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "SQL Injection protection"
  }

  # XSS protection
  rule {
    action   = "deny(403)"
    priority = "2001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Cross-site scripting protection"
  }

  # Local File Inclusion
  rule {
    action   = "deny(403)"
    priority = "2002"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Local file inclusion protection"
  }

  # Remote Code Execution
  rule {
    action   = "deny(403)"
    priority = "2003"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Remote code execution protection"
  }

  # Protocol attack
  rule {
    action   = "deny(403)"
    priority = "2004"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('protocolattack-v33-stable')"
      }
    }
    description = "Protocol attack protection"
  }

  # Session fixation
  rule {
    action   = "deny(403)"
    priority = "2005"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sessionfixation-v33-stable')"
      }
    }
    description = "Session fixation protection"
  }

  # Block known bad IPs (optional - can be managed dynamically)
  # rule {
  #   action   = "deny(403)"
  #   priority = "500"
  #   match {
  #     versioned_expr = "SRC_IPS_V1"
  #     config {
  #       src_ip_ranges = var.blocked_ips
  #     }
  #   }
  #   description = "Block known malicious IPs"
  # }
}
```

---

## Network Security

### VPC Firewall Rules

```hcl
# terraform/modules/vpc/firewall.tf

# Allow health checks from Google
resource "google_compute_firewall" "allow_health_checks" {
  name    = "allow-health-checks"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000"]
  }

  source_ranges = [
    "35.191.0.0/16",     # Google health check
    "130.211.0.0/22"     # Google health check
  ]

  target_tags = ["gke-node"]
}

# Allow internal communication
resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr]
}

# Allow IAP for SSH
resource "google_compute_firewall" "allow_iap" {
  name    = "allow-iap-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]  # IAP range
  target_tags   = ["allow-iap"]
}

# Deny all other ingress
resource "google_compute_firewall" "deny_all_ingress" {
  name     = "deny-all-ingress"
  network  = google_compute_network.vpc.name
  priority = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

# Restrict egress (allow only necessary)
resource "google_compute_firewall" "allow_egress_google" {
  name      = "allow-egress-google-apis"
  network   = google_compute_network.vpc.name
  direction = "EGRESS"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  destination_ranges = ["199.36.153.4/30"]  # Google APIs
}
```

### Kubernetes Network Policies

```yaml
# k8s/production/network-policies/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: hta-production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress

---
# Allow ingress from load balancer
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-from-lb
  namespace: hta-production
spec:
  podSelector:
    matchLabels:
      app: hta-web
  policyTypes:
    - Ingress
  ingress:
    - ports:
        - protocol: TCP
          port: 3000

---
# Allow egress to database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-to-database
  namespace: hta-production
spec:
  podSelector:
    matchLabels:
      app: hta-web
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 10.0.2.0/24  # Database subnet
      ports:
        - protocol: TCP
          port: 5432

---
# Allow egress to external services
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-external
  namespace: hta-production
spec:
  podSelector:
    matchLabels:
      app: hta-web
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

---

## Container Security

### Pod Security Standards

```yaml
# k8s/production/pod-security/restricted-pss.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hta-production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Secure Deployment Configuration

```yaml
# k8s/production/deployments/hta-web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-production
spec:
  template:
    spec:
      # Don't run as root
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault

      containers:
        - name: hta-web
          image: gcr.io/hta-calibration-prod/hta-web:latest

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          # Resource limits (prevent resource exhaustion)
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi

          # Volume mounts for writable directories
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: next-cache
              mountPath: /app/.next/cache

      volumes:
        - name: tmp
          emptyDir: {}
        - name: next-cache
          emptyDir: {}

      # Service account with minimal permissions
      serviceAccountName: hta-web-sa
      automountServiceAccountToken: false
```

### Image Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t hta-web:scan .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'hta-web:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'  # Fail on critical/high vulnerabilities

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## Application Security

### Authentication Configuration

```typescript
// src/lib/auth/auth-options.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true }
        })

        if (!user || !user.isActive) {
          return null
        }

        // Rate limiting check
        const recentAttempts = await getRecentLoginAttempts(user.id)
        if (recentAttempts > 5) {
          throw new Error('Account temporarily locked')
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValid) {
          await recordFailedLogin(user.id)
          return null
        }

        await clearFailedLogins(user.id)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,  // 8 hours
  },

  jwt: {
    maxAge: 8 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.tenantId = token.tenantId
      }
      return session
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  }
}
```

### Authorization Middleware

```typescript
// src/lib/auth/rbac.ts
type Permission =
  | 'certificate:create'
  | 'certificate:read'
  | 'certificate:update'
  | 'certificate:delete'
  | 'certificate:approve'
  | 'user:manage'
  | 'tenant:manage'
  | 'system:manage'

const rolePermissions: Record<string, Permission[]> = {
  DEV_ADMIN: [
    'certificate:create', 'certificate:read', 'certificate:update', 'certificate:delete', 'certificate:approve',
    'user:manage', 'tenant:manage', 'system:manage'
  ],
  LAB_ADMIN: [
    'certificate:create', 'certificate:read', 'certificate:update', 'certificate:delete', 'certificate:approve',
    'user:manage', 'tenant:manage'
  ],
  ENGINEER: [
    'certificate:create', 'certificate:read', 'certificate:update'
  ],
  REVIEWER: [
    'certificate:read', 'certificate:approve'
  ],
  CUSTOMER: [
    'certificate:read'
  ]
}

export function hasPermission(role: string, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

// Middleware helper
export function requirePermission(permission: Permission) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return null // Continue to handler
  }
}
```

### Input Validation

```typescript
// src/lib/validation/certificate-schema.ts
import { z } from 'zod'

export const createCertificateSchema = z.object({
  instrumentId: z.string().uuid(),
  calibrationDate: z.string().datetime(),
  parameters: z.array(z.object({
    name: z.string().min(1).max(100),
    nominalValue: z.string().max(50),
    measuredValue: z.string().max(50),
    uncertainty: z.string().max(50),
    unit: z.string().max(20)
  })).min(1).max(100),
  notes: z.string().max(5000).optional()
})

// Usage in API route
export async function POST(request: NextRequest) {
  const body = await request.json()

  const result = createCertificateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({
      error: 'Validation failed',
      details: result.error.flatten()
    }, { status: 400 })
  }

  // Use validated data
  const data = result.data
  // ...
}
```

### Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Required for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'self'"
    ].join('; ')
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  }
}
```

---

## Audit Logging

### Audit Log Implementation

```typescript
// src/lib/audit/audit-logger.ts
import { prisma } from '@/lib/prisma'

interface AuditEvent {
  action: string
  resourceType: string
  resourceId?: string
  userId: string
  tenantId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditEvent(event: AuditEvent) {
  await prisma.auditLog.create({
    data: {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      userId: event.userId,
      tenantId: event.tenantId,
      details: event.details || {},
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: new Date()
    }
  })
}

// Usage example
await logAuditEvent({
  action: 'CERTIFICATE_APPROVED',
  resourceType: 'Certificate',
  resourceId: certificate.id,
  userId: session.user.id,
  tenantId: session.user.tenantId,
  details: {
    certificateNumber: certificate.certificateNumber,
    approvedBy: session.user.name
  },
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent')
})
```

---

## Implementation Checklist

### Phase 1: Perimeter Security
- [ ] Configure Cloud Armor WAF
- [ ] Enable OWASP rules
- [ ] Set up rate limiting
- [ ] Configure DDoS protection

### Phase 2: Network Security
- [ ] Configure VPC firewall rules
- [ ] Set up private subnets
- [ ] Configure Cloud NAT
- [ ] Implement Kubernetes network policies

### Phase 3: Container Security
- [ ] Apply Pod Security Standards
- [ ] Configure secure deployment settings
- [ ] Set up image scanning in CI/CD
- [ ] Enable Binary Authorization

### Phase 4: Application Security
- [ ] Configure authentication
- [ ] Implement RBAC
- [ ] Add input validation
- [ ] Set security headers

### Phase 5: Data Security
- [ ] Enable encryption at rest
- [ ] Configure TLS 1.3
- [ ] Set up Row-Level Security
- [ ] Configure Secret Manager

### Phase 6: Monitoring & Response
- [ ] Enable audit logging
- [ ] Set up security alerts
- [ ] Create incident response runbook
- [ ] Schedule security reviews

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Secrets Implementation](./08_secrets_implementation.md)
- [Multi-Tenancy Implementation](./12_multi_tenancy_implementation.md)
- [Monitoring & Observability](./14_monitoring_observability.md)
