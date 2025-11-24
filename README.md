# Laglig.se

A modern Swedish legal research platform built with Next.js 16, providing access to Swedish laws, regulations, and legal information.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript 5.5+
- **Styling:** Tailwind CSS 3.4+
- **Database:** Supabase PostgreSQL with Prisma ORM
- **Authentication:** Supabase Auth + NextAuth.js
- **Package Manager:** pnpm 9.0+
- **Deployment:** Vercel
- **CI/CD:** GitHub Actions

## Prerequisites

- Node.js 20.x
- pnpm 9.0+
- Supabase account
- Vercel account (for deployment)

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# NextAuth
NEXTAUTH_SECRET="[generate with: openssl rand -base64 32]"
NEXTAUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

### 3. Run Database Migrations

```bash
pnpm prisma migrate dev
```

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Create production build
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run unit tests with Vitest
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with UI
- `pnpm test:e2e` - Run E2E tests with Playwright

## Deployment

### Production Deployment (Vercel)

The application automatically deploys to production when changes are pushed to the `main` branch.

**Production URL:** [To be configured after Vercel setup]

### Preview Deployments

Preview deployments are automatically created for all pull requests, allowing you to test changes before merging.

### Environment Variables (Vercel)

Configure the following environment variables in the Vercel dashboard (Project Settings → Environment Variables):

**Production Environment:**

- `DATABASE_URL` - PostgreSQL connection string (production database)
- `DIRECT_URL` - Direct PostgreSQL URL (production database)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (production)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (production)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (production)
- `NEXTAUTH_SECRET` - Generate new secret for production
- `NEXTAUTH_URL` - Production URL (e.g., `https://laglig-se.vercel.app`)
- `NODE_ENV` - Set to `production`

**Preview Environment:**
Use the same variables but with development database credentials to avoid polluting production data.

### Deployment Configuration

The project uses `vercel.json` for deployment configuration:

- Build Command: `pnpm build`
- Install Command: `pnpm install`
- Framework: Next.js
- Node.js Version: 20.x

### Viewing Deployment Logs

1. Navigate to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `laglig_se` project
3. Click on "Deployments"
4. Click on a deployment to view detailed logs

## CI/CD Pipeline

### GitHub Actions

The project uses GitHub Actions for continuous integration. The CI workflow runs on every pull request and push to `main`:

**Checks:**

- ESLint (code quality)
- TypeScript compilation (type checking)
- Prettier (code formatting)
- Vitest (unit tests)

**Workflow File:** `.github/workflows/ci.yml`

### Branch Protection

The `main` branch is protected with the following rules:

- ✅ Require status checks to pass before merging (`lint-and-typecheck`, `test`)
- ✅ Require branches to be up to date before merging
- ✅ Require linear history (optional)

Failed CI checks will block pull request merges, ensuring code quality and preventing broken deployments.

## Troubleshooting

### Common Deployment Issues

#### 1. Build fails with "Module not found" errors

**Cause:** Missing dependency in `package.json`
**Solution:** Run `pnpm install` locally and ensure `pnpm-lock.yaml` is committed

#### 2. Environment variables not available at build time

**Cause:** Environment variables not configured in Vercel dashboard
**Solution:** Add all required variables to Vercel → Settings → Environment Variables

#### 3. "pnpm: command not found" in Vercel build logs

**Cause:** Vercel not detecting `pnpm-lock.yaml`
**Solution:** Ensure `pnpm-lock.yaml` exists in repository root (NOT `package-lock.json`)

#### 4. TypeScript errors in Vercel build but not locally

**Cause:** Different TypeScript version or `tsconfig.json` not committed
**Solution:** Commit `tsconfig.json` and ensure `typescript` is in `devDependencies`

#### 5. NextAuth session cookies not working in production

**Cause:** `NEXTAUTH_URL` not set or incorrect
**Solution:** Set `NEXTAUTH_URL` to exact production URL (e.g., `https://laglig-se.vercel.app`)

#### 6. Database connection fails in production

**Cause:** Wrong `DATABASE_URL` or Supabase IP allowlist restrictions
**Solution:** Verify production connection string and ensure Supabase allows Vercel IPs

### Local Development Issues

If you encounter issues with the development server:

1. **Clear cache and reinstall:**

   ```bash
   rm -rf node_modules .next pnpm-lock.yaml
   pnpm install
   ```

2. **Check environment variables:**
   Ensure all required variables are set in `.env.local`

3. **Database connection issues:**
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev
   ```

## Project Structure

```
laglig_se/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI workflow
├── app/                           # Next.js 16 App Router
│   ├── (auth)/                    # Authentication routes
│   ├── (public)/                  # Public routes
│   ├── api/                       # API routes
│   └── dashboard/                 # Protected dashboard
├── lib/                           # Shared utilities
│   ├── auth/                      # Authentication utilities
│   ├── supabase/                  # Supabase clients
│   └── validation/                # Zod schemas
├── types/                         # TypeScript type definitions
├── tests/                         # Test files
├── prisma/                        # Database schema and migrations
├── vercel.json                    # Vercel configuration
└── README.md                      # This file
```

## Contributing

This is currently a solo development project. CI checks must pass before merging any pull requests.

## License

[To be determined]
