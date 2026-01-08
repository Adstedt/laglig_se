'use client'

/**
 * Story 6.3: Activity Tabs
 * Tabbed activity section with Alla, Kommentarer, Uppgifter, Bevis, Historik
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityFeed } from './activity-feed'
import { CommentsTab } from './comments-tab'
import { TasksTab } from './tasks-tab'
import { EvidenceTab } from './evidence-tab'
import { HistoryTab } from './history-tab'

interface ActivityTabsProps {
  listItemId: string
}

export function ActivityTabs({ listItemId }: ActivityTabsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">Aktivitet</h3>

      <Tabs defaultValue="alla" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex gap-1 h-auto p-1 bg-muted/60">
          <TabsTrigger
            id="activity-tab-alla"
            value="alla"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Alla
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-kommentarer"
            value="kommentarer"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Kommentarer
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-uppgifter"
            value="uppgifter"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Uppgifter
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-bevis"
            value="bevis"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Bevis
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-historik"
            value="historik"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Historik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alla" className="mt-4">
          <ActivityFeed listItemId={listItemId} />
        </TabsContent>

        <TabsContent value="kommentarer" className="mt-4">
          <CommentsTab listItemId={listItemId} />
        </TabsContent>

        <TabsContent value="uppgifter" className="mt-4">
          <TasksTab listItemId={listItemId} />
        </TabsContent>

        <TabsContent value="bevis" className="mt-4">
          <EvidenceTab listItemId={listItemId} />
        </TabsContent>

        <TabsContent value="historik" className="mt-4">
          <HistoryTab listItemId={listItemId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
