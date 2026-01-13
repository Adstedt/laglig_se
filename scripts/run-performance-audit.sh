#!/bin/bash

# Laglig.se Performance Audit Runner
# This script executes the comprehensive performance audit against the live site

set -e

echo "🚀 Starting Laglig.se Performance Audit"
echo "========================================"

# Configuration
AUDIT_URL="${AUDIT_URL:-https://www.laglig.se}"
AUDIT_EMAIL="${AUDIT_EMAIL:-alexander.adstedt+10@kontorab.se}"
AUDIT_PASSWORD="${AUDIT_PASSWORD:-KBty8611!!!!}"
BROWSER="${BROWSER:-chromium}"
HEADED="${HEADED:-false}"
WORKERS="${WORKERS:-1}"

echo "Target URL: $AUDIT_URL"
echo "Browser: $BROWSER"
echo "Headed mode: $HEADED"
echo "Workers: $WORKERS"
echo ""

# Create results directory
RESULTS_DIR="test-results/performance-audit-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "📁 Results will be saved to: $RESULTS_DIR"
echo ""

# Set environment variables for the test
export BASE_URL="$AUDIT_URL"
export AUDIT_EMAIL="$AUDIT_EMAIL"
export AUDIT_PASSWORD="$AUDIT_PASSWORD"

# Construct Playwright command
PLAYWRIGHT_CMD="npx playwright test tests/e2e/laglig-performance-audit.spec.ts"
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=$BROWSER"
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --workers=$WORKERS"

if [ "$HEADED" = "true" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

# Add reporter options
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --reporter=html"

echo "🔧 Executing command:"
echo "$PLAYWRIGHT_CMD"
echo ""

# Run the audit
echo "⏱️ Starting performance audit tests..."
echo ""

if eval "$PLAYWRIGHT_CMD"; then
    echo ""
    echo "✅ Performance audit completed successfully!"
    
    # Check for HTML report
    if [ -f "playwright-report/index.html" ]; then
        echo "📊 HTML report available at: playwright-report/index.html"
        echo "🌐 Open with: npx playwright show-report"
    fi
    
    # Check for JSON results
    if [ -d "$RESULTS_DIR" ]; then
        echo "📂 Detailed results in: $RESULTS_DIR"
        
        # Count screenshots
        SCREENSHOT_COUNT=$(find "$RESULTS_DIR" -name "*.png" | wc -l)
        echo "📸 Screenshots captured: $SCREENSHOT_COUNT"
        
        # Show largest files (likely screenshots)
        echo ""
        echo "📋 Largest result files:"
        find "$RESULTS_DIR" -type f -exec ls -lh {} \; | sort -k5 -hr | head -5
    fi
    
    echo ""
    echo "🎉 Audit Summary:"
    echo "- Target: $AUDIT_URL"
    echo "- Browser: $BROWSER"
    echo "- Results: $RESULTS_DIR"
    echo ""
    echo "💡 Next steps:"
    echo "1. Review the HTML report: npx playwright show-report"
    echo "2. Check screenshots in: $RESULTS_DIR"
    echo "3. Review performance metrics and compare against targets"
    
else
    echo ""
    echo "❌ Performance audit failed!"
    echo "📋 Check the output above for error details"
    echo "📂 Partial results may be in: $RESULTS_DIR"
    exit 1
fi