# Docker Compose Configurations

## Overview

HTA Calibration provides multiple Docker Compose configurations for different use cases: local development, integration testing, and visual regression testing.

---

## Available Configurations

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.dev.yml` | Local development | Full stack with PostgreSQL |
| `docker-compose.test.yml` | Integration testing | PostgreSQL on port 5433 |
| `docker-compose.playwright.yml` | Visual regression | Playwright baseline generation |

---

## Development Setup

### docker-compose.dev.yml

Full development environment with PostgreSQL database.

```yaml
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: hta-postgres
    environment:
      POSTGRES_USER: hta_user
      POSTGRES_PASSWORD: hta_dev_password
      POSTGRES_DB: hta_calibration
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hta_user -d hta_calibration"]
      interval: 10s
      timeout: 5s
      retries: 5

  # HTA Calibration Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hta-app
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://hta_user:hta_dev_password@postgres:5432/hta_calibration
      NEXTAUTH_SECRET: dev-secret-change-in-production
      NEXTAUTH_URL: http://localhost:3000
      NODE_ENV: development
    ports:
      - "3000:3000"
```

### Usage

```bash
# Start all services
docker compose -f docker-compose.dev.yml up

# Start in background
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop all services
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (reset database)
docker compose -f docker-compose.dev.yml down -v
```

### Hot Reload Development

To enable hot reload during development, uncomment the volumes section in the app service:

```yaml
app:
  volumes:
    - ./src:/app/src:ro
    - ./public:/app/public:ro
```

---

## Integration Testing Setup

### docker-compose.test.yml

Optimized PostgreSQL instance for integration tests. Uses port 5433 to avoid conflicts with development database.

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    container_name: hta-postgres-test
    environment:
      POSTGRES_USER: hta_test
      POSTGRES_PASSWORD: hta_test_password
      POSTGRES_DB: hta_calibration_test
    ports:
      - "5433:5432"  # Different port to avoid conflicts
    # Optimize for testing (faster writes, less durability)
    command: >
      postgres
      -c fsync=off
      -c synchronous_commit=off
      -c full_page_writes=off
      -c max_connections=100
```

### Test Optimization Flags

| Flag | Purpose | Effect |
|------|---------|--------|
| `fsync=off` | Disable disk sync | Faster writes, data loss on crash |
| `synchronous_commit=off` | Async commits | Reduced latency |
| `full_page_writes=off` | Skip full page writes | Faster recovery |
| `max_connections=100` | Allow many test connections | Parallel test support |

### Usage

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d

# Wait for healthy
docker compose -f docker-compose.test.yml ps

# Run tests
DATABASE_URL=postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test \
  npm run test

# Reset database between test suites
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
```

### Connection String

```
DATABASE_URL=postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test
```

---

## Visual Regression Testing

### docker-compose.playwright.yml

Generates Playwright visual regression baselines in a consistent Linux environment.

```yaml
services:
  playwright:
    build:
      context: .
      dockerfile: Dockerfile.playwright
    volumes:
      # Mount snapshots directory to persist baselines
      - ./tests/e2e/evals/visual-regression.spec.ts-snapshots:/app/tests/e2e/evals/visual-regression.spec.ts-snapshots
```

### Why Docker for Visual Tests?

Visual regression tests are sensitive to rendering differences between platforms:
- Font rendering varies between Windows, macOS, and Linux
- Anti-aliasing algorithms differ
- Subpixel rendering creates inconsistencies

Using Docker ensures baselines are generated in the same Linux environment as CI/CD.

### Usage

```bash
# Generate visual baselines
npm run test:visual:docker

# Or manually
docker compose -f docker-compose.playwright.yml up --build --abort-on-container-exit

# After running, commit the snapshot files
git add tests/e2e/evals/visual-regression.spec.ts-snapshots/
git commit -m "Update visual regression baselines"
```

---

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE DEPENDENCIES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  docker-compose.dev.yml                                         │
│  ────────────────────────                                       │
│                                                                  │
│    ┌──────────────┐      depends_on        ┌───────────┐        │
│    │   postgres   │◄──────────────────────│    app    │        │
│    │  (healthcheck│   (service_healthy)   │           │        │
│    │    ready)    │                       │           │        │
│    └──────────────┘                       └───────────┘        │
│          ▲                                      │               │
│          │                                      │               │
│          │              ┌───────────────────────┘               │
│          │              │                                       │
│          └──────────────┴── shared network: hta-network         │
│                                                                  │
│                                                                  │
│  docker-compose.test.yml                                        │
│  ────────────────────────                                       │
│                                                                  │
│    ┌─────────────────┐                                          │
│    │  postgres-test  │ ─── Standalone, no app dependency       │
│    │   (port 5433)   │                                          │
│    └─────────────────┘                                          │
│                                                                  │
│                                                                  │
│  docker-compose.playwright.yml                                  │
│  ─────────────────────────────                                  │
│                                                                  │
│    ┌────────────────┐                                           │
│    │   playwright   │ ─── Self-contained with app built-in     │
│    │ (Dockerfile.   │                                           │
│    │   playwright)  │                                           │
│    └────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

### Development Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://hta_user:...@postgres:5432/hta_calibration | PostgreSQL connection |
| `NEXTAUTH_SECRET` | dev-secret-change-in-production | JWT signing secret |
| `NEXTAUTH_URL` | http://localhost:3000 | Auth callback URL |
| `NODE_ENV` | development | Node environment |

### Test Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://hta_test:...@localhost:5433/hta_calibration_test | Test DB connection |

---

## Volume Management

### Named Volumes

| Volume | Purpose | Persist |
|--------|---------|---------|
| `pgdata` | Development PostgreSQL data | Yes |
| `postgres-test-data` | Test PostgreSQL data | Optional |

### Volume Commands

```bash
# List volumes
docker volume ls | grep hta

# Inspect volume
docker volume inspect docker-compose-dev-yml_pgdata

# Remove specific volume
docker volume rm docker-compose-dev-yml_pgdata

# Prune unused volumes
docker volume prune
```

---

## Network Configuration

### Development Network

```yaml
networks:
  hta-network:
    driver: bridge
```

All services communicate via service names:
- `postgres` - PostgreSQL database
- `app` - HTA Calibration application

### Container DNS

Services reference each other by name:

```
app → postgres:5432     (via docker network DNS)
host → localhost:3000   (via port mapping)
host → localhost:5432   (via port mapping)
```

---

## Optional: OpenSign Integration

For digital signature functionality, uncomment the OpenSign services in `docker-compose.dev.yml`:

```yaml
opensign-ui:
  image: opensignlabs/opensign:latest
  ports:
    - "3001:3000"
  environment:
    NEXT_PUBLIC_API_URL: http://localhost:8080

opensign-api:
  image: opensignlabs/opensign-server:latest
  ports:
    - "8080:8080"
  environment:
    MONGODB_URI: mongodb://mongodb:27017/opensign

mongodb:
  image: mongo:7
  ports:
    - "27017:27017"
  volumes:
    - mongodata:/data/db
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker compose -f docker-compose.dev.yml ps

# View container logs
docker compose -f docker-compose.dev.yml logs app
docker compose -f docker-compose.dev.yml logs postgres

# Check health status
docker inspect hta-postgres --format='{{.State.Health.Status}}'
```

### Database Connection Failed

```bash
# Verify postgres is running
docker compose -f docker-compose.dev.yml ps postgres

# Test connection manually
docker exec -it hta-postgres psql -U hta_user -d hta_calibration

# Check network connectivity
docker exec -it hta-app ping postgres
```

### Port Already in Use

```bash
# Find process using port 5432
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Use different port in docker-compose
ports:
  - "5434:5432"  # Map to 5434 instead
```

### Reset Everything

```bash
# Nuclear option: remove all containers, volumes, networks
docker compose -f docker-compose.dev.yml down -v --remove-orphans
docker system prune -f
```

---

## Best Practices

1. **Use named volumes** for data persistence
2. **Health checks** ensure dependencies are ready before starting dependents
3. **Use `depends_on` with `condition: service_healthy`** for proper startup order
4. **Different ports for test DB** (5433) to avoid conflicts with dev (5432)
5. **Mount only necessary directories** for hot reload to avoid conflicts
6. **Use `.env` files** for environment-specific configuration

---

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Local development stack |
| `docker-compose.test.yml` | Integration test database |
| `docker-compose.playwright.yml` | Visual regression testing |
| `.env` | Environment variables (not committed) |
| `.env.example` | Template for environment variables |
