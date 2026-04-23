'use client'

/**
 * Story 21.7 — Finding editor dialog (create + edit modes).
 * Self-contained shadcn <Dialog>. Submits via createFinding / updateFinding
 * server actions and forwards the returned row to the parent via `onSuccess`
 * so the page-level SWR cache can be updated in-place (no revalidate).
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Calendar as CalendarIcon, Loader2, X as XIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  createFinding,
  updateFinding,
  type FindingRow,
} from '@/app/actions/compliance-finding'
import {
  FINDING_SEVERITY_OPTIONS,
  FINDING_TYPE_LABELS,
  FINDING_TYPE_OPTIONS,
} from '@/components/features/compliance-audit/finding-copy'
import { FindingSeverity, FindingType, TaskPriority } from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import { getWorkspaceMembers } from '@/app/actions/tasks'

interface WorkspaceMemberOption {
  id: string
  name: string | null
  email: string
}

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: TaskPriority
  label: string
}> = [
  { value: TaskPriority.LOW, label: 'Låg' },
  { value: TaskPriority.MEDIUM, label: 'Medel' },
  { value: TaskPriority.HIGH, label: 'Hög' },
  { value: TaskPriority.CRITICAL, label: 'Kritisk' },
]

type Mode = 'create' | 'edit'

interface FindingEditorProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  cycleId: string
  mode: Mode
  finding?: FindingRow
  items: CycleItemRow[]
  prefillLawListItemId?: string | null
  onSuccess: (_finding: FindingRow) => void
}

interface FormState {
  type: FindingType
  severity: FindingSeverity | null
  title: string
  description: string
  rootCause: string
  dueDate: Date | null
  lawListItemId: string | null
  requirementId: string | null
  // Epic 21 follow-up: opt-in/out for corrective-action task spawn.
  // Default is derived from `type` in create mode (AVVIKELSE → true,
  // others → false). Edit mode never reads this — spawning on edit is
  // the late-add row button's job.
  spawnTask: boolean
  // Epic 21 follow-up (phase 2): inline task-editor overrides revealed
  // when `spawnTask` is true. Each field is `null` → "use spawner default"
  // (UI shows the prefill hint). User can pick an explicit value which
  // threads through to createFinding.taskOverrides.
  taskAssigneeUserId: string | null
  taskDueDate: Date | null
  taskPriority: TaskPriority
  // Phase 3: user-editable task title + description. `null` sentinel
  // distinguishes "not yet customised" (apply default on step-2 entry) from
  // "user cleared the field" (validation blocks submit). Lazy-prefill on
  // step 1 → 2 transition; cleared when `spawnTask` flips to false.
  taskTitle: string | null
  taskDescription: string | null
}

function buildInitialState(
  mode: Mode,
  finding: FindingRow | undefined,
  prefillLawListItemId: string | null | undefined
): FormState {
  if (mode === 'edit' && finding) {
    return {
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      rootCause: finding.rootCause ?? '',
      dueDate: finding.dueDate,
      lawListItemId: finding.lawListItemId,
      requirementId: finding.requirementId,
      // Unused in edit mode — checkbox is create-mode-only. Keep a stable
      // default so FormState stays uniform.
      spawnTask: false,
      taskAssigneeUserId: null,
      taskDueDate: null,
      taskPriority: TaskPriority.HIGH,
      taskTitle: null,
      taskDescription: null,
    }
  }
  // Create mode: initial type is OBSERVATION so checkbox default is OFF,
  // per the prototype decision tree. Flipping to AVVIKELSE via the type
  // switcher re-derives spawnTask to ON as long as the user hasn't manually
  // touched the checkbox (handled in the onClick handler for the type
  // radio buttons).
  return {
    type: FindingType.OBSERVATION,
    severity: null,
    title: '',
    description: '',
    rootCause: '',
    dueDate: null,
    lawListItemId: prefillLawListItemId ?? null,
    requirementId: null,
    spawnTask: false,
    // null = "use spawner defaults from finding context"; user overrides
    // get picked up when the inline editor is revealed.
    taskAssigneeUserId: null,
    taskDueDate: null,
    taskPriority: TaskPriority.HIGH,
    // null = "not yet customised" — prefill runs on step 1 → 2 transition.
    taskTitle: null,
    taskDescription: null,
  }
}

export function FindingEditor({
  open,
  onOpenChange,
  cycleId,
  mode,
  finding,
  items,
  prefillLawListItemId,
  onSuccess,
}: FindingEditorProps) {
  const [state, setState] = useState<FormState>(() =>
    buildInitialState(mode, finding, prefillLawListItemId)
  )
  const [submitting, setSubmitting] = useState(false)
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false)
  const [taskDueDatePickerOpen, setTaskDueDatePickerOpen] = useState(false)
  // Epic 21 follow-up: track whether the user has manually toggled the
  // spawn-task checkbox. If untouched, we re-derive from type on type switch.
  // If touched, the user's choice persists across type switches.
  const [spawnTaskTouched, setSpawnTaskTouched] = useState(false)
  // Epic 21 follow-up (phase 3 — two-step wizard): step 1 = finding fields,
  // step 2 = task-spawn config. Step 2 is only reachable when spawnTask is
  // true; otherwise the flow collapses to single-step (back-compat). Reset
  // to 1 whenever the dialog opens (handled in the existing open-reset
  // effect below). `step` + `setStep` are wired into footer / stepper /
  // handleSubmit in the steps below — next edit will reference them.
  const [step, setStep] = useState<1 | 2>(1)
  // Epic 21 follow-up (phase 2): workspace members for the inline assignee
  // picker. Lazy-fetched on first reveal of the inline editor — the data
  // isn't needed unless the user opts in to spawn.
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Reset form whenever the dialog opens (or switches finding/mode).
  useEffect(() => {
    if (open) {
      setState(buildInitialState(mode, finding, prefillLawListItemId))
      setSpawnTaskTouched(false)
      setStep(1)
    }
  }, [open, mode, finding, prefillLawListItemId])

  // Lazy-fetch workspace members on first reveal. Keeps the picker silent
  // for OBSERVATION/FÖRBÄTTRING users who don't opt in.
  useEffect(() => {
    if (!open || mode !== 'create' || !state.spawnTask) return
    if (members.length > 0 || membersLoading) return
    setMembersLoading(true)
    getWorkspaceMembers()
      .then((result) => {
        if (result.success && result.data) {
          setMembers(
            result.data.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
            }))
          )
        }
      })
      .finally(() => setMembersLoading(false))
  }, [open, mode, state.spawnTask, members.length, membersLoading])

  // Phase 3: lazy prefill of task title + description on step 1 → 2 transition.
  // The `??` guard preserves user edits across Tillbaka/Nästa round-trips — if
  // either field is already set (user typed something), re-entry doesn't
  // overwrite. If user edits the finding title AFTER first step-2 visit, the
  // task title stays at the user's explicit edit (intentional).
  useEffect(() => {
    if (step !== 2) return
    setState((s) => ({
      ...s,
      taskTitle: s.taskTitle ?? s.title.trim(),
      taskDescription:
        s.taskDescription ??
        'Korrigerande åtgärd för avvikelse: ' + s.description.trim(),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const selectedItem = useMemo(
    () => items.find((i) => i.lawListItemId === state.lawListItemId) ?? null,
    [items, state.lawListItemId]
  )

  const requirementOptions = useMemo(() => {
    if (!selectedItem?.kravpunkterSnapshot) return []
    return selectedItem.kravpunkterSnapshot.requirements.map((r) => ({
      id: r.id,
      text: r.text,
    }))
  }, [selectedItem])

  const showSeverity = state.type === FindingType.AVVIKELSE
  const titleTooLong = state.title.length > 200
  const descriptionTooLong = state.description.length > 5000
  const rootCauseTooLong = state.rootCause.length > 5000
  const severityMissing = showSeverity && state.severity === null

  // Pure "is step 1 valid" — drives both the "Nästa" advance-to-step-2 gate
  // and the final submit gate. Step 1 fields are authoritative required.
  const step1Valid =
    state.title.trim().length > 0 &&
    state.description.trim().length > 0 &&
    !titleTooLong &&
    !descriptionTooLong &&
    !rootCauseTooLong &&
    !severityMissing

  // Phase 3: step-2 task-field validation. `null` = not customised (use
  // spawner default, always valid). Empty-string = user cleared it, which
  // blocks submit via aria-invalid; they must type something or close the
  // dialog. Max-length tracks the finding fields (200/5000).
  const taskTitleTooLong = (state.taskTitle ?? '').length > 200
  const taskDescriptionTooLong = (state.taskDescription ?? '').length > 5000
  const taskTitleEmpty =
    state.spawnTask &&
    state.taskTitle !== null &&
    state.taskTitle.trim().length === 0
  const taskDescriptionEmpty =
    state.spawnTask &&
    state.taskDescription !== null &&
    state.taskDescription.trim().length === 0

  const canSubmit =
    !submitting &&
    step1Valid &&
    !taskTitleTooLong &&
    !taskDescriptionTooLong &&
    !taskTitleEmpty &&
    !taskDescriptionEmpty

  const dialogTitle =
    mode === 'create'
      ? 'Ny finding'
      : `Redigera ${FINDING_TYPE_LABELS[state.type].toLowerCase()}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Wizard: step 1 must be valid before we can do anything useful.
    if (!step1Valid) return

    // Wizard: step 1 + spawnTask opt-in → advance to step 2 instead of
    // committing. Covers the "Nästa: uppgiftens detaljer" click AND the
    // Enter-in-title keyboard path (form's native submit handler).
    if (mode === 'create' && state.spawnTask && step === 1) {
      setStep(2)
      return
    }

    if (!canSubmit) return
    setSubmitting(true)

    try {
      if (mode === 'create') {
        // Epic 21 follow-up (phase 2): collect inline task-editor overrides
        // only when the user opted in. Each field is included only if the
        // user explicitly chose a non-default value.
        // Phase 3: also include taskTitle / taskDescription when user edited
        // them (trimmed != default derivation). Unchanged values drop out so
        // spawner uses defaults — zero drift for no-op edits.
        const defaultTaskTitle = state.title.trim()
        const defaultTaskDesc =
          'Korrigerande åtgärd för avvikelse: ' + state.description.trim()
        const taskTitleChanged =
          state.taskTitle !== null &&
          state.taskTitle.trim() !== defaultTaskTitle
        const taskDescChanged =
          state.taskDescription !== null &&
          state.taskDescription.trim() !== defaultTaskDesc

        const taskOverrides = state.spawnTask
          ? {
              ...(state.taskAssigneeUserId !== null
                ? { assigneeUserId: state.taskAssigneeUserId }
                : {}),
              ...(state.taskDueDate !== null
                ? { dueDate: state.taskDueDate }
                : {}),
              // Always forward priority — UI default is HIGH to match the
              // spawner's default, so no drift even when user doesn't touch.
              priority: state.taskPriority,
              ...(taskTitleChanged ? { title: state.taskTitle!.trim() } : {}),
              ...(taskDescChanged
                ? { description: state.taskDescription!.trim() }
                : {}),
            }
          : undefined

        const result = await createFinding({
          cycleId,
          type: state.type,
          severity: showSeverity ? state.severity : null,
          title: state.title.trim(),
          description: state.description.trim(),
          rootCause: state.rootCause.trim() || null,
          dueDate: state.dueDate,
          lawListItemId: state.lawListItemId,
          requirementId: state.requirementId,
          // Epic 21 follow-up: explicit opt-in/out for task spawn.
          spawnTask: state.spawnTask,
          ...(taskOverrides ? { taskOverrides } : {}),
        })
        if (!result.success || !result.data) {
          toast.error('Kunde inte skapa finding', {
            description: result.error,
          })
          return
        }
        toast.success('Finding skapad')
        onSuccess(result.data.finding)
        onOpenChange(false)
      } else if (finding) {
        const result = await updateFinding({
          findingId: finding.id,
          type: state.type,
          severity: showSeverity ? state.severity : null,
          title: state.title.trim(),
          description: state.description.trim(),
          rootCause: state.rootCause.trim() || null,
          dueDate: state.dueDate,
          lawListItemId: state.lawListItemId,
          requirementId: state.requirementId,
        })
        if (!result.success || !result.data) {
          toast.error('Kunde inte uppdatera finding', {
            description: result.error,
          })
          return
        }
        toast.success('Finding uppdaterad')
        onSuccess(result.data.finding)
        onOpenChange(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {/* pr-8 reserves space for the shadcn Dialog's auto-rendered close
              X (absolute, right-4) so the stepper text doesn't overlap it. */}
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle>{dialogTitle}</DialogTitle>
            {/* Wizard stepper — visible only when the flow has a step 2,
                i.e. create mode with spawnTask opted-in. Edit mode and
                unchecked create stay single-step (no stepper). aria-live
                announces transitions to assistive tech. */}
            {mode === 'create' && state.spawnTask ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="finding-wizard-stepper"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Steg {step} av 2
              </div>
            ) : null}
          </div>
          <DialogDescription>
            Registrera en avvikelse, observation eller förbättringsförslag mot
            kontrollen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 ? (
            <>
              {/* Type */}
              <div className="space-y-2">
                <Label>Typ</Label>
                <div
                  role="radiogroup"
                  aria-label="Typ av finding"
                  className="grid grid-cols-3 gap-2"
                >
                  {FINDING_TYPE_OPTIONS.map((opt) => {
                    const active = state.type === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`finding-type-${opt.value}`}
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            type: opt.value,
                            // Clear severity when leaving AVVIKELSE.
                            severity:
                              opt.value === FindingType.AVVIKELSE
                                ? s.severity
                                : null,
                            // Re-derive spawnTask default from the new type ONLY
                            // if the user hasn't manually toggled the checkbox.
                            // Preserves explicit user intent across type switches.
                            spawnTask: spawnTaskTouched
                              ? s.spawnTask
                              : opt.value === FindingType.AVVIKELSE,
                          }))
                        }
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input hover:bg-muted'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Severity (conditional) */}
              {showSeverity ? (
                <div className="space-y-2">
                  <Label htmlFor="finding-severity">Allvarlighetsgrad</Label>
                  <Select
                    value={state.severity ?? ''}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        severity:
                          v === 'MAJOR' || v === 'MINOR'
                            ? (v as FindingSeverity)
                            : null,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="finding-severity"
                      data-testid="finding-severity-trigger"
                      aria-invalid={severityMissing}
                    >
                      <SelectValue placeholder="Välj allvarlighetsgrad" />
                    </SelectTrigger>
                    <SelectContent>
                      {FINDING_SEVERITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {severityMissing ? (
                    <p className="text-xs text-destructive">
                      Allvarlighetsgrad krävs för avvikelser
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="finding-title">Titel</Label>
                <Input
                  id="finding-title"
                  data-testid="finding-title"
                  value={state.title}
                  onChange={(e) =>
                    setState((s) => ({ ...s, title: e.target.value }))
                  }
                  placeholder="T.ex. Saknad utbildningsplan för kemikaliehantering"
                  maxLength={200}
                  aria-invalid={titleTooLong}
                  required
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{titleTooLong ? 'Max 200 tecken' : ''}</span>
                  <span>{state.title.length}/200</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="finding-description">Beskrivning</Label>
                <Textarea
                  id="finding-description"
                  data-testid="finding-description"
                  value={state.description}
                  onChange={(e) =>
                    setState((s) => ({ ...s, description: e.target.value }))
                  }
                  rows={4}
                  maxLength={5000}
                  aria-invalid={descriptionTooLong}
                  required
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{descriptionTooLong ? 'Max 5000 tecken' : ''}</span>
                  <span>{state.description.length}/5000</span>
                </div>
              </div>

              {/* Root cause */}
              <div className="space-y-2">
                <Label htmlFor="finding-root-cause">
                  Grundorsak (frivilligt)
                </Label>
                <Textarea
                  id="finding-root-cause"
                  data-testid="finding-root-cause"
                  value={state.rootCause}
                  onChange={(e) =>
                    setState((s) => ({ ...s, rootCause: e.target.value }))
                  }
                  rows={3}
                  maxLength={5000}
                  aria-invalid={rootCauseTooLong}
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  <span>{state.rootCause.length}/5000</span>
                </div>
              </div>

              {/* Due date */}
              <div className="space-y-2">
                <Label>Förfallodatum (frivilligt)</Label>
                <div className="flex items-center gap-2">
                  <Popover
                    open={dueDatePickerOpen}
                    onOpenChange={setDueDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="finding-due-date-trigger"
                        className={cn(
                          'justify-start text-left font-normal',
                          !state.dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {state.dueDate
                          ? format(state.dueDate, 'PPP', { locale: sv })
                          : 'Välj datum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={state.dueDate ?? undefined}
                        onSelect={(d) => {
                          setState((s) => ({ ...s, dueDate: d ?? null }))
                          setDueDatePickerOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {state.dueDate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setState((s) => ({ ...s, dueDate: null }))}
                      aria-label="Rensa datum"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Item link */}
              <div className="space-y-2">
                <Label htmlFor="finding-item">
                  Koppla till lag (frivilligt)
                </Label>
                <Select
                  value={state.lawListItemId ?? '__none__'}
                  onValueChange={(v) =>
                    setState((s) => ({
                      ...s,
                      lawListItemId: v === '__none__' ? null : v,
                      // Clear requirement whenever the item changes.
                      requirementId: null,
                    }))
                  }
                >
                  <SelectTrigger
                    id="finding-item"
                    data-testid="finding-item-trigger"
                  >
                    <SelectValue placeholder="Välj lag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen koppling</SelectItem>
                    {items.map((it) => (
                      <SelectItem
                        key={it.lawListItemId}
                        value={it.lawListItemId}
                      >
                        {it.lawTitle} ({it.lawDocumentNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Requirement link (dependent on item) */}
              {state.lawListItemId && requirementOptions.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="finding-requirement">
                    Kravpunkt (från kontrollens snapshot)
                  </Label>
                  <Select
                    value={state.requirementId ?? '__none__'}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        requirementId: v === '__none__' ? null : v,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="finding-requirement"
                      data-testid="finding-requirement-trigger"
                    >
                      <SelectValue placeholder="Välj kravpunkt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Ingen kravpunkt</SelectItem>
                      {requirementOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.text.length > 80
                            ? r.text.slice(0, 80) + '…'
                            : r.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {/* Spawn-task opt-in/out (Epic 21 follow-up — create mode only).
              Checkbox only — task-override fields live on step 2. */}
              {mode === 'create' ? (
                <div
                  className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"
                  data-testid="finding-spawn-task-box"
                >
                  <label
                    htmlFor="finding-spawn-task-checkbox"
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <Checkbox
                      id="finding-spawn-task-checkbox"
                      checked={state.spawnTask}
                      onCheckedChange={(checked) => {
                        setSpawnTaskTouched(true)
                        setState((s) => ({
                          ...s,
                          spawnTask: checked === true,
                          // Phase 3: clear task title/description customisation
                          // when user opts out. Re-checking re-prefills from
                          // current finding values — clean mental model.
                          ...(checked !== true
                            ? { taskTitle: null, taskDescription: null }
                            : {}),
                        }))
                      }}
                      className="mt-0.5"
                      aria-label="Skapa åtgärdsuppgift"
                      data-testid="finding-spawn-task-checkbox"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Skapa åtgärdsuppgift
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        En uppgift i arbetsytans uppgiftssystem som spårar den
                        korrigerande åtgärden. Du konfigurerar uppgiften i nästa
                        steg.
                      </p>
                    </div>
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              {/* Phase 3: editable task title + description fields.
                  Prefilled from finding defaults on step-2 entry; user can
                  override to decouple task phrasing from finding phrasing. */}
              <div className="space-y-3" data-testid="finding-task-preview">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Uppgift
                </p>

                {/* Task title */}
                <div className="space-y-1">
                  <Label htmlFor="finding-task-title" className="text-xs">
                    Uppgiftens titel
                  </Label>
                  <Input
                    id="finding-task-title"
                    data-testid="finding-task-title"
                    value={state.taskTitle ?? ''}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        taskTitle: e.target.value,
                      }))
                    }
                    maxLength={200}
                    aria-invalid={taskTitleTooLong || taskTitleEmpty}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Förvalt från findingens titel</span>
                    <span>{(state.taskTitle ?? '').length}/200</span>
                  </div>
                </div>

                {/* Task description */}
                <div className="space-y-1">
                  <Label htmlFor="finding-task-description" className="text-xs">
                    Uppgiftens beskrivning
                  </Label>
                  <Textarea
                    id="finding-task-description"
                    data-testid="finding-task-description"
                    value={state.taskDescription ?? ''}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        taskDescription: e.target.value,
                      }))
                    }
                    rows={4}
                    maxLength={5000}
                    aria-invalid={
                      taskDescriptionTooLong || taskDescriptionEmpty
                    }
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      Förvalt från findingens beskrivning med åtgärdsprefix
                    </span>
                    <span>{(state.taskDescription ?? '').length}/5000</span>
                  </div>
                </div>
              </div>

              {/* Task override fields (assignee / due / priority) */}
              <div className="space-y-3">
                {/* Assignee */}
                <div className="space-y-1">
                  <Label htmlFor="finding-task-assignee" className="text-xs">
                    Ansvarig
                  </Label>
                  <Select
                    value={state.taskAssigneeUserId ?? '__default__'}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        taskAssigneeUserId: v === '__default__' ? null : v,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="finding-task-assignee"
                      data-testid="finding-task-assignee-trigger"
                    >
                      <SelectValue placeholder="Välj ansvarig" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        Förvalt (lagpostens ansvarige / ledrevisor)
                      </SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {membersLoading ? (
                    <p className="text-[10px] text-muted-foreground">
                      Laddar medlemmar…
                    </p>
                  ) : null}
                </div>

                {/* Due date */}
                <div className="space-y-1">
                  <Label className="text-xs">Förfallodatum</Label>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={taskDueDatePickerOpen}
                      onOpenChange={setTaskDueDatePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="finding-task-due-date-trigger"
                          className={cn(
                            'justify-start text-left font-normal',
                            !state.taskDueDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {state.taskDueDate
                            ? format(state.taskDueDate, 'PPP', { locale: sv })
                            : state.dueDate
                              ? `Förvalt: ${format(state.dueDate, 'PPP', { locale: sv })}`
                              : 'Välj datum'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={state.taskDueDate ?? undefined}
                          onSelect={(d) => {
                            setState((s) => ({
                              ...s,
                              taskDueDate: d ?? null,
                            }))
                            setTaskDueDatePickerOpen(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {state.taskDueDate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setState((s) => ({ ...s, taskDueDate: null }))
                        }
                        aria-label="Rensa uppgiftens datum"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <Label htmlFor="finding-task-priority" className="text-xs">
                    Prioritet
                  </Label>
                  <Select
                    value={state.taskPriority}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        taskPriority: v as TaskPriority,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="finding-task-priority"
                      data-testid="finding-task-priority-trigger"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : null}

          <DialogFooter>
            {mode === 'create' && state.spawnTask && step === 2 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  data-testid="finding-back"
                >
                  Tillbaka
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  data-testid="finding-submit"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Skapa finding och uppgift'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Avbryt
                </Button>
                <Button
                  type="submit"
                  disabled={
                    mode === 'create' ? !step1Valid || submitting : !canSubmit
                  }
                  data-testid="finding-submit"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === 'edit' ? (
                    'Spara ändringar'
                  ) : state.spawnTask ? (
                    'Nästa: uppgiftens detaljer'
                  ) : (
                    'Skapa finding'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
