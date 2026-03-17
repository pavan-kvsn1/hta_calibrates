# Beginner Concepts - Understanding Web Infrastructure

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: None - Start here!

---

## Introduction

Before we dive into cloud infrastructure, let's make sure we understand the fundamentals. This document explains concepts from the very beginning.

---

## Part 1: What is a Server?

### Your Computer vs. A Server

```
YOUR LAPTOP                              A SERVER
══════════                               ════════

┌─────────────────────┐                  ┌─────────────────────┐
│  ┌───┐              │                  │                     │
│  │   │  Screen      │                  │    No screen!       │
│  └───┘              │                  │    No keyboard!     │
│  ┌─────────────┐    │                  │                     │
│  │  Keyboard   │    │                  │    Just a box       │
│  └─────────────┘    │                  │    in a data center │
│                     │                  │                     │
│  Used by: You       │                  │  Used by: Programs  │
│  Turned off at night│                  │  Runs 24/7/365      │
│                     │                  │                     │
└─────────────────────┘                  └─────────────────────┘
```

**A server is just a computer optimized to:**
- Run programs (not show graphics)
- Stay on forever
- Handle many connections at once
- Be accessed over the internet

### Real-World Analogy

Think of a restaurant:
- **Your laptop** = Your home kitchen (you cook for yourself)
- **A server** = A restaurant kitchen (cooks for hundreds of customers)

---

## Part 2: What is the Internet?

### The Simplest Explanation

The internet is just a bunch of computers connected by cables.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THE INTERNET (Simplified)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     Your Computer                                         A Server          │
│    ┌───────────┐                                       ┌───────────┐       │
│    │           │                                       │           │       │
│    │    You    │◄════════════ CABLES ════════════════▶│  Website  │       │
│    │           │         (fiber optic,                 │           │       │
│    └───────────┘          copper, wifi)                └───────────┘       │
│                                                                             │
│    When you visit google.com:                                               │
│    1. Your computer sends a request through these cables                    │
│    2. Google's server receives it                                           │
│    3. Google's server sends back the webpage                                │
│    4. Your browser displays it                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### IP Addresses - Finding Computers

Every computer on the internet has an address called an **IP Address**.

```
Like a street address:                Like an IP address:
┌─────────────────────────┐          ┌─────────────────────────┐
│ 123 Main Street         │          │ 142.250.185.78          │
│ New York, NY 10001      │          │ (This is Google!)       │
└─────────────────────────┘          └─────────────────────────┘
```

**Try it yourself:**
Open your terminal and type: `ping google.com`
You'll see Google's IP address!

### Domain Names - Human-Readable Addresses

Nobody wants to remember `142.250.185.78`. That's why we have domain names!

```
DNS (Domain Name System) = The Internet's Phone Book

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    You type: google.com                                                     │
│         │                                                                   │
│         ▼                                                                   │
│    ┌─────────────────┐                                                     │
│    │   DNS Server    │  "Let me look that up..."                           │
│    │   ═══════════   │                                                     │
│    │   google.com =  │                                                     │
│    │  142.250.185.78 │                                                     │
│    └────────┬────────┘                                                     │
│             │                                                               │
│             ▼                                                               │
│    Your browser now connects to 142.250.185.78                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: What is the Cloud?

### The Old Way vs. The Cloud

```
THE OLD WAY (2000s)                      THE CLOUD WAY (Now)
═══════════════════                      ═══════════════════

Buy servers:                             Rent servers:
┌─────────────────────┐                  ┌─────────────────────┐
│  $ $ $ $ $ $ $      │                  │  $  per hour        │
│  $50,000+ upfront   │                  │  Pay only for what  │
│                     │                  │  you use            │
└─────────────────────┘                  └─────────────────────┘

Set up a room:                           Already set up:
┌─────────────────────┐                  ┌─────────────────────┐
│  Air conditioning   │                  │  Google/Amazon/     │
│  Security           │                  │  Microsoft handles  │
│  Fire suppression   │                  │  ALL of this        │
│  Backup power       │                  │                     │
└─────────────────────┘                  └─────────────────────┘

Hire IT staff:                           Managed for you:
┌─────────────────────┐                  ┌─────────────────────┐
│  24/7 monitoring    │                  │  Their engineers    │
│  Hardware repairs   │                  │  handle problems    │
│  Software updates   │                  │                     │
└─────────────────────┘                  └─────────────────────┘

Time to set up: Months                   Time to set up: Minutes
```

### Major Cloud Providers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAJOR CLOUD PROVIDERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐         │
│   │  Amazon AWS     │   │  Google Cloud   │   │  Microsoft      │         │
│   │  ═══════════    │   │  Platform (GCP) │   │  Azure          │         │
│   │                 │   │  ═════════════  │   │  ═════          │         │
│   │  Market leader  │   │  ◄── WE USE     │   │  Strong with    │         │
│   │  Most services  │   │      THIS       │   │  enterprises    │         │
│   │                 │   │                 │   │                 │         │
│   │  Used by:       │   │  Used by:       │   │  Used by:       │         │
│   │  Netflix        │   │  Spotify        │   │  LinkedIn       │         │
│   │  Airbnb         │   │  Twitter        │   │  Adobe          │         │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘         │
│                                                                             │
│   All three offer similar services. We chose GCP for:                       │
│   • Excellent Kubernetes (GKE) support                                      │
│   • Good pricing for our scale                                              │
│   • Strong presence in Asia-Pacific                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: What is a Database?

### Databases Explained Simply

A database is like a super-powered Excel spreadsheet.

```
EXCEL SPREADSHEET                        DATABASE (PostgreSQL)
═════════════════                        ════════════════════

┌────┬──────────┬──────────┐            Table: users
│ ID │   Name   │  Email   │            ┌────┬──────────┬──────────┐
├────┼──────────┼──────────┤            │ id │   name   │  email   │
│  1 │  Alice   │ a@ex.com │            ├────┼──────────┼──────────┤
│  2 │   Bob    │ b@ex.com │            │  1 │  Alice   │ a@ex.com │
│  3 │ Charlie  │ c@ex.com │            │  2 │   Bob    │ b@ex.com │
└────┴──────────┴──────────┘            │  3 │ Charlie  │ c@ex.com │
                                        └────┴──────────┴──────────┘

Limitations:                            Advantages:
• One person at a time                  • Millions of users at once
• Slows down with many rows             • Fast even with billions of rows
• Can get corrupted                     • Built-in protection against corruption
• No relationships between sheets       • Tables can reference each other
```

### How Our Data is Organized

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE TABLES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Table: users                     Table: certificates                       │
│  ┌────┬────────┬───────┐         ┌────┬──────────┬─────────┬──────────┐   │
│  │ id │  name  │ role  │         │ id │  number  │ status  │ user_id  │   │
│  ├────┼────────┼───────┤         ├────┼──────────┼─────────┼──────────┤   │
│  │  1 │ Alice  │ ENG   │◄────────│  1 │ CERT-001 │ DRAFT   │    1     │   │
│  │  2 │  Bob   │ REV   │         │  2 │ CERT-002 │ APPROVED│    1     │   │
│  └────┴────────┴───────┘         └────┴──────────┴─────────┴──────────┘   │
│         ▲                                                                   │
│         │                        The user_id column LINKS to               │
│         └────────────────────────the users table. This is called           │
│                                  a "foreign key relationship"              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: What is an API?

### APIs - How Software Talks to Software

API stands for **Application Programming Interface**. It's how different programs communicate.

```
REAL WORLD ANALOGY
══════════════════

Restaurant                              Web Application
───────────                             ───────────────

┌─────────┐    ┌─────────┐    ┌─────────┐
│   You   │───▶│ Waiter  │───▶│ Kitchen │
│(Customer)│   │  (API)  │    │(Server) │
└─────────┘    └─────────┘    └─────────┘

You don't walk into the kitchen.         Your browser doesn't directly
You tell the waiter what you want.       access the database.
The waiter brings you food.              The API handles requests.

Your order: "One pizza please"           API request: GET /api/certificates
Response: Pizza delivered to you         API response: List of certificates
```

### REST API Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REST API BASICS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP METHODS (Verbs):                                                      │
│                                                                             │
│  GET     = Read data         "Give me certificate #123"                     │
│  POST    = Create data       "Create a new certificate"                     │
│  PUT     = Update data       "Update certificate #123"                      │
│  DELETE  = Delete data       "Delete certificate #123"                      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  EXAMPLE API CALLS:                                                         │
│                                                                             │
│  Request:  GET /api/certificates/123                                        │
│  Response: {                                                                │
│              "id": 123,                                                     │
│              "number": "CERT-2026-001",                                     │
│              "status": "APPROVED"                                           │
│            }                                                                │
│                                                                             │
│  Request:  POST /api/certificates                                           │
│  Body:     { "instrument": "Pressure Gauge" }                               │
│  Response: { "id": 124, "status": "DRAFT" }                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: What is a Container?

### The Problem Containers Solve

```
THE PROBLEM: "It works on my machine!"
══════════════════════════════════════

Developer's Laptop              Server
┌─────────────────────┐        ┌─────────────────────┐
│ Node.js 20.1.0      │        │ Node.js 18.0.0      │  ← Different version!
│ npm 9.6.0           │        │ npm 8.0.0           │  ← Different version!
│ Linux 5.15          │        │ Linux 4.19          │  ← Different!
│ OpenSSL 3.0         │        │ OpenSSL 1.1         │  ← Different!
│                     │        │                     │
│ App works!          │        │ App CRASHES!        │
└─────────────────────┘        └─────────────────────┘
```

### The Solution: Containers

```
THE SOLUTION: Package EVERYTHING together
════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   CONTAINER (like a shipping container)                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              │  │
│   │   │ Your App    │   │ Node.js     │   │ All other   │              │  │
│   │   │ Code        │   │ 20.1.0      │   │ dependencies│              │  │
│   │   └─────────────┘   └─────────────┘   └─────────────┘              │  │
│   │                                                                      │  │
│   │   Everything needed to run, packaged together                        │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   This SAME container runs identically on:                                  │
│   • Your laptop                                                             │
│   • Test server                                                             │
│   • Production server                                                       │
│   • Your colleague's laptop                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Docker - The Container Tool

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER BASICS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   KEY CONCEPTS:                                                             │
│                                                                             │
│   Dockerfile         = Recipe for creating a container                      │
│   Image              = Snapshot of a container (like a template)            │
│   Container          = Running instance of an image                         │
│                                                                             │
│   ANALOGY:                                                                  │
│   ────────                                                                  │
│   Dockerfile = Recipe for chocolate cake                                    │
│   Image      = A packaged, frozen cake                                      │
│   Container  = The actual cake you're eating                                │
│                                                                             │
│   COMMANDS:                                                                 │
│   ─────────                                                                 │
│   docker build .           = Create an image from Dockerfile                │
│   docker run my-image      = Start a container from the image               │
│   docker ps                = List running containers                        │
│   docker stop container-id = Stop a container                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: What is HTTPS and SSL/TLS?

### Why Security Matters

```
WITHOUT HTTPS (HTTP)                    WITH HTTPS
════════════════════                    ══════════

┌─────────┐         ┌─────────┐        ┌─────────┐         ┌─────────┐
│   You   │────────▶│  Server │        │   You   │────────▶│  Server │
└─────────┘         └─────────┘        └─────────┘         └─────────┘
      │                                       │
      │  Data: "password123"                  │  Data: "xK9#mP2$..."
      │  Anyone can read this!                │  Encrypted! Unreadable!
      │                                       │
      ▼                                       ▼
  ┌─────────┐                             ┌─────────┐
  │ Hacker  │ "I can see your password!"  │ Hacker  │ "What is this gibberish?"
  └─────────┘                             └─────────┘
```

### SSL Certificates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SSL CERTIFICATES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   An SSL certificate proves:                                                │
│   1. You are who you say you are (identity)                                 │
│   2. Your connection is encrypted (security)                                │
│                                                                             │
│   In your browser:                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  🔒 https://hta-calibration.com                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        ▲                                                                    │
│        │                                                                    │
│        └── This padlock means the site has a valid SSL certificate          │
│                                                                             │
│   WHERE TO GET CERTIFICATES:                                                │
│   • Let's Encrypt (Free, automated)  ← We'll use this                       │
│   • Commercial CAs (Paid, more features)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Development vs. Staging vs. Production

### The Three Environments

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENVIRONMENTS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DEVELOPMENT (Dev)                                                         │
│   ═════════════════                                                         │
│   • Your laptop                                                             │
│   • Fake/test data                                                          │
│   • OK to break things                                                      │
│   • Only you use it                                                         │
│                                                                             │
│         │                                                                   │
│         ▼  Code tested and working? Push to staging                         │
│                                                                             │
│   STAGING                                                                   │
│   ═══════                                                                   │
│   • Copy of production                                                      │
│   • Test data (not real customers)                                          │
│   • Team tests new features                                                 │
│   • Catches bugs before production                                          │
│                                                                             │
│         │                                                                   │
│         ▼  Everything looks good? Deploy to production                      │
│                                                                             │
│   PRODUCTION (Prod)                                                         │
│   ══════════════════                                                        │
│   • The REAL system                                                         │
│   • Real customer data                                                      │
│   • NEVER break this!                                                       │
│   • What users actually see                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Quiz - Test Your Understanding

1. **What is a server?**
   - A) A fancy laptop
   - B) A computer that runs programs 24/7 and serves requests
   - C) A type of restaurant

2. **What does DNS do?**
   - A) Protects your computer from viruses
   - B) Translates domain names to IP addresses
   - C) Makes your internet faster

3. **Why do we use containers?**
   - A) To ship packages
   - B) To ensure code runs the same everywhere
   - C) To make websites look pretty

4. **What is an API?**
   - A) A programming language
   - B) How different programs communicate
   - C) A type of database

**Answers: 1-B, 2-B, 3-B, 4-B**

---

## Next Steps

Now that you understand the basics, let's learn about [Web Hosting & Domains](./02_web_hosting_domains.md)!
