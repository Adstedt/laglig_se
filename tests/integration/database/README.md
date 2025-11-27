# Database Integration Tests

## Overview

This directory contains integration tests for the database schema (Story 2.1: Multi-Content-Type Data Model).

## Test File

- **multi-content-schema.test.ts**: Comprehensive integration tests covering all 10 acceptance criteria from Story 2.1

## Test Coverage

The test suite includes 18 test cases covering:

1. **AC1**: ContentType enum with 9 values
2. **AC2**: LegalDocument polymorphic table with all core fields
3. **AC3**: Type-specific tables (CourtCase, EuDocument) with relations
4. **AC4**: CrossReference table with bidirectional relations
5. **AC5**: Amendment table with 7 competitive fields
6. **AC6**: DocumentSubject table with unique constraints
7. **AC7**: Complete Prisma schema validation
8. **AC9**: TypeScript type safety
9. **AC10**: Test data insertion (verified via seed script)
10. **Performance**: Index validation and query efficiency

## Running Tests

### Prerequisites

Tests require a real database connection configured in `.env.local`:

```bash
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
```

### Execute Tests

```bash
# Run all database tests
pnpm test tests/integration/database/

# Run specific test file
pnpm test tests/integration/database/multi-content-schema.test.ts

# Run with watch mode
pnpm test:watch tests/integration/database/
```

## Test Data Management

- Tests create their own test data with unique identifiers
- `afterAll` hook cleans up all test data automatically
- Safe to run multiple times without conflicts

## Notes

- **Environment**: Tests use real Supabase database (not mocked)
- **Isolation**: Each test uses unique document numbers to avoid conflicts
- **Cleanup**: Automatic cleanup respects foreign key constraints
- **Performance**: Tests include performance assertions (<1s per query)

## Troubleshooting

### "Can't reach database server"

- Verify `.env.local` contains correct Supabase credentials
- Check Supabase project is running
- Verify network connection

### "Unique constraint failed"

- Test data with same document_number already exists
- Run cleanup or use different test data

### Slow Tests

- Check database connection latency
- Verify indexes are present
- Consider using local Supabase instance for faster tests
