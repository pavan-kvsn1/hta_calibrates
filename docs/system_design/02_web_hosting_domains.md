# Web Hosting & Domains - Getting Your Website Online

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [01_beginner_concepts.md](./01_beginner_concepts.md)

---

## Introduction

This guide explains how websites get on the internet, from buying a domain name to having a fully working website with HTTPS.

---

## Part 1: What is Web Hosting?

### The Journey from Code to Website

```
YOUR CODE                       HOSTING                         USERS
════════                        ═══════                         ═════

┌─────────────┐                ┌─────────────────┐             ┌─────────────┐
│             │                │                 │             │             │
│  Next.js    │  ──Deploy──▶   │  Web Hosting    │  ◀──Visit── │   Browser   │
│  App Code   │                │  (Server)       │             │   (Users)   │
│             │                │                 │             │             │
└─────────────┘                └─────────────────┘             └─────────────┘

Code sitting on              Code running on a              Users can now
your laptop                  server connected to            access your app
                            the internet                    from anywhere
```

### Types of Web Hosting

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOSTING OPTIONS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SHARED HOSTING ($5-20/month)                                            │
│  ═══════════════════════════════                                            │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Server                                              │                   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │                   │
│  │  │Site A  │ │Site B  │ │Site C  │ │Site D  │       │                   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │                   │
│  │  All sites share the same server                    │                   │
│  └─────────────────────────────────────────────────────┘                   │
│  • Cheap but slow                                                           │
│  • If Site A gets busy, Sites B-D slow down                                 │
│  • Good for: Small personal blogs                                           │
│  • NOT suitable for: Business applications                                  │
│                                                                             │
│  2. VPS - Virtual Private Server ($20-100/month)                            │
│  ═══════════════════════════════════════════════                            │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Physical Server                                     │                   │
│  │  ┌─────────────────┐ ┌─────────────────┐           │                   │
│  │  │  Virtual Server │ │  Virtual Server │           │                   │
│  │  │  (Your VPS)     │ │  (Someone else) │           │                   │
│  │  │  ┌───────────┐  │ │  ┌───────────┐  │           │                   │
│  │  │  │ Your Site │  │ │  │Their Site │  │           │                   │
│  │  │  └───────────┘  │ │  └───────────┘  │           │                   │
│  │  └─────────────────┘ └─────────────────┘           │                   │
│  └─────────────────────────────────────────────────────┘                   │
│  • Dedicated resources                                                      │
│  • You manage the server                                                    │
│  • More control, more responsibility                                        │
│                                                                             │
│  3. CLOUD HOSTING (Pay per use) ◄── WE USE THIS                            │
│  ════════════════════════════════════════════════                           │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Google Cloud / AWS / Azure                          │                   │
│  │                                                      │                   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │                   │
│  │  │Server│ │Server│ │Server│ │Server│ │Server│      │                   │
│  │  │  1   │ │  2   │ │  3   │ │  4   │ │  5   │      │                   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │                   │
│  │                      │                               │                   │
│  │        Your app runs across multiple servers         │                   │
│  │        Auto-scales based on traffic                  │                   │
│  └─────────────────────────────────────────────────────┘                   │
│  • Scales automatically                                                     │
│  • Pay only for what you use                                                │
│  • Highly available (no single point of failure)                            │
│  • Best for: Production applications                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Domain Names

### What is a Domain Name?

A domain name is your website's address that people type in their browser.

```
Domain Name Anatomy:
════════════════════

https://www.hta-calibration.com/dashboard
│       │   │                │    │
│       │   │                │    └── Path (page on the site)
│       │   │                │
│       │   └────────────────┴── Domain Name
│       │
│       └── Subdomain (optional)
│
└── Protocol (https = secure)


More examples:
─────────────
google.com           ← Domain: google, TLD: .com
mail.google.com      ← Subdomain: mail
amazon.co.uk         ← Domain: amazon, TLD: .co.uk (country code)
```

### Top-Level Domains (TLDs)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMON TLDs                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GENERIC TLDs                                                               │
│  ════════════                                                               │
│  .com    Most popular, originally for companies                             │
│  .org    Organizations (non-profit)                                         │
│  .net    Networks, internet companies                                       │
│  .io     Popular for tech startups                                          │
│  .app    For applications (Google owned)                                    │
│  .dev    For developers                                                     │
│                                                                             │
│  COUNTRY CODE TLDs                                                          │
│  ═════════════════                                                          │
│  .in     India                                                              │
│  .uk     United Kingdom                                                     │
│  .au     Australia                                                          │
│  .sg     Singapore                                                          │
│                                                                             │
│  RECOMMENDATION FOR HTA:                                                    │
│  ───────────────────────                                                    │
│  Primary:    hta-calibration.com  (most trusted)                            │
│  Optional:   hta-calibration.in   (India specific)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Where to Buy Domain Names

```
DOMAIN REGISTRARS (Places to buy domains)
═════════════════════════════════════════

┌────────────────────┬─────────────┬─────────────────────────────────────────┐
│ Registrar          │ .com Price  │ Notes                                   │
├────────────────────┼─────────────┼─────────────────────────────────────────┤
│ Google Domains     │ ~$12/year   │ Simple, integrates well with GCP        │
│ (now Squarespace)  │             │ ◄── RECOMMENDED                         │
├────────────────────┼─────────────┼─────────────────────────────────────────┤
│ Namecheap          │ ~$10/year   │ Cheap, good for multiple domains        │
├────────────────────┼─────────────┼─────────────────────────────────────────┤
│ Cloudflare         │ ~$10/year   │ At cost pricing, good DNS               │
├────────────────────┼─────────────┼─────────────────────────────────────────┤
│ GoDaddy            │ ~$12/year   │ Popular but aggressive upselling        │
└────────────────────┴─────────────┴─────────────────────────────────────────┘

BUYING PROCESS:
───────────────
1. Search if domain is available
2. Pay for registration (1-10 years)
3. Configure DNS (see next section)
4. Renew annually (or set to auto-renew)
```

---

## Part 3: DNS - Domain Name System

### How DNS Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DNS LOOKUP PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  You type: hta-calibration.com                                              │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Check Browser Cache                                          │   │
│  │ "Have I looked this up recently?"                                    │   │
│  │ If yes → Use cached IP. If no → Continue                            │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Ask DNS Resolver (Your ISP or Google 8.8.8.8)               │   │
│  │ "What's the IP for hta-calibration.com?"                            │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: Resolver asks Root DNS Server                                │   │
│  │ "Who handles .com domains?"                                          │   │
│  │ Answer: "Ask the .com TLD server at x.x.x.x"                        │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 4: Resolver asks .com TLD Server                                │   │
│  │ "Who handles hta-calibration.com?"                                   │   │
│  │ Answer: "The authoritative server is ns1.google.com"                │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 5: Resolver asks Authoritative DNS Server                       │   │
│  │ "What's the IP for hta-calibration.com?"                            │   │
│  │ Answer: "35.201.123.456"                                            │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 6: Browser connects to 35.201.123.456                          │   │
│  │ Your website loads!                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  This entire process takes about 20-100 milliseconds                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DNS Record Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DNS RECORD TYPES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  A RECORD (Address)                                                         │
│  ══════════════════                                                         │
│  Maps a domain to an IP address                                             │
│                                                                             │
│  Example:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Name                    Type    Value                              │    │
│  │  ────                    ────    ─────                              │    │
│  │  hta-calibration.com     A       35.201.123.456                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  "When someone visits hta-calibration.com, send them to 35.201.123.456"   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CNAME RECORD (Canonical Name / Alias)                                      │
│  ══════════════════════════════════════                                     │
│  Points one domain to another domain                                        │
│                                                                             │
│  Example:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Name                    Type    Value                              │    │
│  │  ────                    ────    ─────                              │    │
│  │  www.hta-calibration.com CNAME   hta-calibration.com               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  "www.hta-calibration.com is an alias for hta-calibration.com"            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MX RECORD (Mail Exchange)                                                  │
│  ═════════════════════════                                                  │
│  Specifies mail servers for the domain                                      │
│                                                                             │
│  Example:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Name                    Type    Priority    Value                  │    │
│  │  ────                    ────    ────────    ─────                  │    │
│  │  hta-calibration.com     MX      10          mail.google.com       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  "Emails to @hta-calibration.com go to Google's mail servers"             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TXT RECORD (Text)                                                          │
│  ═════════════════                                                          │
│  Stores text information (used for verification, email security)            │
│                                                                             │
│  Example:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Name                    Type    Value                              │    │
│  │  ────                    ────    ─────                              │    │
│  │  hta-calibration.com     TXT     "google-site-verification=abc123" │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  "Proves to Google that you own this domain"                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Our DNS Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HTA CALIBRATION DNS SETUP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DOMAIN: hta-calibration.com                                                │
│  DNS PROVIDER: Google Cloud DNS                                             │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Name                        Type    TTL     Value                  │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │  hta-calibration.com         A       300     35.201.xxx.xxx        │    │
│  │  www                          CNAME   300     hta-calibration.com   │    │
│  │  api                          CNAME   300     hta-calibration.com   │    │
│  │  staging                      A       300     35.201.xxx.xxx        │    │
│  │  hta-calibration.com         MX      300     10 smtp.google.com    │    │
│  │  hta-calibration.com         TXT     300     "v=spf1 include..."   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  TTL (Time To Live) = How long to cache (300 = 5 minutes)                  │
│                                                                             │
│  RESULT:                                                                    │
│  • hta-calibration.com     → Main production site                          │
│  • www.hta-calibration.com → Redirects to main site                        │
│  • api.hta-calibration.com → API endpoints (same server)                   │
│  • staging.hta-calibration.com → Testing environment                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: SSL/TLS Certificates

### Why HTTPS is Required

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHY HTTPS MATTERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SECURITY                                                                │
│     • All data is encrypted                                                 │
│     • Passwords, credit cards protected                                     │
│     • Prevents man-in-the-middle attacks                                    │
│                                                                             │
│  2. TRUST                                                                   │
│     • Users see the padlock icon                                            │
│     • Modern browsers mark HTTP as "Not Secure"                             │
│     • Required for business applications                                    │
│                                                                             │
│  3. SEO                                                                     │
│     • Google ranks HTTPS sites higher                                       │
│     • Required for modern web features                                      │
│                                                                             │
│  4. COMPLIANCE                                                              │
│     • Many regulations require encryption                                   │
│     • Industry standards mandate HTTPS                                      │
│                                                                             │
│                                                                             │
│  BROWSER WARNINGS:                                                          │
│                                                                             │
│  Without HTTPS:                        With HTTPS:                          │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐    │
│  │ ⚠️ Not Secure │ example.com   │   │ 🔒 │ https://example.com      │    │
│  └───────────────────────────────┘   └───────────────────────────────┘    │
│  Users will leave immediately!        Users trust your site               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Getting SSL Certificates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SSL CERTIFICATE OPTIONS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION 1: Let's Encrypt (FREE) ◄── RECOMMENDED                            │
│  ═══════════════════════════════                                            │
│  • Free forever                                                             │
│  • Auto-renews every 90 days                                                │
│  • Widely trusted                                                           │
│  • Easy to set up with GCP                                                  │
│                                                                             │
│  OPTION 2: Google-Managed Certificates (FREE with GCP)                      │
│  ══════════════════════════════════════════════════════                     │
│  • Automatically provisioned                                                │
│  • Zero configuration                                                       │
│  • Auto-renews                                                              │
│  • Works with Load Balancer                                                 │
│  ◄── WE WILL USE THIS                                                      │
│                                                                             │
│  OPTION 3: Commercial Certificates ($50-500/year)                           │
│  ═════════════════════════════════════════════════                          │
│  • Extended validation (green bar)                                          │
│  • Warranty/insurance                                                       │
│  • For high-security needs                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Putting It All Together

### Complete Setup Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SETTING UP hta-calibration.com                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Buy Domain (One-time)                                              │
│  ═════════════════════════════                                              │
│  1. Go to Google Domains (domains.google.com)                               │
│  2. Search for "hta-calibration.com"                                        │
│  3. Purchase (~$12/year)                                                    │
│  4. Set up auto-renewal                                                     │
│                                                                             │
│  STEP 2: Set Up Cloud DNS                                                   │
│  ═════════════════════════                                                  │
│  1. In GCP Console, go to Cloud DNS                                         │
│  2. Create a DNS zone for hta-calibration.com                               │
│  3. Note the nameservers (ns-cloud-x.googledomains.com)                     │
│  4. In domain registrar, point to these nameservers                         │
│                                                                             │
│  STEP 3: Deploy Application                                                 │
│  ═════════════════════════                                                  │
│  1. Deploy to GKE (covered in later docs)                                   │
│  2. Create Load Balancer with static IP                                     │
│  3. Note the IP address (e.g., 35.201.123.456)                              │
│                                                                             │
│  STEP 4: Configure DNS Records                                              │
│  ═════════════════════════════                                              │
│  1. Add A record: hta-calibration.com → 35.201.123.456                      │
│  2. Add CNAME: www → hta-calibration.com                                    │
│  3. Wait for propagation (5-48 hours)                                       │
│                                                                             │
│  STEP 5: Enable HTTPS                                                       │
│  ═════════════════════                                                      │
│  1. In GCP Load Balancer, enable managed certificate                        │
│  2. Add domain to certificate                                               │
│  3. Wait for provisioning (~10-30 minutes)                                  │
│  4. Test: https://hta-calibration.com                                       │
│                                                                             │
│  STEP 6: Force HTTPS                                                        │
│  ═══════════════════                                                        │
│  1. Configure redirect: HTTP → HTTPS                                        │
│  2. Add HSTS header for security                                            │
│                                                                             │
│                                                                             │
│  DONE! Your site is now live at https://hta-calibration.com                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DNS Propagation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DNS PROPAGATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  When you change DNS records, it takes time to spread globally.             │
│  This is called "propagation".                                              │
│                                                                             │
│  Timeline:                                                                  │
│  ─────────                                                                  │
│  0-15 minutes:   Your local DNS sees the change                             │
│  15-60 minutes:  Most regional DNS servers update                           │
│  1-24 hours:     99% of the world sees the change                          │
│  24-48 hours:    All DNS servers worldwide updated                          │
│                                                                             │
│  WHY SO SLOW?                                                               │
│  ─────────────                                                              │
│  DNS servers cache records to be fast.                                      │
│  They only refresh when the TTL (Time To Live) expires.                     │
│                                                                             │
│  TIPS:                                                                      │
│  ──────                                                                     │
│  • Set low TTL (300 seconds) BEFORE making changes                          │
│  • Use https://dnschecker.org to track propagation                          │
│  • Don't panic - it will work eventually!                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Subdomains and Environment URLs

### Our URL Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           URL STRATEGY                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRODUCTION                                                                 │
│  ══════════                                                                 │
│  https://hta-calibration.com              Main application                  │
│  https://www.hta-calibration.com          Redirects to above                │
│  https://api.hta-calibration.com          API endpoints (optional)          │
│                                                                             │
│  STAGING                                                                    │
│  ═══════                                                                    │
│  https://staging.hta-calibration.com      Pre-production testing            │
│                                                                             │
│  DEVELOPMENT                                                                │
│  ═══════════                                                                │
│  https://dev.hta-calibration.com          Development testing               │
│                                                                             │
│  CUSTOMER PORTALS (Multi-tenant)                                            │
│  ═══════════════════════════════                                            │
│  Option A: Path-based                                                       │
│    https://hta-calibration.com/customer/acme                                │
│    https://hta-calibration.com/customer/globex                              │
│                                                                             │
│  Option B: Subdomain-based                                                  │
│    https://acme.hta-calibration.com                                         │
│    https://globex.hta-calibration.com                                       │
│                                                                             │
│  WE RECOMMEND: Option A (simpler SSL, easier routing)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOSTING COSTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANNUAL COSTS:                                                              │
│  ══════════════                                                             │
│                                                                             │
│  Domain Registration                                                        │
│    hta-calibration.com           $12/year                                   │
│                                                                             │
│  SSL Certificate                                                            │
│    Google-managed                FREE                                       │
│                                                                             │
│  Cloud DNS                                                                  │
│    Zone hosting                  ~$0.20/month = $2.40/year                  │
│    Queries                       ~$0.40/million                             │
│                                                                             │
│  ───────────────────────────────────────────────────                        │
│  TOTAL (DNS/Domain only):        ~$15/year                                  │
│                                                                             │
│  Note: Hosting costs (GKE, database, etc.) are separate                     │
│  and covered in the infrastructure documentation.                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Common Issues

### DNS Not Working?

```
CHECKLIST:
─────────
□ Wait for propagation (up to 48 hours)
□ Check nameservers are correct at registrar
□ Verify DNS records with: nslookup hta-calibration.com
□ Clear browser cache and try incognito mode
□ Use https://dnschecker.org to check global propagation
```

### SSL Certificate Issues?

```
CHECKLIST:
─────────
□ DNS must be working first (A record pointing to your IP)
□ Certificate provisioning takes 10-30 minutes
□ Domain must be publicly accessible
□ Check certificate status in GCP Console
□ Ensure firewall allows HTTPS (port 443)
```

---

## Next Steps

Now that you understand web hosting and domains, let's look at:
- [System Architecture Overview](./03_system_architecture.md) - How all the pieces fit together
