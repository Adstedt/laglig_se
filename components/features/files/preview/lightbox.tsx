'use client'

/**
 * Story 6.7b: Full-screen Lightbox
 * AC: 17 (helskärm) - Full-screen image viewer with zoom
 */

import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'

// ============================================================================
// Types
// ============================================================================

interface LightboxSlide {
  src: string
  alt?: string
  title?: string
  description?: string
}

interface FileLightboxProps {
  open: boolean
  onClose: () => void
  slides: LightboxSlide[]
  index?: number
}

// ============================================================================
// File Lightbox Component
// ============================================================================

export function FileLightbox({
  open,
  onClose,
  slides,
  index = 0,
}: FileLightboxProps) {
  const isSingleSlide = slides.length <= 1

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom, Captions]}
      zoom={{
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      captions={{
        showToggle: true,
        descriptionTextAlign: 'center',
      }}
      carousel={{
        finite: isSingleSlide,
      }}
      {...(isSingleSlide && {
        render: {
          buttonPrev: () => null,
          buttonNext: () => null,
        },
      })}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
      }}
      labels={{
        Previous: 'Föregående',
        Next: 'Nästa',
        Close: 'Stäng',
        'Zoom in': 'Zooma in',
        'Zoom out': 'Zooma ut',
      }}
    />
  )
}

// ============================================================================
// Single Image Lightbox (convenience wrapper)
// ============================================================================

export function ImageLightbox({
  open,
  onClose,
  src,
  alt,
  title,
}: {
  open: boolean
  onClose: () => void
  src: string
  alt?: string
  title?: string
}) {
  // Build slide object without undefined values
  const slide: LightboxSlide = { src }
  if (alt) slide.alt = alt
  if (title) slide.title = title

  return <FileLightbox open={open} onClose={onClose} slides={[slide]} />
}
