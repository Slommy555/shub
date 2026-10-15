import type { ButtonHTMLAttributes } from 'react'

type Variant = 'gold' | 'ghost' | 'outline' | 'danger' | 'text'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
}

const variants: Record<Variant, string> = {
  gold: 'bg-gold text-bg font-semibold hover:brightness-110 active:brightness-95',
  ghost: 'bg-subtle text-ink border border-line hover:border-[#262626]',
  outline: 'bg-transparent text-gold border border-gold-border hover:bg-gold-dim',
  danger: 'bg-transparent text-danger border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.08)]',
  text: 'bg-transparent text-gold hover:brightness-110',
}

const sizes = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-4 text-[14px]',
  lg: 'h-[52px] px-5 text-[15px]',
}

export function Button({ variant = 'gold', size = 'md', full, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-btn font-sans tracking-wide transition-[filter,background-color,border-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    />
  )
}
