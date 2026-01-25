'use client'

/**
 * Story 6.6: Comments Tab
 * Threaded comments only view
 */

import { MessageSquare } from 'lucide-react'
import { CommentInput } from './comment-input'
import { ThreadedComments } from './threaded-comments'
import type { TaskComment } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'

interface CommentsTabProps {
  taskId: string
  comments: TaskComment[]
  workspaceMembers: WorkspaceMember[]
  onUpdate: () => Promise<void>
}

export function CommentsTab({
  taskId,
  comments,
  workspaceMembers,
  onUpdate,
}: CommentsTabProps) {
  // Get current user from workspace members
  const currentUser = workspaceMembers[0]

  return (
    <div className="space-y-6">
      {/* Comment Input */}
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

      {/* Comments List */}
      {comments.length > 0 ? (
        <ThreadedComments
          comments={comments}
          taskId={taskId}
          currentUserId={currentUser?.id}
          onUpdate={onUpdate}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Inga kommentarer ännu</p>
          <p className="text-xs text-muted-foreground mt-1">
            Skriv en kommentar ovan för att starta konversationen
          </p>
        </div>
      )}
    </div>
  )
}
