'use client'

/**
 * Story 6.9: Comments Tab for Law List Item Modal
 * Threaded comments on law list items using shared comment components.
 */

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { CommentInput } from '@/components/features/comments/comment-input'
import {
  ThreadedComments,
  type CommentData,
} from '@/components/features/comments/threaded-comments'
import {
  getListItemComments,
  createListItemComment,
  updateListItemComment,
  deleteListItemComment,
  type ListItemComment,
} from '@/app/actions/legal-document-modal'

interface CommentsTabProps {
  listItemId: string
  currentUserId?: string | undefined
}

export function CommentsTab({ listItemId, currentUserId }: CommentsTabProps) {
  const [comments, setComments] = useState<ListItemComment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    const result = await getListItemComments(listItemId)
    if (result.success && result.data) {
      setComments(result.data)
    }
    setIsLoading(false)
  }, [listItemId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async (
    content: string,
    parentCommentId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await createListItemComment(listItemId, content, parentCommentId)
  }

  const handleUpdate = async (
    commentId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await updateListItemComment(commentId, content)
  }

  const handleDelete = async (
    commentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await deleteListItemComment(commentId)
  }

  const handleRefresh = async () => {
    await fetchComments()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Laddar kommentarer...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Comment input */}
      <CommentInput
        onSubmit={handleSubmit}
        onSuccess={handleRefresh}
        placeholder="Skriv en kommentar..."
      />

      {/* Comments list */}
      {comments.length > 0 ? (
        <ThreadedComments
          comments={comments as unknown as CommentData[]}
          currentUserId={currentUserId}
          onSubmit={handleSubmit}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Inga kommentarer ännu</p>
          <p className="text-xs text-muted-foreground mt-1">
            Lägg till en kommentar ovan för att starta en diskussion
          </p>
        </div>
      )}
    </div>
  )
}
