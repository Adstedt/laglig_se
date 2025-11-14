# P0 WORKFLOWS (Blocking - Required for Basic Functionality)

## 8.2 Authentication & Account Creation (Epic 1, Story 1.3)

**User Story:** User signs up with email/password or OAuth, verifies email, and accesses workspace

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextAuth
    participant Supabase Auth
    participant DB as Database
    participant Email

    alt Email/Password Signup
        User->>Browser: Enter email + password
        Browser->>NextAuth: Create account
        NextAuth->>Supabase Auth: Register user
        Supabase Auth->>DB: Store user record
        Supabase Auth->>Email: Send verification code
        Email-->>User: 6-digit code

        User->>Browser: Enter verification code
        Browser->>Supabase Auth: Verify code
        Supabase Auth->>DB: Mark email verified
        Supabase Auth-->>Browser: Auth success
    else OAuth (Google/Microsoft)
        User->>Browser: Click "Sign in with Google"
        Browser->>NextAuth: Initiate OAuth
        NextAuth->>Google: OAuth flow
        Google-->>User: Consent screen
        User->>Google: Approve
        Google->>NextAuth: Auth token
        NextAuth->>DB: Create/update user
        NextAuth-->>Browser: Auth success
    end

    Browser->>Browser: Store session (JWT)
    Browser-->>User: Redirect to onboarding/dashboard
```

**Password Reset Flow:**

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Supabase Auth
    participant Email
    participant DB

    User->>Browser: Click "Forgot password"
    Browser->>Supabase Auth: Request reset
    Supabase Auth->>Email: Send reset link
    Email-->>User: Reset email

    User->>Browser: Click reset link
    Browser->>Supabase Auth: Validate token
    Supabase Auth-->>Browser: Show new password form

    User->>Browser: Enter new password
    Browser->>Supabase Auth: Update password
    Supabase Auth->>DB: Update password hash
    Supabase Auth-->>Browser: Success
    Browser-->>User: Auto-login
```

---

## 8.3 Workspace Creation Post-Signup (Epic 5, Story 5.1)

**User Story:** After signup, system creates workspace from session data

```mermaid
sequenceDiagram
    participant Auth as Auth Service
    participant Session as Redis Session
    participant Worker as Background Worker
    participant DB as Database
    participant OpenAI

    Note over Auth: User just verified email

    Auth->>Session: Get onboarding session
    Session-->>Auth: Session data (org, answers, laws)

    Auth->>DB: Begin transaction
    activate DB

    DB->>DB: Create workspace
    Note over DB: workspace.onboarding_context = session data
    DB->>DB: Create law_list "Mina Lagar"
    DB->>DB: Add Phase 1 laws (15-30)
    DB->>DB: Add user as OWNER

    deactivate DB

    Auth->>Worker: Queue Phase 2 generation
    Auth->>Session: Delete session

    Worker->>OpenAI: Generate Phase 2 laws
    Note over OpenAI: Uses website analysis +<br/>context answers +<br/>industry data

    OpenAI-->>Worker: 45-65 additional laws

    Worker->>DB: Add Phase 2 laws
    Worker->>DB: Mark onboarding complete
```

---

## 8.4 Role-Based Access Control (Epic 5, Story 5.2)

**User Story:** System enforces permissions based on user role

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant DB
    participant API

    Client->>Middleware: Request /api/employees
    Middleware->>Middleware: Extract JWT
    Middleware->>DB: Get user role in workspace

    alt Owner/Admin/HR Manager
        DB-->>Middleware: Role = HR_MANAGER
        Middleware->>API: Allow request
        API->>DB: Fetch employees
        DB-->>API: Employee data
        API-->>Client: 200 OK + data
    else Member/Auditor
        DB-->>Middleware: Role = MEMBER
        Middleware-->>Client: 403 Forbidden
    else No Role
        DB-->>Middleware: Not in workspace
        Middleware-->>Client: 404 Not Found
    end
```

**Permission Matrix:**

```
| Feature           | Owner | Admin | HR Manager | Member | Auditor |
|-------------------|-------|-------|------------|--------|---------|
| View Laws         | ✅    | ✅    | ✅         | ✅     | ✅      |
| Edit Laws         | ✅    | ✅    | ❌         | ❌     | ❌      |
| Manage Employees  | ✅    | ✅    | ✅         | ❌     | ❌      |
| Billing           | ✅    | ❌    | ❌         | ❌     | ❌      |
| Delete Workspace  | ✅    | ❌    | ❌         | ❌     | ❌      |
```

---
