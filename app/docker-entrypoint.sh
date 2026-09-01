#!/bin/sh
set -e

echo "Waiting for MySQL..."
until node -e "
require('mysql2/promise')
  .createConnection(process.env.DATABASE_URL)
  .then((c) => { c.end(); process.exit(0); })
  .catch(() => process.exit(1));
"; do
  echo "MySQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "Applying database schema..."
npx drizzle-kit push --force

echo "Seeding database (idempotent, skips if already populated)..."
npx tsx db/seed.ts
npx tsx db/seed-expansion.ts

echo "Starting Greensheet server..."
exec node dist/boot.js
