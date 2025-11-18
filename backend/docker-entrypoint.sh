#!/bin/sh
set -e

echo "🚀 Starting backend service..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  # Try to connect to database using Prisma
  if node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { prisma.\$disconnect(); process.exit(0); }).catch(() => { process.exit(1); });" > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Database is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Database connection failed after $max_attempts attempts"
  exit 1
fi

# Run migrations
echo "🔄 Running database migrations..."
if npx prisma migrate deploy > /dev/null 2>&1; then
  echo "✅ Migrations deployed successfully!"
else
  echo "⚠️  Migrate deploy failed, trying db push..."
  npx prisma db push --accept-data-loss --skip-generate || {
    echo "❌ Migration failed!"
    exit 1
  }
  echo "✅ Database schema pushed successfully!"
fi

# Start the application
echo "🚀 Starting NestJS application..."
exec "$@"

