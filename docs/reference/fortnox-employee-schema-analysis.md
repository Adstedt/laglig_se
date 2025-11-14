# Fortnox Employee Schema Analysis

**Source:** Fortnox OpenAPI Specification
**Schema Location:** `c:\Users\audri\Downloads\openapi.json:5688-6204`
**Purpose:** Reference for designing laglig.se user/employee schemas

---

## Overview

Fortnox's Employee schema is a comprehensive payroll and HR management system designed for Swedish labor law compliance. The schema demonstrates best practices for modeling complex employee data with temporal tracking, regulatory compliance, and nested relationships.

---

## Core Structure

### Required Fields (Minimum)

```json
{
  "Email": "string",
  "FirstName": "string",
  "LastName": "string"
}
```

### Optional but Key Identifier

- `EmployeeId`: string (1-15 characters) - unique identifier

---

## Data Categories

### 1. Personal & Contact Information

```typescript
{
  // Identity
  EmployeeId: string // 1-15 chars, unique
  FirstName: string
  LastName: string
  FullName: string // Auto-generated
  PersonalIdentityNumber: string // Swedish personnummer

  // Contact
  Email: string // Required
  Phone1: string
  Phone2: string

  // Address
  Address1: string
  Address2: string
  City: string
  PostCode: string
  Country: string

  // Role
  JobTitle: string // Max 30 chars
}
```

### 2. Employment Details

```typescript
{
  EmploymentDate: date;            // Start date
  EmployedTo: date;                // End date (optional)
  Inactive: boolean;

  // Employment Type
  EmploymentForm: enum [
    "TV",   // Tillsvidareanställning (permanent)
    "PRO",  // Provanställning (probation)
    "TID",  // Tidsbegränsad (temporary)
    "SVT",  // Säsongsvisa (seasonal)
    "VIK",  // Vikariat (substitute)
    "PRJ",  // Projektanställning (project)
    "PRA",  // Praktik (internship)
    "FER",  // Feriearbete (summer job)
    "SES",  // Sessionsanställning
    "NEJ"   // None
  ],

  PersonelType: enum [
    "TJM",  // Tjänsteman (salaried employee)
    "ARB"   // Arbetare (worker)
  ]
}
```

### 3. Compensation & Salary

```typescript
{
  // Current Salary
  MonthlySalary: string;
  HourlyPay: string;
  AverageHourlyWage: string;
  AverageWeeklyHours: string;

  SalaryForm: enum [
    "MAN",  // Månadslön (monthly)
    "TIM"   // Timlön (hourly)
  ],

  // Historical Wage Changes
  DatedWages: Array<{
    EmployeeId: string;            // Required
    FirstDay: date;                // Required - when wage takes effect
    HourlyPay?: string;
    MonthlySalary?: string;
  }>,

  // Historical Salary Records
  OpeningSalaries: Array<{
    EmployeeId: string;
    Period: string;
    Amount: float;
    Quantity: float;
    QuantityUnit: string;
    SalaryTypeName: string;
    ProductGroup: string;
    RowId: integer;
  }>
}
```

### 4. Work Schedule & Time Tracking

```typescript
{
  ScheduleId: string // Current schedule
  FullTimeEquivalent: float // % of full-time (e.g., 1.0 = 100%)
  AverageWeeklyHours: string
  WorkingTimeEnumeration: string

  // Schedule History
  DatedSchedules: Array<{
    EmployeeId: string // Required
    FirstDay: date // Required - when schedule starts
    ScheduleId?: string
  }>
}
```

### 5. Payroll & Tax Information

```typescript
{
  // Bank Details (Swedish format)
  BankAccountNo: string;
  ClearingNo: string;              // Swedish clearing number

  // Tax
  TaxTable: string;
  TaxColumn: integer;              // 1-6
  TaxAllowance: enum [
    "HUV",  // Huvudsaklig (primary)
    "EXT",  // Extra
    "TMP",  // Temporary
    "STU",  // Student
    "EJ",   // None
    "???"
  ],
  NonRecurringTax: string;
  AutoNonRecurringTax: boolean;
  PreliminaryTaxDeducted: float;

  // Pension Type (Swedish occupational pension system)
  ForaType: enum [
    "A", "A51"-"A86", "A3", "A91"-"A93",
    "A11"-"A30", "A41"-"A48", "T", "T6", "-"
  ],

  // Payslip Delivery
  PayslipType: enum [
    "pdf",
    "digital",
    "kivra"  // Swedish digital mailbox service
  ]
}
```

### 6. Vacation & Leave Management

**Swedish labor law requires extensive vacation tracking:**

```typescript
{
  // ===== PENDING VACATION =====
  // (Earned but not yet registered/taken)

  VacationDaysPendingPaid: float
  VacationDaysPendingPrepaid: float
  VacationDaysPendingSaved: float
  VacationDaysPendingUnpaid: float

  // Breakdown by year earned
  VacationDaysPendingSavedYear1: float
  VacationDaysPendingSavedYear2: float
  VacationDaysPendingSavedYear3: float
  VacationDaysPendingSavedYear4: float
  VacationDaysPendingSavedYear5: float
  VacationDaysPendingSavedYear6Plus: float

  // ===== REGISTERED VACATION =====
  // (Officially recorded/scheduled)

  VacationDaysRegisteredPaid: float
  VacationDaysRegisteredPrepaid: float
  VacationDaysRegisteredSaved: float
  VacationDaysRegisteredUnpaid: float

  // Breakdown by year
  VacationDaysRegisteredSavedYear1: float
  VacationDaysRegisteredSavedYear2: float
  VacationDaysRegisteredSavedYear3: float
  VacationDaysRegisteredSavedYear4: float
  VacationDaysRegisteredSavedYear5: float
  VacationDaysRegisteredSavedYear6Plus: float

  // ===== TOTALS =====

  VacationDaysPaid: float
  VacationDaysPrepaid: float
  VacationDaysSaved: float
  VacationDaysUnpaid: float

  // Saved days with employment rate tracking
  VacationDaysSavedYear1: float
  VacationDaysSavedYear2: float
  VacationDaysSavedYear3: float
  VacationDaysSavedYear4: float
  VacationDaysSavedYear5: float
  VacationDaysSavedYear6Plus: float

  VacationDaysSavedEmploymentRateYear1: float
  VacationDaysSavedEmploymentRateYear2: float
  VacationDaysSavedEmploymentRateYear3: float
  VacationDaysSavedEmploymentRateYear4: float
  VacationDaysSavedEmploymentRateYear5: float
  VacationDaysSavedEmploymentRateYear6Plus: float

  // ===== VACATION CALCULATIONS =====

  VacationCalculationAdvanceVacationDebt: float
  VacationCalculationIncludeInCalculation: boolean
  VacationCalculationSameWagePercent: boolean
  VacationCalculationSoleCustody: boolean
  VacationCalculationSumOnlyNoDays: boolean
  VacationCalculationTotalVacationSalarySum: float
  VacationCalculationVacationEntitlement: float
  VacationCalculationVariableAdditionSum: float

  // ===== VACATION-BASED WORK TIME =====

  VacationBasedAttendanceDays: float
  VacationBasedAttendanceHours: float
  VacationBasedCalendarDaysWhole: float
  VacationBasedSalaryTotal: float
  VacationBasedSalaryVariableAddition: float
  VacationBasedSalaryWorkedTime: float

  // ===== ABSENCE TRACKING =====

  AbsenceHoursVacationBased: float
  AbsenceHoursNonVacationBased: float
  AbsenceWorkdaysVacationBased: float
  AbsenceWorkdaysNonVacationBased: float

  NonVacationBasedCalendarDaysPartial: float
  NonVacationBasedCalendarDaysWhole: float
}
```

### 7. Flex Time & Compensation Time

```typescript
{
  // Flex Time (positive/negative hours bank)
  CurrentFlexBalance: float
  InitialFlex: float

  // Compensation Time (overtime bank)
  CurrentCompBalance: float
  InitialComp: float

  // ATF/ATK (Swedish work time reduction)
  ATFValue: float
  ATKValue: float
}
```

### 8. Project & Cost Allocation

```typescript
{
  Project: string // Default project for time tracking
  CostCenter: string // Default cost center
}
```

### 9. Nested/Related Entities

#### Employee Categories

```typescript
{
  EmployeeCategories: Array<{
    Name: string
    value: string
  }>
}
```

#### Employee Children (Child Care Tracking)

```typescript
{
  EmployeeChildren: Array<{
    EmployeeId: string // Required
    Child: string // Required
    ApprovedDays: integer // Required
    IngoingWithdrawnDays: integer // Required
    WithdrawnDays: float
    Id: string
  }>
}
```

---

## Key Design Patterns

### 1. **Temporal Data Tracking**

Fortnox uses arrays with `FirstDay` fields to track changes over time:

- `DatedWages[]` - salary changes
- `DatedSchedules[]` - schedule changes
- `OpeningSalaries[]` - historical records

**Pattern:**

```typescript
Array<{
  FirstDay: date;        // When this value takes effect
  ...data
}>
```

### 2. **State Management: Pending vs Registered**

Swedish vacation law requires tracking both:

- **Pending**: Earned but not officially recorded
- **Registered**: Officially scheduled/approved

This two-phase tracking ensures accuracy for legal/payroll purposes.

### 3. **Multi-Year Tracking**

Vacation days can be carried forward up to 6+ years, each tracked separately:

- `Year1` through `Year5` (specific years)
- `Year6Plus` (aggregated older)

### 4. **Balance Tracking Pattern**

```typescript
{
  Current[Type]Balance: float;   // Current state
  Initial[Type]: float;          // Starting point
}
```

Used for flex time, comp time, etc.

### 5. **Enums for Validation**

Extensive use of enums for:

- Employment types
- Tax forms
- Pension types
- Payslip delivery methods

Ensures data consistency and Swedish legal compliance.

### 6. **Separation of List vs Detail**

- `fortnox_Employee` - Full schema for single employee
- `fortnox_EmployeeListItem` - Lighter schema for list views

Optimizes API performance while maintaining full data access when needed.

### 7. **Nested Arrays for Relationships**

Rather than foreign keys, related data is nested:

- Categories
- Children
- Historical records

Reduces API calls, provides complete context.

---

## Lessons for laglig.se

### What to Adopt:

1. **Temporal tracking pattern** - Track role changes, salary changes over time
2. **Balance tracking** - For vacation days, billable hours, etc.
3. **Enum-based validation** - For roles, permissions, subscription tiers
4. **Nested relationships** - For user organizations, cases, documents
5. **Separation of list/detail schemas** - For performance

### What to Simplify:

1. **Vacation tracking** - Legal professionals don't need 6+ years of granular tracking
2. **Tax/payroll details** - Not core to legal practice management
3. **Swedish-specific fields** - Unless targeting Swedish law firms specifically

### Potential laglig.se User Schema Structure:

```typescript
{
  // Core Identity
  userId: string;
  email: string;              // Required
  firstName: string;          // Required
  lastName: string;           // Required

  // Professional Details
  barNumber?: string;         // Swedish advokatnummer
  lawFirm?: string;
  practiceAreas: string[];
  role: "lawyer" | "paralegal" | "admin" | "student";

  // Subscription & Billing
  subscriptionTier: "free" | "professional" | "enterprise";
  billingInfo?: {...};

  // Usage Tracking
  usageStats: {
    documentsStored: number;
    aiQueriesThisMonth: number;
    lastActive: date;
  };

  // Temporal Data
  roleHistory: Array<{
    effectiveDate: date;
    role: string;
    lawFirm: string;
  }>;

  // Preferences
  preferences: {
    notifications: {...};
    uiSettings: {...};
  };

  // Metadata
  createdAt: date;
  updatedAt: date;
  inactive: boolean;
}
```

---

## References

- **Source File**: `c:\Users\audri\Downloads\openapi.json`
- **Schema Definition**: Lines 5688-6204
- **Related Schemas**:
  - `fortnox_Employee_DatedSchedule`: Lines 6738-6758
  - `fortnox_Employee_DatedWage`: Lines 6759-6782
  - `fortnox_Employee_EmployeeCategory`: Lines 6783-6793
  - `fortnox_Employee_EmployeeChild`: Lines 6794-6827
  - `fortnox_Employee_OpeningSalary`: Lines 6828+

---

**Document Created**: 2025-10-31
**For Project**: laglig.se - Legal Information Platform
