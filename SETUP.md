# IGD-Orbit Setup Guide

## Prerequisites

- Node.js 20 LTS or higher
- Docker and Docker Compose (for local development)
- PostgreSQL 16 (if not using Docker)
- Redis 7 (if not using Docker)

## Initial Setup

### 1. Install Dependencies

```bash
# From root directory
# Note: Use --legacy-peer-deps to resolve dependency conflicts
npm install --legacy-peer-deps
```

**Note:** If you encounter dependency conflicts, use `--legacy-peer-deps` flag. This is safe and commonly used for monorepo setups.

### 2. Start Docker Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait a few seconds for services to initialize
# Verify services are running
docker-compose ps

# If you get authentication errors, reset the database:
# docker-compose down -v
# docker-compose up -d
```

### 3. Configure Environment Variables

#### Backend

```bash
cd backend
# Windows PowerShell
Copy-Item .env.example .env
# Or manually: copy .env.example .env

# Linux/Mac
# cp .env.example .env
# Edit .env with your configuration
# Update DATABASE_URL, JWT_SECRET, etc.
```

#### Frontend

```bash
cd frontend
# Windows PowerShell
Copy-Item .env.example .env
# Or manually: copy .env.example .env

# Linux/Mac
# cp .env.example .env

# Edit .env with your configuration if needed
# Default values should work for local development
```

### 4. Setup Database

```bash
cd backend

# Generate Prisma Client (must be done first)
npm run prisma:generate

# Push schema to database (for initial setup)
# This creates the database schema without migrations
npx prisma db push

# OR create a migration (for version control)
# npx prisma migrate dev --name init
# Note: This is interactive, so run it manually in your terminal

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

**Note:** 
- Make sure Docker services (PostgreSQL) are running before running database commands
- Use `prisma db push` for quick setup, or `prisma migrate dev` for proper migration tracking

### 5. Start Development Servers

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

## Project Structure

```
igd-orbit/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── modules/      # Feature modules
│   │   ├── shared/       # Shared utilities
│   │   ├── config/       # Configuration
│   │   └── main.ts
│   └── prisma/           # Prisma schema
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # Route pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API services
│   │   ├── stores/       # Zustand stores
│   │   ├── utils/        # Utilities
│   │   └── types/        # TypeScript types
└── shared/               # Shared types & utilities
```

## Available Scripts

### Root
- `npm run dev:backend` - Start backend dev server
- `npm run dev:frontend` - Start frontend dev server
- `npm run build` - Build all projects
- `npm run lint` - Lint all projects

### Backend
- `npm run dev` - Start with hot reload
- `npm run build` - Build for production
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run migrations
- `npm run prisma:studio` - Open Prisma Studio

### Frontend
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Next Steps

1. ✅ Project initialized
2. ⏳ Setup authentication module
3. ⏳ Create database schema
4. ⏳ Implement first feature module

