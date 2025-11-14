# IGD-Orbit Backend

NestJS API for IGD Group ERP System.

## 🚀 Getting Started

### Prerequisites
- Node.js 20 LTS or higher
- PostgreSQL 16
- Redis 7

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup Prisma
npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── modules/          # Feature modules
│   ├── shared/           # Shared utilities
│   ├── config/           # Configuration
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
├── prisma/               # Prisma schema and migrations
├── test/                 # E2E tests
└── dist/                 # Compiled output
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run E2E tests
- `npm run lint` - Lint code
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## 📚 Documentation

See `/prd` directory for complete API specifications.
