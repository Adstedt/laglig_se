export interface Question {
  id: string
  label: string
  description: string
  flagKey: string
  defaultValue: boolean
  inferredFromWebsite: boolean
}

export interface QuestionSelectionInput {
  sniCode?: string | undefined
  employerStatus?: boolean | undefined
  employeeCount?: number | undefined
  inferredFlags?: Record<string, boolean> | undefined
}

interface QuestionDef {
  id: string
  label: string
  description: string
  flagKey: string
  alwaysAsk: boolean
  /** SNI prefixes that trigger this question (2-digit strings) */
  sniTriggers: string[]
  /** Also triggered by employer/employee status */
  employerTrigger?: boolean | undefined
  /** Priority for sorting — lower = higher priority */
  priority: number
}

const QUESTION_POOL: QuestionDef[] = [
  {
    id: 'personalData',
    label: 'Hanterar ni personuppgifter utöver anställda?',
    description:
      'T.ex. kundregister, hälsodata eller kameraövervakning — påverkar GDPR-krav',
    flagKey: 'personalData',
    alwaysAsk: true,
    sniTriggers: [],
    priority: 0,
  },
  {
    id: 'collective_agreement',
    label: 'Har ni kollektivavtal?',
    description: 'Påverkar vilka arbetsrättsliga regler som gäller',
    flagKey: 'has_collective_agreement',
    alwaysAsk: true,
    sniTriggers: [],
    priority: 1,
  },
  {
    id: 'construction',
    label: 'Bedriver ni bygg- eller anläggningsverksamhet?',
    description:
      'Påverkar vilka byggregler och arbetsmiljöföreskrifter som gäller',
    flagKey: 'construction',
    alwaysAsk: false,
    sniTriggers: ['41', '42', '43'],
    priority: 2,
  },
  {
    id: 'food',
    label: 'Hanterar ni livsmedel?',
    description: 'Produktion, servering eller försäljning av mat och dryck',
    flagKey: 'food',
    alwaysAsk: false,
    sniTriggers: ['10', '11', '12', '55', '56'],
    priority: 3,
  },
  {
    id: 'chemicals',
    label: 'Hanterar ni kemikalier eller farliga ämnen?',
    description: 'Tillverkning, lagring eller användning av kemiska produkter',
    flagKey: 'chemicals',
    alwaysAsk: false,
    sniTriggers: ['20', '21'],
    priority: 4,
  },
  {
    id: 'publicSector',
    label: 'Är ni en myndighet eller offentligt ägd verksamhet?',
    description: 'Påverkar krav på offentlighet, upphandling och insyn',
    flagKey: 'publicSector',
    alwaysAsk: false,
    sniTriggers: ['84'],
    priority: 5,
  },
  {
    id: 'minorEmployees',
    label: 'Har ni anställda under 18 år?',
    description:
      'Särskilda arbetsmiljöregler gäller för minderåriga arbetstagare',
    flagKey: 'minorEmployees',
    alwaysAsk: false,
    sniTriggers: ['85'],
    employerTrigger: true,
    priority: 6,
  },
  {
    id: 'internationalOperations',
    label: 'Bedriver ni internationell verksamhet?',
    description: 'Import, export eller verksamhet utanför Sverige',
    flagKey: 'internationalOperations',
    alwaysAsk: false,
    sniTriggers: [],
    priority: 7,
  },
  {
    id: 'heavyMachinery',
    label: 'Använder ni tunga maskiner eller fordon i verksamheten?',
    description: 'Truckar, kranar, industriella maskiner eller tung utrustning',
    flagKey: 'heavyMachinery',
    alwaysAsk: false,
    sniTriggers: [
      '25',
      '26',
      '27',
      '28',
      '29',
      '30',
      '31',
      '32',
      '33',
      '49',
      '50',
      '51',
      '52',
      '53',
    ],
    priority: 8,
  },
]

const MAX_QUESTIONS = 5

function getSniPrefix(sniCode: string): string {
  // SNI codes are like "62010" — take first 2 digits
  return sniCode.replace(/\D/g, '').slice(0, 2)
}

/**
 * Select onboarding questions based on company profile.
 * Returns max 5 questions, prioritized by: always-ask first, then SNI-relevant, then inferred flags.
 */
export function selectQuestions(input: QuestionSelectionInput): Question[] {
  const { sniCode, employerStatus, employeeCount, inferredFlags } = input
  const sniPrefix = sniCode ? getSniPrefix(sniCode) : ''

  const hasEmployees =
    employerStatus === true ||
    (employeeCount !== undefined && employeeCount > 0)

  // Determine which questions are relevant
  const relevant: QuestionDef[] = []

  for (const q of QUESTION_POOL) {
    if (q.alwaysAsk) {
      relevant.push(q)
      continue
    }

    // Check SNI trigger
    if (sniPrefix && q.sniTriggers.includes(sniPrefix)) {
      relevant.push(q)
      continue
    }

    // Check employer trigger
    if (q.employerTrigger && hasEmployees) {
      relevant.push(q)
      continue
    }

    // Check inferred flags — if the flag was inferred, include the question
    if (inferredFlags?.[q.flagKey]) {
      relevant.push(q)
      continue
    }
  }

  // Sort by priority (always-ask first, then by defined priority)
  relevant.sort((a, b) => a.priority - b.priority)

  // Cap at MAX_QUESTIONS
  const selected = relevant.slice(0, MAX_QUESTIONS)

  // Map to output format with default values from inferred flags
  return selected.map((q) => ({
    id: q.id,
    label: q.label,
    description: q.description,
    flagKey: q.flagKey,
    defaultValue: inferredFlags?.[q.flagKey] === true,
    inferredFromWebsite: inferredFlags?.[q.flagKey] === true,
  }))
}
