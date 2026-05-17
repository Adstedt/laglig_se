/**
 * Story 25.3 (Epic 25, B.3): Tutorial-tabs barrel + lookup map.
 *
 * `TUTORIAL_TAB_COMPONENTS` is the public contract `<TutorialStep>` consumes —
 * keyed by `TutorialTabId` (the union exported from `../tutorial-step`), values
 * are the per-tab content components. Story 25.5's `<FeedbackStep>` will extend
 * this map with `'feedback'` when it lands.
 */

import type { ComponentType } from 'react'
import type { TutorialTabId } from '../tutorial-step'

import { TabLaglista } from './tab-laglista'
import { TabKravpunkter } from './tab-kravpunkter'
import { TabUppgifter } from './tab-uppgifter'
import { TabKontroller } from './tab-kontroller'
import { TabLagandringar } from './tab-lagandringar'
import { TabAiAgent } from './tab-ai-agent'

export const TUTORIAL_TAB_COMPONENTS: Record<TutorialTabId, ComponentType> = {
  laglista: TabLaglista,
  kravpunkter: TabKravpunkter,
  uppgifter: TabUppgifter,
  kontroller: TabKontroller,
  lagandringar: TabLagandringar,
  'ai-agent': TabAiAgent,
}

export {
  TabLaglista,
  TabKravpunkter,
  TabUppgifter,
  TabKontroller,
  TabLagandringar,
  TabAiAgent,
}
