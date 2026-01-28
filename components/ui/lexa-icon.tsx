import { cn } from '@/lib/utils'

interface LexaIconProps {
  className?: string
  size?: number
}

export function LexaIcon({ className, size = 16 }: LexaIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/lexa-icon.png"
      alt="Lexa"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain dark:invert-0 invert', className)}
    />
  )
}
