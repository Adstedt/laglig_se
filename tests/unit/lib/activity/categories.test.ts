import { describe, it, expect } from 'vitest'
import {
  ACTION_TO_CATEGORY,
  ACTIVITY_CATEGORIES,
  CATEGORY_META,
  actionsForCategory,
  categoryForAction,
} from '@/lib/activity/categories'
import { KNOWN_ACTIONS } from '@/lib/activity/action-constants'

describe('activity categories', () => {
  it('maps every known action to a category', () => {
    for (const action of KNOWN_ACTIONS) {
      expect(
        ACTION_TO_CATEGORY[action],
        `missing category for ${action}`
      ).toBeTruthy()
    }
  })

  it('has CATEGORY_META for every declared category', () => {
    for (const category of ACTIVITY_CATEGORIES) {
      expect(CATEGORY_META[category]).toBeDefined()
      expect(CATEGORY_META[category].label).toBeTypeOf('string')
      expect(CATEGORY_META[category].icon).toBeTypeOf('object')
    }
  })

  it('actionsForCategory round-trips via ACTION_TO_CATEGORY', () => {
    for (const category of ACTIVITY_CATEGORIES) {
      const actions = actionsForCategory(category)
      for (const action of actions) {
        expect(ACTION_TO_CATEGORY[action]).toBe(category)
      }
    }
  })

  it('categoryForAction falls back to "andringar" for unknown actions', () => {
    expect(categoryForAction('totally_unknown_action')).toBe('andringar')
  })
})
