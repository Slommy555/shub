import type { HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean
}

export function Card({ accent, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-card border border-line bg-elevated ${accent ? 'gold-strip' : ''} ${className}`}
    />
  )
}
