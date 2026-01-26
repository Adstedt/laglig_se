'use client'

/**
 * Story 6.6: Activity Feed
 * Combined feed of comments and history
 */

import { CommentInput } from './comment-input'
import { ThreadedComments } from './threaded-comments'
import type { TaskComment } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'

interface ActivityFeedProps {
  taskId: string
  comments: TaskComment[]
  workspaceMembers: WorkspaceMember[]
  onUpdate: () => Promise<void>
}

export function ActivityFeed({
  taskId,
  comments,
  workspaceMembers,
  onUpdate,
}: ActivityFeedProps) {
  // Get current user from workspace members (first one as fallback for now)
  // In real app, this would come from auth context
  const currentUser = workspaceMembers[0]

  return (
    <div className="space-y-6">
      {/* Comment Input - always visible at top */}
      <CommentInput
        taskId={taskId}
        currentUser={
          currentUser
            ? {
                name: currentUser.name,
                email: currentUser.email,
                avatar_url: currentUser.avatarUrl,
              }
            : undefined
        }
        onSubmit={onUpdate}
      />

      {/* Combined feed - for now just comments, history could be merged in */}
      <ThreadedComments
        comments={comments}
        taskId={taskId}
        currentUserId={currentUser?.id}
        onUpdate={onUpdate}
      />

      {/* Empty state */}
      {comments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Ingen aktivitet ännu. Lägg till en kommentar för att starta
            konversationen.
          </p>
        </div>
      )}
    </div>
  )
}
