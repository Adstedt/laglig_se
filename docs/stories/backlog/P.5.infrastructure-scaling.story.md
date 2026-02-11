# Story P.5: Sprint 5 - Infrastructure and Scaling

## Status
Draft

## Story
**As a** Laglig.se operations team member,
**I want** robust infrastructure that scales automatically and provides comprehensive monitoring,
**so that** the application remains performant under varying loads with minimal manual intervention.

## Acceptance Criteria

### From STORY PERF-017: CDN Configuration
1. Configure Cloudflare CDN for all static assets
2. Implement proper cache headers and TTLs
3. Set up edge locations in EU regions
4. Configure DDoS protection
5. Static asset load time <50ms from CDN

### From STORY PERF-018: Auto-scaling Configuration
6. Configure horizontal pod autoscaling (HPA)
7. Set scaling thresholds based on CPU/memory
8. Implement predictive scaling for known patterns
9. Scale from 2 to 20 instances automatically
10. Scale-up time <30 seconds

### From STORY PERF-019: Performance Monitoring Dashboard
11. Set up comprehensive monitoring with Grafana
12. Create alerts for performance degradation
13. Implement distributed tracing with OpenTelemetry
14. Add custom business metrics
15. Alert response time <5 minutes

### From STORY PERF-020: Load Testing and Optimization
16. Create load testing suite with k6
17. Test with 10,000 concurrent users
18. Identify and fix bottlenecks under load
19. Document capacity limits
20. System handles 10x current load

### Additional Requirements (from remaining stories)
21. Implement API rate limiting per user/workspace
22. Add request queuing for burst traffic

## Tasks / Subtasks

- [ ] **Task 1: Configure CDN and Edge Infrastructure** (AC: 1-5)
  - [ ] Set up Cloudflare account and DNS
  - [ ] Configure CDN rules for static assets
  - [ ] Set cache headers in Next.js responses
  - [ ] Configure EU edge locations
  - [ ] Enable DDoS protection and WAF
  - [ ] Set up CDN analytics dashboard
  - [ ] Test CDN cache hit rates
  - [ ] Configure image optimization at edge

- [ ] **Task 2: Implement Auto-scaling** (AC: 6-10)
  - [ ] Configure Kubernetes HPA for Next.js pods
  - [ ] Set CPU threshold at 70% for scale-up
  - [ ] Set memory threshold at 80% for scale-up
  - [ ] Implement custom metrics scaling (request rate)
  - [ ] Configure predictive scaling for business hours
  - [ ] Set up scale-down policies (5 min cooldown)
  - [ ] Test scaling behavior under load
  - [ ] Document scaling patterns

- [ ] **Task 3: Setup Monitoring and Alerting** (AC: 11-15)
  - [ ] Deploy Grafana and Prometheus stack
  - [ ] Create performance dashboards
  - [ ] Configure OpenTelemetry instrumentation
  - [ ] Set up distributed tracing
  - [ ] Create alert rules for SLA violations
  - [ ] Implement PagerDuty integration
  - [ ] Add custom metrics for business KPIs
  - [ ] Create runbooks for common issues

- [ ] **Task 4: Load Testing Infrastructure** (AC: 16-20)
  - [ ] Set up k6 load testing framework
  - [ ] Create test scenarios for common user flows
  - [ ] Implement gradual load increase tests
  - [ ] Create spike test scenarios
  - [ ] Test with 10,000 concurrent users
  - [ ] Identify performance bottlenecks
  - [ ] Document capacity planning
  - [ ] Create CI/CD performance gates

- [ ] **Task 5: Rate Limiting and Traffic Management** (AC: 21-22)
  - [ ] Implement API rate limiting middleware
  - [ ] Configure per-user and per-workspace limits
  - [ ] Add request queuing with Bull queue
  - [ ] Implement circuit breaker pattern
  - [ ] Add graceful degradation for overload
  - [ ] Test rate limiting effectiveness
  - [ ] Document rate limit policies

## Dev Notes

### Testing Standards
[Source: architecture/17-coding-standards.md]
- Load tests must simulate realistic user behavior
- Performance tests run in staging environment
- Alert testing includes response time validation
- Scaling tests must verify zero-downtime deploys
- CDN tests must validate global edge performance

### Previous Story Context
- Stories P.1-P.4 optimized application code
- This story focuses on infrastructure scaling
- Ensures optimizations work under production load
- Final sprint for comprehensive performance

### Technical Stack Context
[Source: architecture/3-tech-stack.md]
- **CDN:** Cloudflare Enterprise
- **Hosting:** Vercel + Kubernetes (GKE)
- **Monitoring:** Grafana + Prometheus
- **Tracing:** OpenTelemetry + Jaeger
- **Load Testing:** k6 + Grafana Cloud

### CDN Configuration
[Source: architecture/22-performance-architecture.md#22.7]
```typescript
// Cache Headers Configuration
export const cacheHeaders = {
  static: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'max-age=31536000'
  },
  dynamic: {
    'Cache-Control': 'private, no-cache, no-store',
    'CDN-Cache-Control': 'no-cache'
  },
  api: {
    'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    'CDN-Cache-Control': 'max-age=60'
  }
};

// Cloudflare Page Rules
const pageRules = [
  {
    url: '*.js',
    settings: {
      cache_level: 'aggressive',
      edge_cache_ttl: 2678400 // 31 days
    }
  },
  {
    url: '/api/*',
    settings: {
      cache_level: 'bypass'
    }
  }
];
```

### Auto-scaling Configuration
```yaml
# HPA Configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: laglig-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: laglig-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
    scaleDown:
      stabilizationWindowSeconds: 300
```

### Monitoring Stack
```typescript
// OpenTelemetry Configuration
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  serviceName: 'laglig-app',
  instrumentations: [
    // HTTP, Database, Redis instrumentation
  ],
  exporter: new PrometheusExporter({
    port: 9090,
  })
});

// Custom Metrics
export const metrics = {
  lawListViews: new Counter({
    name: 'law_list_views_total',
    help: 'Total law list views',
    labelNames: ['workspace_id']
  }),
  apiLatency: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request latency',
    labelNames: ['method', 'route', 'status']
  })
};
```

### Load Testing Scenarios
```javascript
// k6 Load Test Script
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 1000 },
    { duration: '20m', target: 10000 },
    { duration: '10m', target: 1000 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  const res = http.get('https://laglig.se/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Implementation Files
- `/infrastructure/cdn/` - CDN configuration files
- `/infrastructure/k8s/` - Kubernetes manifests
- `/infrastructure/monitoring/` - Monitoring stack configs
- `/tests/load/` - k6 load test scripts
- `/lib/telemetry/` - OpenTelemetry instrumentation

### Performance Targets
- CDN cache hit rate: >95%
- Auto-scaling response: <30 seconds
- Alert detection: <2 minutes
- System capacity: 10,000 concurrent users
- API rate limit: 1000 req/min per user

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-13 | 1.0 | Initial story creation | Bob (Scrum Master) |

## Dev Agent Record

### Agent Model Used
*To be filled by dev agent*

### Debug Log References
*To be filled by dev agent*

### Completion Notes List
*To be filled by dev agent*

### File List
*To be filled by dev agent*

## QA Results
*To be filled by QA agent*