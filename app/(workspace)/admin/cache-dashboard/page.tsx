/**
 * Cache Monitoring Dashboard (Story P.2)
 * 
 * Real-time monitoring of cache performance metrics.
 * Implements AC: 12 - Create monitoring dashboard component for cache metrics
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCacheMetrics as getServerCacheMetrics, monitorCacheHealth } from '@/lib/cache/server-cache'
import { getCacheMetrics as getRedisCacheMetrics } from '@/lib/cache/redis'
import { getWorkspaceCacheStats } from '@/lib/cache/workspace-cache'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { redirect } from 'next/navigation'

async function getCacheStats() {
  // Get metrics from different cache layers
  const serverMetrics = getServerCacheMetrics()
  const redisMetrics = getRedisCacheMetrics()
  const health = await monitorCacheHealth()
  
  // Get workspace-specific stats (for current workspace)
  const workspaceStats = await withWorkspace(
    async (ctx) => getWorkspaceCacheStats(ctx.workspaceId)
  ).catch(() => ({ totalKeys: 0, memoryUsage: 0, keysByType: {} }))
  
  return {
    serverMetrics,
    redisMetrics,
    workspaceStats,
    health,
  }
}

export default async function CacheDashboardPage() {
  // Check admin permissions
  const hasAccess = await withWorkspace(
    async (ctx) => ctx.hasPermission('workspace:settings')
  ).catch(() => false)
  
  if (!hasAccess) {
    redirect('/dashboard')
  }
  
  const { serverMetrics, redisMetrics, workspaceStats, health } = await getCacheStats()
  
  // Calculate overall metrics
  const overallHitRate = ((redisMetrics.hits + serverMetrics.hits) / 
    (redisMetrics.total + serverMetrics.totalQueries)) * 100 || 0
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cache Performance Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor cache hit rates, memory usage, and performance metrics
        </p>
      </div>
      
      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <StatusIndicator status={health.status} />
            <div>
              <p className="font-semibold capitalize">{health.status}</p>
              <p className="text-sm text-muted-foreground">
                Redis: {health.redisStatus}
              </p>
            </div>
          </div>
          
          {health.recommendations.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Recommendations
              </p>
              <ul className="text-sm space-y-1">
                {health.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-yellow-700 dark:text-yellow-300">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Hit Rate Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Overall Hit Rate"
          value={`${overallHitRate.toFixed(1)}%`}
          target=">90%"
          status={overallHitRate >= 90 ? 'good' : overallHitRate >= 70 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          title="Redis Hit Rate"
          value={redisMetrics.hitRate}
          target=">85%"
          status={parseFloat(redisMetrics.hitRate) >= 85 ? 'good' : 
                  parseFloat(redisMetrics.hitRate) >= 70 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          title="Server Cache Hit Rate"
          value={`${serverMetrics.hitRate.toFixed(1)}%`}
          target=">90%"
          status={serverMetrics.hitRate >= 90 ? 'good' : 
                  serverMetrics.hitRate >= 70 ? 'warning' : 'bad'}
        />
      </div>
      
      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Average Latency"
          value={`${serverMetrics.averageLatency.toFixed(2)}ms`}
          target="<100ms"
          status={serverMetrics.averageLatency < 100 ? 'good' : 
                  serverMetrics.averageLatency < 200 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          title="Slow Queries"
          value={serverMetrics.slowQueries.toString()}
          description="Queries >100ms"
          status={serverMetrics.slowQueries === 0 ? 'good' : 
                  serverMetrics.slowQueries < 10 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          title="Error Rate"
          value={`${((serverMetrics.errors / serverMetrics.totalQueries) * 100 || 0).toFixed(2)}%`}
          target="<5%"
          status={serverMetrics.errors === 0 ? 'good' : 
                  (serverMetrics.errors / serverMetrics.totalQueries) < 0.05 ? 'warning' : 'bad'}
        />
      </div>
      
      {/* Memory Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Usage</CardTitle>
          <CardDescription>Redis memory consumption by cache type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Total Memory</span>
                <span className="font-semibold">
                  {(workspaceStats.memoryUsage / 1024 / 1024).toFixed(2)} MB / 150 MB
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    workspaceStats.memoryUsage / 1024 / 1024 < 100 
                      ? 'bg-green-500' 
                      : workspaceStats.memoryUsage / 1024 / 1024 < 130 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                  }`}
                  style={{ 
                    width: `${Math.min((workspaceStats.memoryUsage / (150 * 1024 * 1024)) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {Object.entries(workspaceStats.keysByType).map(([type, count]) => (
                <div key={type}>
                  <p className="text-muted-foreground capitalize">{type}</p>
                  <p className="font-semibold">{count} keys</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Cache Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Redis Operations</CardTitle>
            <CardDescription>Document and workspace cache statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow label="Cache Hits" value={redisMetrics.hits} />
              <StatRow label="Cache Misses" value={redisMetrics.misses} />
              <StatRow label="Total Operations" value={redisMetrics.total} />
              <StatRow label="Workspace Keys" value={workspaceStats.totalKeys} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Server Cache Operations</CardTitle>
            <CardDescription>Next.js cache layer statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow label="Cache Hits" value={serverMetrics.hits} />
              <StatRow label="Cache Misses" value={serverMetrics.misses} />
              <StatRow label="Total Queries" value={serverMetrics.totalQueries} />
              <StatRow label="Failed Operations" value={serverMetrics.errors} />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Auto-refresh notice */}
      <div className="text-sm text-muted-foreground text-center">
        This dashboard shows current cache metrics. Refresh the page to update.
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  }
  
  return (
    <div className={`w-4 h-4 rounded-full ${colors[status]} animate-pulse`} />
  )
}

function MetricCard({ 
  title, 
  value, 
  description, 
  target,
  status 
}: { 
  title: string
  value: string
  description?: string
  target?: string
  status?: 'good' | 'warning' | 'bad'
}) {
  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    bad: 'text-red-600 dark:text-red-400',
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${status ? statusColors[status] : ''}`}>
          {value}
        </p>
        {target && (
          <p className="text-xs text-muted-foreground mt-1">Target: {target}</p>
        )}
      </CardContent>
    </Card>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value.toLocaleString()}</span>
    </div>
  )
}