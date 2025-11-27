# Database Setup Guide

## Overview

Laglig.se uses **Supabase PostgreSQL** with the **pgvector** extension for storing legal documents and semantic search capabilities. This guide documents the database environment strategy and setup procedures.

## Database Environment Strategy

### Environments

| Environment     | Purpose                                       | Service  | Region         | Tier |
| --------------- | --------------------------------------------- | -------- | -------------- | ---- |
| **Development** | Local development, schema testing, migrations | Supabase | EU (Frankfurt) | Free |
| **Production**  | Live customer data, production workloads      | Supabase | EU (Frankfurt) | Pro  |

### Why Separate Databases?

1. **Risk Mitigation**: Never test schema changes on production data
2. **Data Isolation**: Dev data samples vs. 170K+ production documents
3. **Migration Safety**: Test migrations in dev before deploying to prod
4. **Performance**: Dev uses smaller datasets for faster iteration
5. **Cost Control**: Free tier sufficient for development work

## Current Database Configuration

### Development Database

- **Project ID**: `lezdkonjjjbvaghdwpog`
- **Region**: EU North 1 (aws-1-eu-north-1)
- **Hostname**: `aws-1-eu-north-1.pooler.supabase.com`
- **Extensions**: `vector` (pgvector 0.7.0+)
- **Storage**: 500MB (Free tier)
- **Configuration**: Stored in `.env.local` (gitignored)

### Production Database

- **Status**: To be configured
- **Region**: EU (Frankfurt recommended for GDPR compliance)
- **Tier**: Supabase Pro
- **Storage**: 8GB+
- **Configuration**: Stored in Vercel environment variables (NOT in git)

## Connection Strings

### Supabase Pooler Configuration (November 2025+)

Supabase now requires using **pooler hostnames** instead of direct database connections:

#### Transaction Mode (Port 6543)

- **Use for**: Application queries (SELECT, INSERT, UPDATE, DELETE)
- **URL Format**: `postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
- **Environment Variable**: `DATABASE_URL`

#### Session Mode (Port 5432)

- **Use for**: Prisma migrations (`prisma migrate`, `db push`)
- **URL Format**: `postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`
- **Environment Variable**: `DIRECT_URL`

**IMPORTANT**: The old direct hostname format (`db.xxx.supabase.co`) no longer works. Always use the pooler hostname.

## Setup Instructions

### Prerequisites

- Node.js 20.x LTS
- pnpm 9.0+
- Supabase account

### Development Database Setup

1. **Create Supabase Project** (if not exists):
   - Log into [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Name: "laglig-dev"
   - Region: EU North (Stockholm) or EU West (Frankfurt)
   - Generate strong database password
   - Wait for project provisioning (~2 minutes)

2. **Enable pgvector Extension**:

   ```sql
   -- Run in Supabase SQL Editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Configure Environment Variables**:

   Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your connection strings:

   ```bash
   # Transaction mode (Port 6543)
   DATABASE_URL="postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

   # Session mode (Port 5432)
   DIRECT_URL="postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
   ```

4. **Verify Connection**:
   ```bash
   pnpm prisma db execute --schema prisma/schema.prisma --stdin <<'EOF'
   SELECT version();
   EOF
   ```

### Production Database Setup

1. **Create Production Supabase Project**:
   - Name: "laglig-prod"
   - Region: EU (Frankfurt) for GDPR compliance
   - Tier: Upgrade to Pro for production features:
     - 8GB storage
     - Dedicated CPU
     - Daily automatic backups
     - Point-in-time recovery
     - 7-day log retention

2. **Enable pgvector Extension**:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Configure Vercel Environment Variables**:
   - Go to Vercel Project → Settings → Environment Variables
   - Add for **Production** environment:
     - `DATABASE_URL` (Transaction mode, Port 6543)
     - `DIRECT_URL` (Session mode, Port 5432)
   - **DO NOT** commit production credentials to git

4. **Verify Production Connection**:
   ```bash
   # From Vercel CLI or GitHub Actions
   vercel env pull .env.production.local
   pnpm prisma db execute --schema prisma/schema.prisma --stdin <<'EOF'
   SELECT version();
   EOF
   ```

## Migration Workflow

### Development Cycle

1. **Develop Schema Changes**:

   ```bash
   # Edit prisma/schema.prisma
   # Add/modify models, enums, fields
   ```

2. **Create Migration**:

   ```bash
   pnpm prisma migrate dev --name descriptive-migration-name
   # This creates migration file and applies it to dev database
   ```

3. **Test Migration**:

   ```bash
   # Verify tables created
   pnpm prisma studio

   # Run seed script
   pnpm prisma db seed

   # Run tests
   pnpm test tests/integration/database/
   ```

4. **Commit Migration**:
   ```bash
   git add prisma/migrations/
   git commit -m "feat(db): add multi-content-type schema"
   ```

### Production Deployment

1. **Deploy to Production** (via CI/CD):

   ```bash
   # GitHub Actions or Vercel deployment runs:
   pnpm prisma migrate deploy
   ```

2. **Verify Deployment**:
   - Check Supabase Studio for new tables
   - Monitor Sentry for migration errors
   - Check Vercel logs for successful deployment

3. **Rollback if Needed**:
   ```bash
   # Prisma doesn't support automatic rollback
   # Manual rollback requires writing down migration
   pnpm prisma migrate resolve --rolled-back MIGRATION_NAME
   ```

## Security Best Practices

### Environment Variables

- ✅ **Development**: Store in `.env.local` (gitignored)
- ✅ **Production**: Store in Vercel environment variables
- ❌ **NEVER**: Commit database credentials to git
- ❌ **NEVER**: Use production database for development

### Database Access

- Development: Access via Supabase Studio or Prisma Studio
- Production: Read-only access via Supabase Studio, write access via API only
- Use Supabase Row Level Security (RLS) for multi-tenant isolation (future)

### Backup Strategy

- **Development**: No backups required (can rebuild from migrations)
- **Production**:
  - Daily automatic backups (Supabase Pro)
  - Point-in-time recovery (7 days retention)
  - Manual backups before major migrations

## Troubleshooting

### Connection Issues

**Error**: `connect ECONNREFUSED`

- Verify pooler hostname (not old `db.xxx.supabase.co` format)
- Check firewall allows connections to ports 5432/6543
- Verify project ID and password are correct

**Error**: `pgbouncer cannot parse statement`

- Use `DIRECT_URL` (port 5432) for migrations
- Use `DATABASE_URL` (port 6543) for queries

### Migration Issues

**Error**: `Migration failed: relation already exists`

- Database already has tables from previous migration
- Option 1: Drop database and reapply migrations
- Option 2: Use `prisma db push` for prototyping (skips migrations)

**Error**: `Direct connection required for migrations`

- Ensure `DIRECT_URL` is set in environment
- Use session mode (port 5432) not transaction mode (port 6543)

## References

- [Prisma Schema Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Supabase Database Connection](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- Architecture: `docs/architecture/3-tech-stack.md` (Row 23-25)
- Architecture: `docs/architecture/9-database-schema.md`

## Change Log

| Date       | Version | Description                          | Author      |
| ---------- | ------- | ------------------------------------ | ----------- |
| 2025-11-27 | 1.0     | Initial database setup documentation | James (Dev) |
