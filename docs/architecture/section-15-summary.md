# Section 15 Summary

Security and Performance measures ensure Laglig.se meets enterprise requirements:

✅ **Defense in Depth:** Multiple security layers
✅ **Data Protection:** AES-256 encryption for personnummer
✅ **Performance:** <2s page loads, 75%+ cache hits
✅ **GDPR Compliant:** Data export, deletion, consent
✅ **Security Headers:** CSP, HSTS, X-Frame-Options
✅ **Rate Limiting:** Tier-based API limits

**Next:** Section 16 - Testing Strategy

## 16.1 Overview

The testing strategy ensures **high quality and reliability** through comprehensive automated testing at multiple levels. The goal is to achieve **60-70% code coverage** while focusing on critical business paths.

**Testing Pyramid:**

```
         E2E Tests (10%)
        /               \
    Integration Tests (30%)
   /                      \
  Unit Tests (60%)
```

**Testing Principles:**

- **Fast feedback:** Unit tests run in milliseconds
- **User-focused:** Test behavior, not implementation
- **Isolated:** Mock external dependencies
- **Deterministic:** No flaky tests
- **Comprehensive:** Cover happy paths and edge cases

---

## 16.2 Unit Testing

**Framework:** Vitest with React Testing Library

**What to Test:**

- Utility functions and helpers
- Custom hooks
- Zod schemas and validation
- Server Action business logic
- Component rendering and state

**Unit Test Example:**

```typescript
// tests/unit/lib/validation.test.ts
import { describe, it, expect } from 'vitest'
import { EmployeeSchema } from '@/lib/validation/employee'

describe('EmployeeSchema', () => {
  it('validates valid Swedish personnummer', () => {
    const valid = {
      name: 'Anna Andersson',
      personnummer: '900101-1234',
      email: 'anna@example.com',
    }

    expect(() => EmployeeSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid personnummer format', () => {
    const invalid = {
      name: 'Test User',
      personnummer: '123456789',
      email: 'test@example.com',
    }

    expect(() => EmployeeSchema.parse(invalid)).toThrow()
  })
})
```

**Component Test Example:**

```typescript
// tests/unit/components/law-card.test.tsx
import { render, screen } from '@testing-library/react'
import { LawCard } from '@/components/features/law-list/law-card'

describe('LawCard', () => {
  const mockLaw = {
    id: '1',
    title: 'Arbetsmiljölagen',
    documentNumber: 'SFS 1977:1160',
    summary: 'Lag om arbetsmiljö'
  }

  it('renders law title and number', () => {
    render(<LawCard law={mockLaw} />)

    expect(screen.getByText('Arbetsmiljölagen')).toBeInTheDocument()
    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
  })

  it('handles click interaction', async () => {
    const onClick = vi.fn()
    render(<LawCard law={mockLaw} onClick={onClick} />)

    await userEvent.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledWith(mockLaw)
  })
})
```

---

## 16.3 Integration Testing

**Focus Areas:**

- Database queries with Prisma
- Server Actions with auth
- API route handlers
- External service mocking

**Database Integration Test:**

```typescript
// tests/integration/db/employee.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createEmployee,
  getEmployeesByWorkspace,
} from '@/lib/db/queries/employee'

describe('Employee Database Operations', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.employee.deleteMany()
  })

  it('creates and retrieves employees', async () => {
    const workspaceId = 'test-workspace-id'

    await createEmployee({
      name: 'Test Employee',
      email: 'test@example.com',
      personnummer: '900101-1234',
      workspaceId,
    })

    const employees = await getEmployeesByWorkspace(workspaceId)

    expect(employees).toHaveLength(1)
    expect(employees[0].name).toBe('Test Employee')
  })

  it('enforces workspace isolation', async () => {
    await createEmployee({
      name: 'Employee A',
      workspaceId: 'workspace-a',
    })

    await createEmployee({
      name: 'Employee B',
      workspaceId: 'workspace-b',
    })

    const workspaceAEmployees = await getEmployeesByWorkspace('workspace-a')

    expect(workspaceAEmployees).toHaveLength(1)
    expect(workspaceAEmployees[0].name).toBe('Employee A')
  })
})
```

**Server Action Test with Auth:**

```typescript
// tests/integration/actions/law.test.ts
import { describe, it, expect, vi } from 'vitest'
import { updateLawStatus } from '@/app/actions/law'
import { getServerSession } from '@/lib/auth'

vi.mock('@/lib/auth')

describe('Law Server Actions', () => {
  it('requires authentication', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(
      updateLawStatus({ lawId: '123', status: 'COMPLIANT' })
    ).rejects.toThrow('Unauthorized')
  })

  it('updates law status with valid session', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', workspaceId: 'ws-1', role: 'ADMIN' },
    })

    const result = await updateLawStatus({
      lawId: '123',
      status: 'COMPLIANT',
    })

    expect(result.success).toBe(true)
    expect(result.law.status).toBe('COMPLIANT')
  })
})
```

---

## 16.4 E2E Testing

**Framework:** Playwright

**Critical User Journeys:**

1. Onboarding flow (company lookup → questions → signup)
2. Law list navigation and filtering
3. AI chat interaction
4. Employee management CRUD
5. Kanban board drag-and-drop

**E2E Test Example:**

```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('completes full onboarding journey', async ({ page }) => {
    await page.goto('/')

    // Step 1: Company lookup
    await page.fill('[name="orgNumber"]', '556677-8899')
    await page.click('button:has-text("Sök företag")')

    // Wait for Bolagsverket data
    await expect(page.locator('text=Exempel AB')).toBeVisible()

    // Step 2: Dynamic questions
    await page.click('button:has-text("Fortsätt")')

    // Answer industry question
    await page.click('label:has-text("Ja, vi har kollektivavtal")')
    await page.click('button:has-text("Nästa")')

    // Step 3: View generated laws
    await expect(page.locator('text=15-30 lagar identifierade')).toBeVisible()

    // Step 4: Sign up
    await page.click('button:has-text("Skapa konto")')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'SecurePassword123!')
    await page.click('button[type="submit"]')

    // Verify dashboard access
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Välkommen till Laglig.se')).toBeVisible()
  })
})
```

**Accessibility Test:**

```typescript
test('meets WCAG 2.1 AA standards', async ({ page }) => {
  await page.goto('/lagar')

  // Run axe accessibility scan
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

  expect(accessibilityScanResults.violations).toEqual([])
})
```

---

## 16.5 Test Data Management

**Seed Data Strategy:**

```typescript
// prisma/seed.ts
import { prisma } from '../lib/prisma'

async function seed() {
  // Create test workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Test Company AB',
      orgNumber: '556677-8899',
      tier: 'TEAM',
    },
  })

  // Create test users
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      workspaceMemberships: {
        create: {
          workspaceId: workspace.id,
          role: 'ADMIN',
        },
      },
    },
  })

  // Create test laws
  const laws = await Promise.all([
    prisma.law.create({
      data: {
        title: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
        content: 'Full law content...',
      },
    }),
  ])

  console.log('✅ Database seeded')
}
```

**Test Database Configuration:**

```bash
# .env.test
DATABASE_URL="postgresql://postgres:password@localhost:5432/laglig_test"
```

---

## 16.6 Mocking Strategy

**External Service Mocks:**

```typescript
// tests/mocks/openai.ts
import { vi } from 'vitest'

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Mocked AI response',
            },
          },
        ],
      }),
    },
  },
}

// Usage in tests
vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}))
```

**MSW for HTTP Mocking:**

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw'

export const handlers = [
  rest.get(
    'https://api.bolagsverket.se/company/:orgNumber',
    (req, res, ctx) => {
      return res(
        ctx.json({
          name: 'Test Company AB',
          orgNumber: req.params.orgNumber,
          sniCode: '62010',
        })
      )
    }
  ),

  rest.post('https://api.openai.com/v1/embeddings', (req, res, ctx) => {
    return res(
      ctx.json({
        data: [
          {
            embedding: new Array(1536).fill(0.1),
          },
        ],
      })
    )
  }),
]
```

---

## 16.7 Test Configuration

**Vitest Configuration:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '.next/', 'tests/', '*.config.*'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

**Playwright Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

---
