'use client'

/** Story 21.4 — cycle creation wizard, Step 1 (metadata capture). */

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { AuditType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { DocumentListSummary } from '@/app/actions/document-list'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type { CycleMetadata, CycleMetadataErrors } from './types'

export interface CycleMetadataStepProps {
  value: Partial<CycleMetadata>
  errors: CycleMetadataErrors
  lawLists: DocumentListSummary[]
  members: WorkspaceMemberOption[]
  onChange: (_next: Partial<CycleMetadata>) => void
  onNext: () => void
}

function initialsFromMember(member: WorkspaceMemberOption): string {
  const base = (member.name ?? member.email ?? '').trim()
  if (base.length === 0) return '?'
  const parts = base.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function CycleMetadataStep({
  value,
  errors,
  lawLists,
  members,
  onChange,
  onNext,
}: CycleMetadataStepProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const listId = useId()
  const typeId = useId()
  const startId = useId()
  const endId = useId()
  const cutoffId = useId()
  const auditorId = useId()

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  if (lawLists.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <p className="mb-4 text-sm text-muted-foreground">
          Skapa först en laglista för att kunna skapa en kontroll.
        </p>
        <Button asChild>
          <Link href="/laglistor">Till laglistor</Link>
        </Button>
      </div>
    )
  }

  const canProceed =
    Boolean(value.name?.trim()) &&
    Boolean(value.lawListId) &&
    Boolean(value.auditType) &&
    Boolean(value.scheduledStart) &&
    Boolean(value.scheduledEnd) &&
    Boolean(value.lawChangeCutoffDate) &&
    Boolean(value.leadAuditorUserId) &&
    Object.values(errors).every((e) => !e)

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor={nameId}>Namn</Label>
        <Input
          id={nameId}
          ref={firstFieldRef}
          value={value.name ?? ''}
          placeholder="T.ex. Årlig miljörevision 2026"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {errors.name ? (
          <p
            id={`${nameId}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={listId}>Laglista</Label>
        <Select
          value={value.lawListId ?? ''}
          onValueChange={(v) => onChange({ lawListId: v })}
        >
          <SelectTrigger id={listId} aria-invalid={Boolean(errors.lawListId)}>
            <SelectValue placeholder="Välj laglista" />
          </SelectTrigger>
          <SelectContent>
            {lawLists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name}
                {list.isDefault ? ' (standard)' : ''} — {list.itemCount}{' '}
                dokument
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={typeId}>Revisionstyp</Label>
        <ToggleGroup
          id={typeId}
          type="single"
          value={value.auditType ?? AuditType.INTERN}
          onValueChange={(v) => {
            if (v === AuditType.INTERN || v === AuditType.EXTERN) {
              onChange({ auditType: v })
            }
          }}
          aria-label="Revisionstyp"
          className="justify-start"
        >
          <ToggleGroupItem
            value={AuditType.INTERN}
            aria-label="Intern revision"
          >
            Intern revision
          </ToggleGroupItem>
          <ToggleGroupItem
            value={AuditType.EXTERN}
            aria-label="Extern revision"
          >
            Extern revision
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={startId}>Startdatum</Label>
          <Input
            id={startId}
            type="date"
            value={value.scheduledStart ?? ''}
            aria-invalid={Boolean(errors.scheduledStart)}
            onChange={(e) => onChange({ scheduledStart: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={endId}>Slutdatum</Label>
          <Input
            id={endId}
            type="date"
            value={value.scheduledEnd ?? ''}
            aria-invalid={Boolean(errors.scheduledEnd)}
            aria-describedby={
              errors.scheduledEnd ? `${endId}-error` : undefined
            }
            onChange={(e) => onChange({ scheduledEnd: e.target.value })}
          />
          {errors.scheduledEnd ? (
            <p
              id={`${endId}-error`}
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.scheduledEnd}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={cutoffId}>Brytdatum för lagändringar</Label>
        <Input
          id={cutoffId}
          type="date"
          value={value.lawChangeCutoffDate ?? ''}
          aria-describedby={`${cutoffId}-help`}
          onChange={(e) => onChange({ lawChangeCutoffDate: e.target.value })}
        />
        <p id={`${cutoffId}-help`} className="text-xs text-muted-foreground">
          Lagändringar publicerade efter detta datum ingår inte i kontrollens
          omfattning.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={auditorId}>Ansvarig revisor</Label>
        <Select
          value={value.leadAuditorUserId ?? ''}
          onValueChange={(v) => onChange({ leadAuditorUserId: v })}
        >
          <SelectTrigger
            id={auditorId}
            aria-invalid={Boolean(errors.leadAuditorUserId)}
          >
            <SelectValue placeholder="Välj ansvarig" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {initialsFromMember(m)}
                    </AvatarFallback>
                  </Avatar>
                  {m.name ?? m.email}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Nästa
        </Button>
      </div>
    </div>
  )
}
