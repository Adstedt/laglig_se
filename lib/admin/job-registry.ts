export interface CronJobDefinition {
  name: string
  displayName: string
  description: string
  schedule: string
  scheduleHuman: string
  endpoint: string
  authHeader: string
  instrumented: boolean
}

export const JOB_REGISTRY: CronJobDefinition[] = [
  {
    name: 'generate-summaries',
    displayName: 'AI-sammanfattningar',
    description: 'Genererar AI-sammanfattningar för lagdokument',
    schedule: '0 3 * * *',
    scheduleHuman: 'Dagligen kl. 03:00 UTC',
    endpoint: '/api/cron/generate-summaries',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'sync-sfs',
    displayName: 'SFS-synkronisering',
    description: 'Synkroniserar lagar från Riksdagen (fullständig)',
    schedule: '0 4 * * *',
    scheduleHuman: 'Dagligen kl. 04:00 UTC',
    endpoint: '/api/cron/sync-sfs',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'sync-sfs-updates',
    displayName: 'SFS-uppdateringar',
    description: 'Synkroniserar senaste SFS-uppdateringar',
    schedule: '30 4 * * *',
    scheduleHuman: 'Dagligen kl. 04:30 UTC',
    endpoint: '/api/cron/sync-sfs-updates',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'sync-court-cases',
    displayName: 'Rättsfallssynkronisering',
    description: 'Synkroniserar rättsfall från Domstolsverket',
    schedule: '0 5 * * *',
    scheduleHuman: 'Dagligen kl. 05:00 UTC',
    endpoint: '/api/cron/sync-court-cases',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'prewarm-cache',
    displayName: 'Cache-förladdning',
    description: 'Förladdar browse-cache efter synkroniseringsjobb',
    schedule: '30 5 * * *',
    scheduleHuman: 'Dagligen kl. 05:30 UTC',
    endpoint: '/api/cron/prewarm-cache',
    authHeader: 'CRON_SECRET',
    instrumented: true,
  },
  {
    name: 'retry-failed-pdfs',
    displayName: 'Försök misslyckade PDF:er',
    description: 'Försöker hämta PDF:er som misslyckats vid tidigare synk',
    schedule: '0 6 * * 0',
    scheduleHuman: 'Söndagar kl. 06:00 UTC',
    endpoint: '/api/cron/retry-failed-pdfs',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'warm-cache',
    displayName: 'Cache Warming',
    description:
      'Värmer cache för populära dokument baserat på laglistor och besök',
    schedule: '45 5 * * *',
    scheduleHuman: 'Dagligen kl. 05:45 UTC',
    endpoint: '/api/cron/warm-cache',
    authHeader: 'CRON_SECRET',
    instrumented: true,
  },
  {
    name: 'cleanup-workspaces',
    displayName: 'Workspace-städning',
    description: 'Rensar upp borttagna workspaces',
    schedule: '0 6 * * *',
    scheduleHuman: 'Dagligen kl. 06:00 UTC',
    endpoint: '/api/cron/cleanup-workspaces',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
  {
    name: 'notify-amendment-changes',
    displayName: 'Daglig ändringsavisering',
    description:
      'Skickar e-postdigest med lagändringar till berörda arbetsytor',
    schedule: '0 7 * * *',
    scheduleHuman: 'Dagligen kl. 07:00 UTC',
    endpoint: '/api/cron/notify-amendment-changes',
    authHeader: 'CRON_SECRET',
    instrumented: false,
  },
]
