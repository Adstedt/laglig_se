'use client'

/**
 * Story 6.9: Shared Threaded Comments Display
 * Generic threaded comments with nesting, edit, delete, and reply.
 * Extracted from task modal (Story 6.6). Used by both task modal and law list item modal.
 */

import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Reply, Edit2, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommentInput } from './comment-input'
import { toast } from 'sonner'

export interface CommentData {
  id: string
  content: string
  author_id: string
  parent_id: string | null
  depth: number
  mentions: string[]
  created_at: Date
  edited_at: Date | null
  author: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  replies?: CommentData[]
}

interface ThreadedCommentsProps {
  comments: CommentData[]
  currentUserId?: string | undefined
  onSubmit: (
    _content: string,
    _parentCommentId?: string
  ) => Promise<{ success: boolean; error?: string }>
  onUpdate: (
    _commentId: string,
    _content: string
  ) => Promise<{ success: boolean; error?: string }>
  onDelete: (
    _commentId: string
  ) => Promise<{ success: boolean; error?: string }>
  onRefresh: () => Promise<void>
}

export function ThreadedComments({
  comments,
  currentUserId,
  onSubmit,
  onUpdate,
  onDelete,
  onRefresh,
}: ThreadedCommentsProps) {
  if (comments.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onSubmit={onSubmit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRefresh={onRefresh}
          depth={0}
        />
      ))}
    </div>
  )
}

interface CommentThreadProps {
  comment: CommentData
  currentUserId?: string | undefined
  onSubmit: (
    _content: string,
    _parentCommentId?: string
  ) => Promise<{ success: boolean; error?: string }>
  onUpdate: (
    _commentId: string,
    _content: string
  ) => Promise<{ success: boolean; error?: string }>
  onDelete: (
    _commentId: string
  ) => Promise<{ success: boolean; error?: string }>
  onRefresh: () => Promise<void>
  depth: number
}

function CommentThread({
  comment,
  currentUserId,
  onSubmit,
  onUpdate,
  onDelete,
  onRefresh,
  depth,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
    }
  }, [isEditing])

  const isOwnComment = currentUserId === comment.author_id
  const canReply = depth < 2

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSaving) return

    setIsSaving(true)
    const result = await onUpdate(comment.id, editContent.trim())

    if (result.success) {
      setIsEditing(false)
      await onRefresh()
    } else {
      toast.error('Kunde inte uppdatera', { description: result.error })
    }

    setIsSaving(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await onDelete(comment.id)

    if (result.success) {
      await onRefresh()
    } else {
      toast.error('Kunde inte radera', { description: result.error })
    }

    setIsDeleting(false)
  }

  const handleReplySuccess = async () => {
    setIsReplying(false)
    await onRefresh()
  }

  const initials = (comment.author.name ?? comment.author.email)
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={cn(
        'space-y-3',
        depth > 0 && 'ml-8 pl-4 border-l-2 border-muted'
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          {comment.author.avatar_url && (
            <AvatarImage
              src={comment.author.avatar_url}
              alt={comment.author.name ?? ''}
            />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {comment.author.name ?? comment.author.email}
              </span>
              <span
                className="text-xs text-muted-foreground"
                title={format(new Date(comment.created_at), 'PPpp', {
                  locale: sv,
                })}
              >
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: sv,
                })}
              </span>
              {comment.edited_at && (
                <span className="text-xs text-muted-foreground">
                  (Redigerad)
                </span>
              )}
            </div>

            {isOwnComment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Redigera
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Radera
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Radera kommentar?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Är du säker på att du vill radera denna kommentar?
                          Detta kan inte ångras och eventuella svar kommer också
                          att raderas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Radera
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Spara
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false)
                    setEditContent(comment.content)
                  }}
                  disabled={isSaving}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          )}

          {canReply && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsReplying(!isReplying)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Svara
            </Button>
          )}
        </div>
      </div>

      {isReplying && (
        <div className="ml-11">
          <CommentInput
            parentCommentId={comment.id}
            placeholder="Skriv ett svar..."
            onSubmit={onSubmit}
            onSuccess={handleReplySuccess}
            onCancel={() => setIsReplying(false)}
            focusOnMount
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onSubmit={onSubmit}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onRefresh={onRefresh}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
