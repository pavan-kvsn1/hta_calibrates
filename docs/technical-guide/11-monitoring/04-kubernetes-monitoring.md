# Kubernetes Monitoring

## Overview

Monitor Kubernetes resources using kubectl, metrics-server, and GKE-native tools.

---

## Quick Health Check

```bash
# One-liner status check
kubectl get pods,svc,hpa,pdb -n hta-calibration

# Detailed deployment status
kubectl rollout status deployment/hta-web -n hta-calibration

# Recent events (problems show here first)
kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -20
```

---

## Pod Monitoring

### Pod Status

```bash
# Basic pod listing
kubectl get pods -n hta-calibration

# Wide output (shows node, IP)
kubectl get pods -n hta-calibration -o wide

# Watch for changes
kubectl get pods -n hta-calibration -w
```

**Common Status Values:**

| Status | Meaning | Action |
|--------|---------|--------|
| `Running` | Pod healthy | None |
| `Pending` | Waiting for resources | Check node capacity |
| `ContainerCreating` | Pulling image/creating | Wait or check events |
| `CrashLoopBackOff` | Container crashing repeatedly | Check logs |
| `ImagePullBackOff` | Can't pull image | Check image name/creds |
| `OOMKilled` | Out of memory | Increase memory limits |
| `Evicted` | Node under pressure | Check node resources |

### Pod Details

```bash
# Describe pod (events, conditions, containers)
kubectl describe pod hta-web-xxx -n hta-calibration

# Key sections to look at:
# - Conditions: Ready, ContainersReady, PodScheduled
# - Containers: State, Ready, Restart Count
# - Events: Recent warnings/errors
```

### Pod Logs

```bash
# Current logs
kubectl logs hta-web-xxx -n hta-calibration

# Follow logs (like tail -f)
kubectl logs -f hta-web-xxx -n hta-calibration

# Previous container logs (after crash)
kubectl logs hta-web-xxx -n hta-calibration --previous

# All pods in deployment
kubectl logs -l app.kubernetes.io/name=hta-web -n hta-calibration

# Last 100 lines
kubectl logs hta-web-xxx -n hta-calibration --tail=100

# Since specific time
kubectl logs hta-web-xxx -n hta-calibration --since=1h
```

### Pod Resource Usage

```bash
# CPU and memory usage (requires metrics-server)
kubectl top pods -n hta-calibration

# Sort by memory
kubectl top pods -n hta-calibration --sort-by=memory

# Specific pod
kubectl top pod hta-web-xxx -n hta-calibration
```

**Example Output:**
```
NAME            CPU(cores)   MEMORY(bytes)
hta-web-abc     50m          256Mi
hta-web-xyz     75m          312Mi
```

### Execute Commands in Pod

```bash
# Interactive shell
kubectl exec -it hta-web-xxx -n hta-calibration -- /bin/sh

# Run single command
kubectl exec hta-web-xxx -n hta-calibration -- curl localhost:3000/api/health

# Check environment
kubectl exec hta-web-xxx -n hta-calibration -- env | grep DATABASE

# Check processes
kubectl exec hta-web-xxx -n hta-calibration -- ps aux

# Check network
kubectl exec hta-web-xxx -n hta-calibration -- netstat -tlnp
```

---

## Deployment Monitoring

### Deployment Status

```bash
# List deployments
kubectl get deployments -n hta-calibration

# Rollout status
kubectl rollout status deployment/hta-web -n hta-calibration

# Rollout history
kubectl rollout history deployment/hta-web -n hta-calibration

# Describe deployment
kubectl describe deployment hta-web -n hta-calibration
```

**Output Explained:**
```
NAME      READY   UP-TO-DATE   AVAILABLE   AGE
hta-web   2/2     2            2           5d

READY: Running pods / Desired pods
UP-TO-DATE: Pods with latest spec
AVAILABLE: Pods passing readiness
```

### ReplicaSet Status

```bash
# List ReplicaSets
kubectl get rs -n hta-calibration

# Watch for changes during rollout
kubectl get rs -n hta-calibration -w
```

---

## Service Monitoring

### Service Status

```bash
# List services
kubectl get svc -n hta-calibration

# Service details
kubectl describe svc hta-web -n hta-calibration

# Check endpoints (pods receiving traffic)
kubectl get endpoints hta-web -n hta-calibration
```

**Empty Endpoints:**
```
NAME      ENDPOINTS
hta-web   <none>    # Problem! No pods are ready
```

### Test Service Connectivity

```bash
# From inside cluster
kubectl run tmp-shell --rm -i --tty --image=busybox -n hta-calibration -- /bin/sh
# Then: wget -qO- http://hta-web:80/api/health

# Port forward for local testing
kubectl port-forward svc/hta-web 8080:80 -n hta-calibration
# Then: curl http://localhost:8080/api/health
```

---

## HPA Monitoring

### HPA Status

```bash
# List HPAs
kubectl get hpa -n hta-calibration

# Watch HPA
kubectl get hpa -n hta-calibration -w

# Describe HPA (detailed scaling info)
kubectl describe hpa hta-web -n hta-calibration
```

**Output Explained:**
```
NAME      REFERENCE            TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
hta-web   Deployment/hta-web   25%/70%, 40%/80%   1         5         2          5d

TARGETS: Current/Target (CPU%, Memory%)
```

### HPA Events

Look for scaling events:
```bash
kubectl describe hpa hta-web -n hta-calibration | grep -A 20 "Events:"
```

**Example Events:**
```
Events:
  Type    Reason             Age   Message
  ----    ------             ----  -------
  Normal  SuccessfulRescale  1m    New size: 3; reason: cpu resource utilization above target
  Normal  SuccessfulRescale  5m    New size: 2; reason: All metrics below target
```

---

## Node Monitoring

### Node Status

```bash
# List nodes
kubectl get nodes

# Wide output
kubectl get nodes -o wide

# Describe node
kubectl describe node NODE_NAME
```

### Node Resource Usage

```bash
# CPU and memory across all nodes
kubectl top nodes

# Pods on specific node
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=NODE_NAME
```

### Node Conditions

```bash
# Check node conditions
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .status.conditions[*]}{.type}={.status}{"\t"}{end}{"\n"}{end}'
```

**Healthy Output:**
```
node-1    MemoryPressure=False    DiskPressure=False    PIDPressure=False    Ready=True
```

---

## Events Monitoring

### View Events

```bash
# All events in namespace
kubectl get events -n hta-calibration

# Sort by timestamp
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'

# Filter by type
kubectl get events -n hta-calibration --field-selector type=Warning

# Watch for new events
kubectl get events -n hta-calibration -w
```

### Common Warning Events

| Event | Meaning | Action |
|-------|---------|--------|
| `FailedScheduling` | No node has resources | Add nodes or reduce requests |
| `FailedMount` | Secret/ConfigMap not found | Check secret exists |
| `ImagePullBackOff` | Can't pull image | Check image name, registry auth |
| `Unhealthy` | Probe failed | Check logs, fix app |
| `EvictionThresholdMet` | Node under memory pressure | Check node resources |
| `OOMKilling` | Container exceeded memory | Increase memory limit |

---

## ConfigMap and Secret Monitoring

### View ConfigMaps

```bash
# List ConfigMaps
kubectl get configmaps -n hta-calibration

# View ConfigMap content
kubectl describe configmap hta-config -n hta-calibration

# Get specific key
kubectl get configmap hta-config -n hta-calibration -o jsonpath='{.data.NODE_ENV}'
```

### View Secrets (metadata only)

```bash
# List Secrets
kubectl get secrets -n hta-calibration

# Describe Secret (shows keys, not values)
kubectl describe secret hta-secrets -n hta-calibration

# Decode secret value (use carefully)
kubectl get secret hta-secrets -n hta-calibration -o jsonpath='{.data.database-url}' | base64 -d
```

---

## PDB (PodDisruptionBudget) Status

```bash
# View PDB
kubectl get pdb -n hta-calibration

# Describe PDB
kubectl describe pdb hta-web -n hta-calibration
```

**Output:**
```
NAME      MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
hta-web   1               N/A               1                     5d
```

---

## Network Debugging

### DNS Resolution

```bash
# Test DNS from pod
kubectl exec -it hta-web-xxx -n hta-calibration -- nslookup hta-web.hta-calibration.svc.cluster.local

# Test external DNS
kubectl exec -it hta-web-xxx -n hta-calibration -- nslookup google.com
```

### Network Connectivity

```bash
# Test internal service
kubectl exec -it hta-web-xxx -n hta-calibration -- curl -s http://hta-web:80/api/health

# Test external connectivity
kubectl exec -it hta-web-xxx -n hta-calibration -- curl -s https://google.com

# Check listening ports
kubectl exec -it hta-web-xxx -n hta-calibration -- netstat -tlnp
```

---

## Monitoring Dashboard Commands

### Quick Status Script

```bash
#!/bin/bash
# save as check-status.sh

echo "=== PODS ==="
kubectl get pods -n hta-calibration

echo -e "\n=== RESOURCE USAGE ==="
kubectl top pods -n hta-calibration 2>/dev/null || echo "Metrics not available"

echo -e "\n=== HPA ==="
kubectl get hpa -n hta-calibration

echo -e "\n=== RECENT EVENTS ==="
kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -10

echo -e "\n=== ENDPOINTS ==="
kubectl get endpoints -n hta-calibration
```

### Watch Multiple Resources

```bash
# Using watch command
watch -n 5 'kubectl get pods,hpa -n hta-calibration'

# Using kubectl -w (separate terminal per resource)
kubectl get pods -n hta-calibration -w &
kubectl get events -n hta-calibration -w &
```

---

## Troubleshooting Flowchart

```
┌─────────────────────────────────────────────────────────────────┐
│                  K8S TROUBLESHOOTING FLOWCHART                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pod not running?                                                │
│        │                                                         │
│        ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ Check pod status│                                            │
│  │ kubectl get pod │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│   ┌───────┼───────────────────────────────────┐                 │
│   │       │                                   │                 │
│   ▼       ▼                                   ▼                 │
│ Pending  CrashLoop                    ImagePullBackOff          │
│   │       │                                   │                 │
│   ▼       ▼                                   ▼                 │
│ Check    Check logs                    Check image name         │
│ events   kubectl logs --previous       Check registry access    │
│   │       │                                                     │
│   ▼       ▼                                                     │
│ Node     App crash?                                             │
│ resources Memory issue?                                         │
│           │                                                     │
│           ▼                                                     │
│   Fix app or increase resources                                 │
│                                                                 │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Pod running but not ready?                                     │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────────────┐                                           │
│  │ Check probe      │                                           │
│  │ kubectl describe │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│   ┌───────┼───────────────────┐                                 │
│   │       │                   │                                 │
│   ▼       ▼                   ▼                                 │
│ Liveness Readiness      Both failing                           │
│ failing  failing             │                                 │
│   │       │                   ▼                                 │
│   ▼       ▼               Check deps                           │
│ App      Check DB         (DB, Redis)                          │
│ crashed  connection                                             │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  No traffic reaching pod?                                       │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────────────────┐                                       │
│  │ Check endpoints      │                                       │
│  │ kubectl get endpoints│                                       │
│  └────────┬─────────────┘                                       │
│           │                                                      │
│   ┌───────┴───────┐                                             │
│   │               │                                             │
│   ▼               ▼                                             │
│ Empty           Has IPs                                         │
│   │               │                                             │
│   ▼               ▼                                             │
│ Pod not         Check ingress                                   │
│ ready           Check service selector                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lens Integration

For visual monitoring, use Lens (Kubernetes IDE):

1. Download from https://k8slens.dev/
2. Add cluster: `File > Add Cluster > Paste kubeconfig`
3. Navigate to:
   - Workloads > Pods (see pod status, logs)
   - Network > Services (see endpoints)
   - Config > ConfigMaps/Secrets
   - Events (real-time event stream)

See [13-tools/03-lens.md](../13-tools/03-lens.md) for detailed Lens usage.

---

## Common Commands Reference

```bash
# === PODS ===
kubectl get pods -n hta-calibration
kubectl describe pod POD_NAME -n hta-calibration
kubectl logs POD_NAME -n hta-calibration
kubectl logs -f POD_NAME -n hta-calibration  # Follow
kubectl logs POD_NAME -n hta-calibration --previous  # After crash
kubectl exec -it POD_NAME -n hta-calibration -- /bin/sh
kubectl top pods -n hta-calibration

# === DEPLOYMENTS ===
kubectl get deployments -n hta-calibration
kubectl describe deployment DEPLOY_NAME -n hta-calibration
kubectl rollout status deployment/DEPLOY_NAME -n hta-calibration
kubectl rollout history deployment/DEPLOY_NAME -n hta-calibration
kubectl rollout undo deployment/DEPLOY_NAME -n hta-calibration

# === SERVICES ===
kubectl get svc -n hta-calibration
kubectl describe svc SERVICE_NAME -n hta-calibration
kubectl get endpoints SERVICE_NAME -n hta-calibration

# === EVENTS ===
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'
kubectl get events -n hta-calibration --field-selector type=Warning

# === HPA ===
kubectl get hpa -n hta-calibration
kubectl describe hpa HPA_NAME -n hta-calibration

# === DEBUGGING ===
kubectl port-forward svc/hta-web 8080:80 -n hta-calibration
kubectl run debug --rm -it --image=busybox -n hta-calibration -- /bin/sh
```
