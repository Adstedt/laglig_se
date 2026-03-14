'use client'

/**
 * Story 6.6 / 6.9: Task-specific Comment Input
 * Wraps the shared CommentInput with task modal server action binding.
 */

import {
  CommentInput as SharedCommentInput,
  type CommentInputUser,
} from '@/components/features/comments/comment-input'
import { createComment } from '@/app/actions/task-modal'

interface TaskCommentInputProps {
  taskId: string
  parentCommentId?: string | undefined
  currentUser?: CommentInputUser | undefined
  placeholder?: string | undefined
  onSubmit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  focusOnMount?: boolean | undefined
}

export function CommentInput({
  taskId,
  parentCommentId,
  currentUser,
  placeholder,
  onSubmit,
  onCancel,
  focusOnMount,
}: TaskCommentInputProps) {
  const handleSubmit = async (
    content: string,
    parentId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await createComment(taskId, content, parentId)
    return result
  }

  return (
    <SharedCommentInput
      parentCommentId={parentCommentId}
      currentUser={currentUser}
      placeholder={placeholder}
      onSubmit={handleSubmit}
      onSuccess={onSubmit}
      onCancel={onCancel}
      focusOnMount={focusOnMount}
    />
  )
}
