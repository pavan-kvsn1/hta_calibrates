#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || echo "Migration failed or already up to date"

echo "Starting application..."
exec node server.js
