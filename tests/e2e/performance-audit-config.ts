/**
 * Performance Audit Configuration
 * 
 * Centralized configuration for the Laglig.se performance audit tests.
 * This file contains test credentials, performance targets, and test settings.
 */

export const PERFORMANCE_AUDIT_CONFIG = {
  // Test target
  url: process.env.AUDIT_URL || 'https://www.laglig.se',
  
  // Authentication
  credentials: {
    email: process.env.AUDIT_EMAIL || 'alexander.adstedt+10@kontorab.se',
    password: process.env.AUDIT_PASSWORD || 'KBty8611!!!!'
  },
  
  // Workspace settings
  primaryWorkspace: 'Grro Technologies',
  
  // Performance targets (in milliseconds)
  performanceTargets: {
    workspaceSwitch: 200,       // Workspace dropdown and switching
    listLoads: 500,             // List and table loading
    modalFirstOpen: 1000,       // First-time modal opening
    modalCached: 100,           // Cached modal reopening
    pageNavigations: 1000,      // Full page navigation
    maxFreezeTime: 50,          // Maximum acceptable UI freeze
    searchQuery: 2000,          // Search query execution
    formInteraction: 100        // Form input responsiveness
  },
  
  // Test execution settings
  execution: {
    defaultTimeout: 30000,      // Default timeout for operations
    navigationTimeout: 10000,   // Page navigation timeout
    modalTimeout: 5000,         // Modal appearance timeout
    stabilityTimeout: 3000,     // UI stability wait time
    retryCount: 2               // Number of retries for failed operations
  },
  
  // Screenshot settings
  screenshots: {
    enabled: true,
    fullPage: true,
    quality: 90,
    path: 'test-results/performance-audit/screenshots'
  },
  
  // Selectors for common elements
  selectors: {
    // Authentication
    loginButton: 'a[href*="login"], button:has-text("Logga in"), button:has-text("Sign in")',
    emailInput: 'input[type="email"], input[name="email"], input[placeholder*="mail"]',
    passwordInput: 'input[type="password"], input[name="password"]',
    submitButton: 'button[type="submit"], button:has-text("Logga in"), button:has-text("Sign in")',
    
    // Workspace
    workspaceSwitcher: '[data-testid="workspace-switcher"], button:has-text("workspace"), .workspace-selector',
    workspaceDropdown: '[role="menu"], .dropdown-menu, .workspace-dropdown',
    workspaceItem: '[role="menuitem"], .workspace-item',
    
    // Navigation
    sidebar: '.sidebar, [data-testid="sidebar"], nav',
    sidebarToggle: 'button:has([data-lucide="menu"]), .sidebar-toggle, [aria-label*="menu"]',
    myListsLink: 'a:has-text("Mina laglistor"), a:has-text("My Lists"), a[href*="laglistor"]',
    
    // Law Lists
    lawListItems: '.law-list-item, .list-item, tr, .card',
    lawItems: '.law-item, .document-item, tr td:first-child, .card-title',
    
    // Tables
    table: 'table, .table, .data-table',
    sortButton: 'th button, .sort-header, [aria-sort]',
    paginationButton: 'button:has-text("Next"), button:has-text("Nästa"), .pagination button',
    
    // Modals
    modal: '[role="dialog"], .modal, .dialog',
    modalClose: 'button[aria-label="Close"], button:has-text("×"), .modal-close',
    
    // Settings
    settingsTabs: '[role="tab"], .tab, .settings-tab',
    formInputs: 'input, select, textarea',
    
    // Legal Sources
    searchResults: '.result-item, .search-result, .card, article',
    searchInput: 'input[type="search"], input[placeholder*="search"], input[placeholder*="sök"]',
    
    // Tasks
    taskItems: '.task-item, .card, tr',
    createTaskButton: 'button:has-text("Create"), button:has-text("Skapa"), .create-task, [aria-label*="create"]',
    
    // Loading indicators
    loadingIndicators: '.loading, .spinner, [data-loading="true"], .skeleton, .animate-pulse'
  },
  
  // Test data for interactions
  testData: {
    searchQuery: 'arbetsmiljö',
    testInputValue: 'test',
    maxItemsToTest: 3,
    maxWorkspacesToTest: 3
  }
}

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  PERFORMANCE_AUDIT_CONFIG.url = 'http://localhost:3000'
  PERFORMANCE_AUDIT_CONFIG.execution.defaultTimeout = 60000
}

if (process.env.NODE_ENV === 'staging') {
  PERFORMANCE_AUDIT_CONFIG.url = 'https://staging.laglig.se'
  PERFORMANCE_AUDIT_CONFIG.performanceTargets.pageNavigations = 1500 // Allow slower staging
}

// Performance target presets
export const PERFORMANCE_PRESETS = {
  strict: {
    workspaceSwitch: 150,
    listLoads: 300,
    modalFirstOpen: 800,
    modalCached: 80,
    pageNavigations: 800,
    maxFreezeTime: 30
  },
  
  relaxed: {
    workspaceSwitch: 300,
    listLoads: 1000,
    modalFirstOpen: 1500,
    modalCached: 200,
    pageNavigations: 1500,
    maxFreezeTime: 100
  },
  
  production: {
    workspaceSwitch: 200,
    listLoads: 500,
    modalFirstOpen: 1000,
    modalCached: 100,
    pageNavigations: 1000,
    maxFreezeTime: 50
  }
}

// Apply preset if specified
const preset = process.env.PERFORMANCE_PRESET as keyof typeof PERFORMANCE_PRESETS
if (preset && PERFORMANCE_PRESETS[preset]) {
  Object.assign(PERFORMANCE_AUDIT_CONFIG.performanceTargets, PERFORMANCE_PRESETS[preset])
}

export default PERFORMANCE_AUDIT_CONFIG