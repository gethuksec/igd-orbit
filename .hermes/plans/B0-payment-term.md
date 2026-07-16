# B0 — PaymentTerm Master Data

## Scope
Add PaymentTerm as a new master data entity under the Master Data menu.

## Backend
1. Add `PaymentTerm` model to Prisma schema
2. Generate migration
3. Create NestJS module: Controller, Service, DTOs (Create, Update, Query/Pagination)
4. Register in AppModule

## Frontend
1. Create shared types (same pattern as existing master data types)
2. Create API service (posService.ts? or paymentTermService.ts?)
3. Create List page with shadcn DataTable
4. Create Form dialog with shadcn Dialog + Form fields
5. Add route
6. Add sidebar menu item under Master Data > Sales (or root master data)
