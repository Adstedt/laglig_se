/**
 * Optimized Image Component (Story P.2)
 * 
 * Wrapper around Next.js Image with lazy loading and WebP support.
 * Implements AC: 19-21 for static asset optimization.
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

'use client'

import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  containerClassName?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  quality?: number
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  fill?: boolean
  sizes?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

/**
 * Optimized image component with lazy loading and format optimization
 * Uses Next.js Image for automatic WebP/AVIF conversion
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  containerClassName,
  placeholder = 'empty',
  blurDataURL,
  quality = 75,
  loading = 'lazy',
  onLoad,
  fill = false,
  sizes,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isInView, setIsInView] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Implement IntersectionObserver for below-fold images
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        // Load images 50px before they enter viewport
        rootMargin: '50px',
        threshold: 0.01,
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [priority, loading])

  const handleLoad = () => {
    setHasLoaded(true)
    onLoad?.()
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        fill && 'h-full w-full',
        containerClassName
      )}
      style={!fill && width && height ? { width, height } : undefined}
    >
      {isInView ? (
        <>
          {/* Loading skeleton */}
          {!hasLoaded && (
            <div
              className={cn(
                'absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-800',
                className
              )}
            />
          )}
          
          {/* Optimized image */}
          {fill ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes={sizes || '100vw'}
              priority={priority}
              placeholder={placeholder}
              {...(blurDataURL && { blurDataURL })}
              quality={quality}
              className={cn(
                'transition-opacity duration-300',
                hasLoaded ? 'opacity-100' : 'opacity-0',
                className
              )}
              style={{ objectFit }}
              onLoad={handleLoad}
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              width={width!}
              height={height!}
              sizes={sizes}
              priority={priority}
              placeholder={placeholder}
              {...(blurDataURL && { blurDataURL })}
              quality={quality}
              className={cn(
                'transition-opacity duration-300',
                hasLoaded ? 'opacity-100' : 'opacity-0',
                className
              )}
              style={{ objectFit }}
              onLoad={handleLoad}
            />
          )}
        </>
      ) : (
        // Placeholder before image enters viewport
        <div
          className={cn(
            'animate-pulse bg-gray-200 dark:bg-gray-800',
            fill ? 'h-full w-full' : '',
            className
          )}
          style={!fill && width && height ? { width, height } : undefined}
        />
      )}
    </div>
  )
}

/**
 * Responsive image component with automatic srcset generation
 */
export function ResponsiveImage({
  src,
  alt,
  aspectRatio = '16/9',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  className,
  priority = false,
  quality = 75,
}: {
  src: string
  alt: string
  aspectRatio?: string
  sizes?: string
  className?: string
  priority?: boolean
  quality?: number
}) {
  return (
    <div 
      className={cn('relative w-full', className)}
      style={{ aspectRatio }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        className="object-cover"
      />
    </div>
  )
}

/**
 * Avatar image component with fallback
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  fallback,
  className,
}: {
  src?: string | null
  alt: string
  size?: number
  fallback?: string | React.ReactNode
  className?: string
}) {
  const [error, setError] = useState(false)

  if (!src || error) {
    if (typeof fallback === 'string') {
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800',
            className
          )}
          style={{ width: size, height: size }}
        >
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {fallback}
          </span>
        </div>
      )
    }
    return <>{fallback}</>
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      onError={() => setError(true)}
    />
  )
}