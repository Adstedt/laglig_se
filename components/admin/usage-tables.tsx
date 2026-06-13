'use client'

import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UserUsageRow, WorkspaceUsageRow } from '@/lib/admin/queries'
import {
  grossMarginPct,
  tierMonthlyRevenueSek,
  usdToSek,
  MARGIN_ALERT_FLOOR_PCT,
} from '@/lib/costs/constants'

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_FORMATTER = new Intl.NumberFormat('sv-SE')

function formatUsd(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return '—'
  return USD_FORMATTER.format(num)
}

function formatNumber(value: bigint | number): string {
  return NUMBER_FORMATTER.format(
    typeof value === 'bigint' ? Number(value) : value
  )
}

const SEK_FORMATTER = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

function formatSek(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return SEK_FORMATTER.format(value)
}

/**
 * Story 5.10: per-workspace gross-margin estimate for the admin usage table.
 * AI-cost-only (the selected window's chat cost → SEK) vs the tier's monthly
 * list price — a quick directional read. The authoritative monthly figure
 * (incl. infra) is the WorkspaceCost rollup driving the weekly founder report.
 */
function rowMarginPct(row: WorkspaceUsageRow): number | null {
  const revenueSek = tierMonthlyRevenueSek(row.tier)
  const costSek = usdToSek(parseFloat(row.totalCostUsd) || 0)
  return grossMarginPct(revenueSek, costSek)
}

interface UsageTablesProps {
  workspaceRows: WorkspaceUsageRow[]
  userRows: UserUsageRow[]
  currentTab: 'workspace' | 'user'
  currentRange: number
}

export function UsageTables({
  workspaceRows,
  userRows,
  currentTab,
  currentRange,
}: UsageTablesProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI-användning</h1>
        <Select
          value={currentRange.toString()}
          onValueChange={(value) => updateParams({ range: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Senaste 7 dagarna</SelectItem>
            <SelectItem value="30">Senaste 30 dagarna</SelectItem>
            <SelectItem value="90">Senaste 90 dagarna</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(value) => updateParams({ tab: value })}
      >
        <TabsList>
          <TabsTrigger value="workspace">Per arbetsyta</TabsTrigger>
          <TabsTrigger value="user">Per användare</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arbetsyta</TableHead>
                  <TableHead>Nivå</TableHead>
                  <TableHead className="text-right">Kostnad</TableHead>
                  <TableHead className="text-right">Intäkt/mån</TableHead>
                  <TableHead className="text-right">Marginal (est.)</TableHead>
                  <TableHead className="text-right">In-tokens</TableHead>
                  <TableHead className="text-right">Ut-tokens</TableHead>
                  <TableHead className="text-right">Cache-läsningar</TableHead>
                  <TableHead className="text-right">Antal chat-turns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      Inga chat-turns registrerade för valt intervall.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspaceRows.map((row) => {
                    const marginPct = rowMarginPct(row)
                    const revenueSek = tierMonthlyRevenueSek(row.tier)
                    const lowMargin =
                      marginPct != null && marginPct < MARGIN_ALERT_FLOOR_PCT
                    return (
                      <TableRow key={row.workspaceId}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/workspaces/${row.workspaceId}`}
                            className="hover:underline"
                          >
                            {row.workspaceName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.tier}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatUsd(row.totalCostUsd)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatSek(revenueSek)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${lowMargin ? 'text-destructive font-semibold' : ''}`}
                        >
                          {marginPct == null
                            ? '—'
                            : `${marginPct.toFixed(1)} %`}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.totalInputTokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.totalOutputTokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.totalCacheReadTokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.turnCount)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Marginal (est.) = (intäkt − AI-kostnad i SEK) / intäkt för valt
            intervall — endast AI-kostnad. Den auktoritativa månadsmarginalen
            (inkl. infra) finns i den veckovisa enhetsekonomirapporten.
          </p>
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Användare</TableHead>
                  <TableHead>Arbetsyta</TableHead>
                  <TableHead className="text-right">Kostnad</TableHead>
                  <TableHead className="text-right">In-tokens</TableHead>
                  <TableHead className="text-right">Ut-tokens</TableHead>
                  <TableHead className="text-right">Antal chat-turns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      Inga chat-turns registrerade för valt intervall.
                    </TableCell>
                  </TableRow>
                ) : (
                  userRows.map((row) => (
                    <TableRow key={`${row.userId}-${row.workspaceId}`}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/users/${row.userId}`}
                          className="hover:underline"
                        >
                          {row.userName ?? row.userEmail}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/workspaces/${row.workspaceId}`}
                          className="hover:underline"
                        >
                          {row.workspaceName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatUsd(row.totalCostUsd)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(row.totalInputTokens)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(row.totalOutputTokens)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(row.turnCount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
