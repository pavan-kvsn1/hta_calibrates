# Container Orchestration with GKE

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [06_gcp_fundamentals.md](./06_gcp_fundamentals.md)

---

## Introduction

This document explains how we run the HTA Calibration application at scale using Kubernetes on Google Kubernetes Engine (GKE). We'll cover containers, orchestration, deployments, and scaling.

---

## Part 1: Understanding Containers

### What is a Container?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHAT IS A CONTAINER?                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROBLEM: "It works on my machine!"                                         │
│  ════════════════════════════════                                           │
│                                                                             │
│  Developer's Machine:                Production Server:                     │
│  ┌─────────────────────┐            ┌─────────────────────┐                │
│  │ Node.js v20.1.0     │            │ Node.js v18.2.0     │ ← Different!   │
│  │ npm v9.6.0          │            │ npm v8.1.0          │ ← Different!   │
│  │ OpenSSL 3.0         │            │ OpenSSL 1.1         │ ← Different!   │
│  │ Ubuntu 22.04        │            │ CentOS 7            │ ← Different!   │
│  │                     │            │                     │                 │
│  │ ✅ App runs fine    │            │ ❌ App crashes!     │                │
│  └─────────────────────┘            └─────────────────────┘                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SOLUTION: Containers                                                       │
│  ════════════════════                                                       │
│                                                                             │
│  A container packages EVERYTHING your app needs:                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        CONTAINER                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  Your Application Code                                       │   │   │
│  │  ├─────────────────────────────────────────────────────────────┤   │   │
│  │  │  Dependencies (node_modules, etc.)                           │   │   │
│  │  ├─────────────────────────────────────────────────────────────┤   │   │
│  │  │  Runtime (Node.js v20.1.0)                                   │   │   │
│  │  ├─────────────────────────────────────────────────────────────┤   │   │
│  │  │  System Libraries (OpenSSL, libc, etc.)                      │   │   │
│  │  ├─────────────────────────────────────────────────────────────┤   │   │
│  │  │  Base OS (Alpine Linux / Debian slim)                        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Same container runs EXACTLY the same everywhere:                           │
│  • Developer's laptop ✅                                                    │
│  • CI/CD pipeline ✅                                                        │
│  • Production server ✅                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Container vs Virtual Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONTAINER vs VIRTUAL MACHINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VIRTUAL MACHINES:                    CONTAINERS:                           │
│  ═════════════════                    ═══════════                           │
│                                                                             │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │ App A │ App B │ App C  │         │ App A │ App B │ App C  │           │
│  ├───────┼───────┼────────┤         ├───────┼───────┼────────┤           │
│  │Guest  │Guest  │Guest   │         │       │       │        │           │
│  │OS     │OS     │OS      │         │  Container Runtime     │           │
│  │(2GB)  │(2GB)  │(2GB)   │         │  (Docker) ~100MB       │           │
│  ├───────┴───────┴────────┤         ├────────────────────────┤           │
│  │      Hypervisor        │         │      Host OS           │           │
│  ├────────────────────────┤         ├────────────────────────┤           │
│  │      Host OS           │         │      Hardware          │           │
│  ├────────────────────────┤         └────────────────────────┘           │
│  │      Hardware          │                                               │
│  └────────────────────────┘                                               │
│                                                                             │
│  Each VM has full OS copy            Containers share host OS kernel       │
│  ~2GB per VM                         ~100MB per container                  │
│  Boot time: minutes                  Boot time: seconds                    │
│  Heavy isolation                     Lightweight isolation                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ANALOGY:                                                                   │
│                                                                             │
│  VMs = Separate Houses               Containers = Apartments               │
│  Each has own plumbing,              Share building infrastructure,        │
│  electricity, foundation             but each unit is isolated             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Docker Basics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER BASICS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KEY CONCEPTS:                                                              │
│  ═════════════                                                              │
│                                                                             │
│  DOCKERFILE = Recipe for building a container                               │
│  IMAGE = Built container (like a snapshot)                                  │
│  CONTAINER = Running instance of an image                                   │
│                                                                             │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│  │   Dockerfile    │─────▶│     Image       │─────▶│   Container     │     │
│  │   (recipe)      │build │   (template)    │ run  │   (running)     │     │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  OUR DOCKERFILE:                                                            │
│  ════════════════                                                           │
│                                                                             │
│  # hta-calibration/Dockerfile                                               │
│                                                                             │
│  # Start with Node.js base image                                            │
│  FROM node:20-alpine                                                        │
│                                                                             │
│  # Set working directory                                                    │
│  WORKDIR /app                                                               │
│                                                                             │
│  # Copy package files                                                       │
│  COPY package*.json ./                                                      │
│                                                                             │
│  # Install dependencies                                                     │
│  RUN npm ci --only=production                                               │
│                                                                             │
│  # Copy application code                                                    │
│  COPY . .                                                                   │
│                                                                             │
│  # Build Next.js application                                                │
│  RUN npm run build                                                          │
│                                                                             │
│  # Expose port                                                              │
│  EXPOSE 3000                                                                │
│                                                                             │
│  # Start the application                                                    │
│  CMD ["npm", "start"]                                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  COMMON COMMANDS:                                                           │
│  ════════════════                                                           │
│                                                                             │
│  # Build image                                                              │
│  docker build -t hta-calibration:v1.0 .                                     │
│                                                                             │
│  # Run container                                                            │
│  docker run -p 3000:3000 hta-calibration:v1.0                               │
│                                                                             │
│  # List running containers                                                  │
│  docker ps                                                                  │
│                                                                             │
│  # Stop container                                                           │
│  docker stop <container-id>                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Why Kubernetes?

### The Problem with Just Docker

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY DO WE NEED KUBERNETES?                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Docker alone works for simple cases:                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SINGLE SERVER                                   │   │
│  │                                                                      │   │
│  │   docker run hta-calibration:v1.0                                    │   │
│  │   ┌─────────────────────┐                                           │   │
│  │   │   HTA Application   │                                           │   │
│  │   └─────────────────────┘                                           │   │
│  │                                                                      │   │
│  │   This works... until:                                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PROBLEM 1: Container Crashes                                               │
│  ────────────────────────────                                               │
│  Container dies at 3 AM → Website is down → Nobody knows                   │
│  Who restarts it? You? While sleeping?                                      │
│                                                                             │
│  PROBLEM 2: Traffic Spike                                                   │
│  ────────────────────────                                                   │
│  100x normal traffic → Single container overwhelmed → Slow/crashed         │
│  Need more containers fast!                                                 │
│                                                                             │
│  PROBLEM 3: Deploy New Version                                              │
│  ─────────────────────────────                                              │
│  Stop old container → Start new container → DOWNTIME!                      │
│  Users see errors during deployment                                         │
│                                                                             │
│  PROBLEM 4: Server Fails                                                    │
│  ───────────────────────                                                    │
│  Physical server dies → Everything is gone                                  │
│  Where's the backup? How do we recover?                                     │
│                                                                             │
│  PROBLEM 5: Multiple Services                                               │
│  ────────────────────────────                                               │
│  App + Database + Redis + Worker → How do they find each other?            │
│  Which server runs what?                                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  KUBERNETES SOLVES ALL OF THESE:                                            │
│  ═══════════════════════════════                                            │
│                                                                             │
│  • Auto-restart crashed containers                                          │
│  • Auto-scale based on traffic                                              │
│  • Zero-downtime deployments                                                │
│  • Distribute across multiple servers                                       │
│  • Service discovery and networking                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Kubernetes Concepts

### The Building Blocks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KUBERNETES BUILDING BLOCKS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLUSTER                                                                    │
│  ═══════                                                                    │
│  A cluster is the whole Kubernetes system:                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    KUBERNETES CLUSTER                                │   │
│  │                                                                      │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │  CONTROL PLANE (managed by GKE)                             │    │   │
│  │   │  • API Server (you talk to this)                            │    │   │
│  │   │  • Scheduler (decides where to run pods)                    │    │   │
│  │   │  • Controller Manager (maintains desired state)             │    │   │
│  │   │  • etcd (cluster database)                                  │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │   │    NODE 1     │  │    NODE 2     │  │    NODE 3     │          │   │
│  │   │  (Worker VM)  │  │  (Worker VM)  │  │  (Worker VM)  │          │   │
│  │   │               │  │               │  │               │          │   │
│  │   │  ┌─────────┐  │  │  ┌─────────┐  │  │  ┌─────────┐  │          │   │
│  │   │  │  Pod A  │  │  │  │  Pod C  │  │  │  │  Pod E  │  │          │   │
│  │   │  └─────────┘  │  │  └─────────┘  │  │  └─────────┘  │          │   │
│  │   │  ┌─────────┐  │  │  ┌─────────┐  │  │  ┌─────────┐  │          │   │
│  │   │  │  Pod B  │  │  │  │  Pod D  │  │  │  │  Pod F  │  │          │   │
│  │   │  └─────────┘  │  │  └─────────┘  │  │  └─────────┘  │          │   │
│  │   │               │  │               │  │               │          │   │
│  │   └───────────────┘  └───────────────┘  └───────────────┘          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  NODE                                                                       │
│  ════                                                                       │
│  A node is a worker machine (VM) that runs containers.                      │
│  • Has CPU, memory, disk                                                    │
│  • Runs multiple pods                                                       │
│  • GKE manages node provisioning                                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  POD                                                                        │
│  ═══                                                                        │
│  Smallest deployable unit. Usually contains ONE container.                  │
│                                                                             │
│  ┌────────────────────────────────────────────┐                            │
│  │                    POD                      │                            │
│  │  ┌──────────────────────────────────────┐  │                            │
│  │  │           CONTAINER                   │  │                            │
│  │  │     (hta-calibration:v1.0)           │  │                            │
│  │  └──────────────────────────────────────┘  │                            │
│  │                                            │                            │
│  │  • IP Address: 10.0.0.5                    │                            │
│  │  • Port: 3000                              │                            │
│  │  • Volume mounts                           │                            │
│  │  • Environment variables                   │                            │
│  └────────────────────────────────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployments and Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENTS AND SERVICES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DEPLOYMENT                                                                 │
│  ══════════                                                                 │
│  Declares the desired state: "I want 3 pods running hta-app:v1.0"           │
│  Kubernetes makes it happen!                                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Deployment: hta-calibration                                        │   │
│  │   Replicas: 3                                                        │   │
│  │   Image: hta-calibration:v1.0                                        │   │
│  │                                                                      │   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐                       │   │
│  │   │  Pod 1  │     │  Pod 2  │     │  Pod 3  │                       │   │
│  │   │  v1.0   │     │  v1.0   │     │  v1.0   │                       │   │
│  │   └─────────┘     └─────────┘     └─────────┘                       │   │
│  │                                                                      │   │
│  │   If Pod 1 crashes → Kubernetes auto-creates Pod 4                   │   │
│  │   If you change to v2.0 → Rolling update, no downtime               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SERVICE                                                                    │
│  ═══════                                                                    │
│  Stable network endpoint for accessing pods.                                │
│  Pods come and go, but the service IP stays the same!                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │         Service: hta-calibration-svc                                 │   │
│  │         IP: 10.100.0.50:80                                           │   │
│  │                     │                                                │   │
│  │                     │ Load balances to:                              │   │
│  │       ┌─────────────┼─────────────┐                                 │   │
│  │       │             │             │                                  │   │
│  │       ▼             ▼             ▼                                  │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                             │   │
│  │   │  Pod 1  │  │  Pod 2  │  │  Pod 3  │                             │   │
│  │   │10.0.0.5 │  │10.0.0.6 │  │10.0.0.7 │                             │   │
│  │   └─────────┘  └─────────┘  └─────────┘                             │   │
│  │                                                                      │   │
│  │   Other services connect to: hta-calibration-svc:80                  │   │
│  │   (Not individual pod IPs!)                                          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Our GKE Architecture

### HTA Calibration Kubernetes Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HTA CALIBRATION GKE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        GKE CLUSTER                                   │   │
│  │                  (asia-southeast1 - Singapore)                       │   │
│  │                                                                      │   │
│  │   NAMESPACES:                                                        │   │
│  │   ═══════════                                                        │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │  production                                                   │  │   │
│  │   │  ───────────────────────────────────────────────────────────  │  │   │
│  │   │                                                               │  │   │
│  │   │   DEPLOYMENTS:                                                │  │   │
│  │   │   ┌─────────────────────────────────────────────────────────┐│  │   │
│  │   │   │  hta-web (Next.js App)                                  ││  │   │
│  │   │   │  Replicas: 3-10 (autoscaling)                           ││  │   │
│  │   │   │                                                          ││  │   │
│  │   │   │  ┌───────┐ ┌───────┐ ┌───────┐ ... ┌───────┐           ││  │   │
│  │   │   │  │ Pod 1 │ │ Pod 2 │ │ Pod 3 │     │ Pod N │           ││  │   │
│  │   │   │  └───────┘ └───────┘ └───────┘     └───────┘           ││  │   │
│  │   │   └─────────────────────────────────────────────────────────┘│  │   │
│  │   │                                                               │  │   │
│  │   │   ┌─────────────────────────────────────────────────────────┐│  │   │
│  │   │   │  hta-worker (Background Jobs)                           ││  │   │
│  │   │   │  Replicas: 2                                            ││  │   │
│  │   │   │                                                          ││  │   │
│  │   │   │  ┌───────┐ ┌───────┐                                    ││  │   │
│  │   │   │  │ Pod 1 │ │ Pod 2 │                                    ││  │   │
│  │   │   │  └───────┘ └───────┘                                    ││  │   │
│  │   │   └─────────────────────────────────────────────────────────┘│  │   │
│  │   │                                                               │  │   │
│  │   │   SERVICES:                                                   │  │   │
│  │   │   • hta-web-svc (ClusterIP)                                   │  │   │
│  │   │   • hta-worker-svc (ClusterIP)                                │  │   │
│  │   │                                                               │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │  staging                                                      │  │   │
│  │   │  ─────────────────────────────────────────────────────────── │  │   │
│  │   │  (Same structure, smaller replicas, for testing)             │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Kubernetes YAML Configuration

```yaml
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KUBERNETES CONFIGURATION FILES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  # k8s/deployment.yaml                                                      │
│                                                                             │
│  apiVersion: apps/v1                                                        │
│  kind: Deployment                                                           │
│  metadata:                                                                  │
│    name: hta-web                                                            │
│    namespace: production                                                    │
│  spec:                                                                      │
│    replicas: 3                          # Start with 3 pods                 │
│    selector:                                                                │
│      matchLabels:                                                           │
│        app: hta-web                                                         │
│    template:                                                                │
│      metadata:                                                              │
│        labels:                                                              │
│          app: hta-web                                                       │
│      spec:                                                                  │
│        containers:                                                          │
│        - name: hta-web                                                      │
│          image: gcr.io/hta-project/hta-calibration:v1.0.0                   │
│          ports:                                                             │
│          - containerPort: 3000                                              │
│          env:                                                               │
│          - name: DATABASE_URL                                               │
│            valueFrom:                                                       │
│              secretKeyRef:                                                  │
│                name: hta-secrets                                            │
│                key: database-url                                            │
│          resources:                                                         │
│            requests:                     # Minimum resources                │
│              cpu: "250m"                 # 0.25 CPU cores                   │
│              memory: "512Mi"             # 512 MB RAM                       │
│            limits:                       # Maximum resources                │
│              cpu: "1000m"                # 1 CPU core                       │
│              memory: "1Gi"               # 1 GB RAM                         │
│          livenessProbe:                  # Is the container alive?          │
│            httpGet:                                                         │
│              path: /api/health                                              │
│              port: 3000                                                     │
│            initialDelaySeconds: 30                                          │
│            periodSeconds: 10                                                │
│          readinessProbe:                 # Is it ready for traffic?         │
│            httpGet:                                                         │
│              path: /api/health                                              │
│              port: 3000                                                     │
│            initialDelaySeconds: 5                                           │
│            periodSeconds: 5                                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  # k8s/service.yaml                                                         │
│                                                                             │
│  apiVersion: v1                                                             │
│  kind: Service                                                              │
│  metadata:                                                                  │
│    name: hta-web-svc                                                        │
│    namespace: production                                                    │
│  spec:                                                                      │
│    selector:                                                                │
│      app: hta-web                        # Route to pods with this label    │
│    ports:                                                                   │
│    - port: 80                            # Service listens on 80            │
│      targetPort: 3000                    # Forward to container port 3000   │
│    type: ClusterIP                       # Internal only                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Auto-Scaling

### Horizontal Pod Autoscaler (HPA)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HORIZONTAL POD AUTOSCALER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Automatically adjusts the number of pods based on metrics:                 │
│                                                                             │
│  NORMAL TRAFFIC (9 AM):                 PEAK TRAFFIC (Conference demo!):    │
│  ═════════════════════                  ════════════════════════════════    │
│                                                                             │
│  CPU: 30%                               CPU: 85%                            │
│  ┌───────┐ ┌───────┐ ┌───────┐         ┌───────┐ ┌───────┐ ┌───────┐      │
│  │ Pod 1 │ │ Pod 2 │ │ Pod 3 │         │ Pod 1 │ │ Pod 2 │ │ Pod 3 │      │
│  └───────┘ └───────┘ └───────┘         └───────┘ └───────┘ └───────┘      │
│                                        ┌───────┐ ┌───────┐ ┌───────┐      │
│  3 pods is enough!                     │ Pod 4 │ │ Pod 5 │ │ Pod 6 │      │
│                                        └───────┘ └───────┘ └───────┘      │
│                                        ┌───────┐ ┌───────┐ ┌───────┐      │
│                                        │ Pod 7 │ │ Pod 8 │ │ Pod 9 │      │
│                                        └───────┘ └───────┘ └───────┘      │
│                                                                             │
│                                        Scaled to 9 pods automatically!      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  # k8s/hpa.yaml                                                             │
│                                                                             │
│  apiVersion: autoscaling/v2                                                 │
│  kind: HorizontalPodAutoscaler                                              │
│  metadata:                                                                  │
│    name: hta-web-hpa                                                        │
│    namespace: production                                                    │
│  spec:                                                                      │
│    scaleTargetRef:                                                          │
│      apiVersion: apps/v1                                                    │
│      kind: Deployment                                                       │
│      name: hta-web                                                          │
│    minReplicas: 3                        # Never go below 3 pods            │
│    maxReplicas: 10                       # Never exceed 10 pods             │
│    metrics:                                                                 │
│    - type: Resource                                                         │
│      resource:                                                              │
│        name: cpu                                                            │
│        target:                                                              │
│          type: Utilization                                                  │
│          averageUtilization: 70          # Scale when CPU > 70%             │
│    - type: Resource                                                         │
│      resource:                                                              │
│        name: memory                                                         │
│        target:                                                              │
│          type: Utilization                                                  │
│          averageUtilization: 80          # Scale when memory > 80%          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Node Auto-Provisioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NODE AUTO-PROVISIONING                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GKE can automatically add/remove NODES (VMs) too!                          │
│                                                                             │
│  SITUATION: All 10 pods running, but still need more                        │
│  ──────────────────────────────────────────────────                         │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐                                      │
│  │    NODE 1     │  │    NODE 2     │                                      │
│  │  (FULL!)      │  │  (FULL!)      │   All nodes at capacity!             │
│  │ ┌───┐┌───┐    │  │ ┌───┐┌───┐    │                                      │
│  │ │P1 ││P2 │    │  │ │P6 ││P7 │    │   HPA wants to create Pod 11,       │
│  │ └───┘└───┘    │  │ └───┘└───┘    │   but there's no room!               │
│  │ ┌───┐┌───┐    │  │ ┌───┐┌───┐    │                                      │
│  │ │P3 ││P4 │    │  │ │P8 ││P9 │    │                                      │
│  │ └───┘└───┘    │  │ └───┘└───┘    │                                      │
│  │ ┌───┐         │  │ ┌───┐         │                                      │
│  │ │P5 │         │  │ │P10│         │                                      │
│  │ └───┘         │  │ └───┘         │                                      │
│  └───────────────┘  └───────────────┘                                      │
│                                                                             │
│                            │                                                │
│                            ▼ GKE Auto-Provisioning kicks in                 │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │    NODE 1     │  │    NODE 2     │  │    NODE 3     │ ← NEW!            │
│  │ ┌───┐┌───┐    │  │ ┌───┐┌───┐    │  │ ┌───┐┌───┐    │                   │
│  │ │P1 ││P2 │    │  │ │P6 ││P7 │    │  │ │P11││P12│    │                   │
│  │ └───┘└───┘    │  │ └───┘└───┘    │  │ └───┘└───┘    │                   │
│  │ ┌───┐┌───┐    │  │ ┌───┐┌───┐    │  │               │                   │
│  │ │P3 ││P4 │    │  │ │P8 ││P9 │    │  │  Room for     │                   │
│  │ └───┘└───┘    │  │ └───┘└───┘    │  │  more pods!   │                   │
│  │ ┌───┐         │  │ ┌───┐         │  │               │                   │
│  │ │P5 │         │  │ │P10│         │  │               │                   │
│  │ └───┘         │  │ └───┘         │  │               │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
│                                                                             │
│  When traffic decreases:                                                    │
│  • HPA removes pods                                                         │
│  • GKE removes empty nodes (cost savings!)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Zero-Downtime Deployments

### Rolling Update Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ZERO-DOWNTIME DEPLOYMENTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ROLLING UPDATE (Default)                                                   │
│  ═══════════════════════                                                    │
│                                                                             │
│  Deploying v1.0 → v2.0                                                      │
│                                                                             │
│  Step 1: Start with v1.0                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐                       │   │
│  │   │  v1.0   │     │  v1.0   │     │  v1.0   │                       │   │
│  │   │ (ready) │     │ (ready) │     │ (ready) │                       │   │
│  │   └─────────┘     └─────────┘     └─────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 2: Start one v2.0 pod                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐       │   │
│  │   │  v1.0   │     │  v1.0   │     │  v1.0   │     │  v2.0   │       │   │
│  │   │ (ready) │     │ (ready) │     │ (ready) │     │(starting)│      │   │
│  │   └─────────┘     └─────────┘     └─────────┘     └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 3: v2.0 passes health check → terminate one v1.0                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐                       │   │
│  │   │ ~~v1.0~~│     │  v1.0   │     │  v2.0   │                       │   │
│  │   │(terminating)  │ (ready) │     │ (ready) │                       │   │
│  │   └─────────┘     └─────────┘     └─────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 4: Continue until all pods are v2.0                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐                       │   │
│  │   │  v2.0   │     │  v2.0   │     │  v2.0   │                       │   │
│  │   │ (ready) │     │ (ready) │     │ (ready) │                       │   │
│  │   └─────────┘     └─────────┘     └─────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Users experienced ZERO downtime! ✅                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Deployment config:                                                         │
│                                                                             │
│  spec:                                                                      │
│    strategy:                                                                │
│      type: RollingUpdate                                                    │
│      rollingUpdate:                                                         │
│        maxSurge: 1         # Can add 1 extra pod during update             │
│        maxUnavailable: 0   # Never have fewer than desired pods            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CONTAINERS                                                              │
│     Package your app with all dependencies                                  │
│     Same environment everywhere                                             │
│                                                                             │
│  2. KUBERNETES                                                              │
│     Orchestrates containers at scale                                        │
│     Auto-healing, auto-scaling, zero-downtime deploys                       │
│                                                                             │
│  3. GKE                                                                     │
│     Google-managed Kubernetes                                               │
│     No need to manage control plane                                         │
│                                                                             │
│  4. KEY RESOURCES                                                           │
│     • Pod: Running container(s)                                             │
│     • Deployment: Desired state (replicas, image)                           │
│     • Service: Stable network endpoint                                      │
│     • HPA: Auto-scale pods based on metrics                                 │
│                                                                             │
│  5. SCALING                                                                 │
│     • Horizontal: More pods (HPA)                                           │
│     • Vertical: Bigger pods (more CPU/memory)                               │
│     • Nodes: GKE auto-provisions VMs                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [08. Auto-Scaling & Load Balancing](./08_autoscaling_loadbalancing.md) - Deep dive into scaling
- [09. Event-Driven Architecture](./09_event_architecture.md) - Async processing patterns
