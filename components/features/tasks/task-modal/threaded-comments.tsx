'use client'

/**
 * Story 6.6 / 6.9: Task-specific Threaded Comments
 * Wraps the shared ThreadedComments with task modal server action bindings.
 */

import {
  ThreadedComments as SharedThreadedComments,
  type CommentData,
} from '@/components/features/comments/threaded-comments'
import {
  updateComment,
  deleteComment,
  createComment,
} from '@/app/actions/task-modal'
import type { TaskComment } from '@/app/actions/task-modal'

interface ThreadedCommentsProps {
  comments: TaskComment[]
  taskId: string
  currentUserId?: string | undefined
  onUpdate: () => Promise<void>
}

export function ThreadedComments({
  comments,
  taskId,
  currentUserId,
  onUpdate,
}: ThreadedCommentsProps) {
  const handleSubmit = async (
    content: string,
    parentCommentId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await createComment(taskId, content, parentCommentId)
  }

  const handleUpdate = async (
    commentId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await updateComment(commentId, content)
  }

  const handleDelete = async (
    commentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await deleteComment(commentId)
  }

  return (
    <SharedThreadedComments
      comments={comments as unknown as CommentData[]}
      currentUserId={currentUserId}
      onSubmit={handleSubmit}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onRefresh={onUpdate}
    />
  )
}
