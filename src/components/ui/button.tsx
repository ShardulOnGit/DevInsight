import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  const variants = {
    primary: "bg-brand hover:bg-brand-hover text-white border border-transparent shadow-sm",
    secondary: "bg-bg-elevated hover:bg-zinc-700 text-white border border-transparent",
    outline: "bg-transparent hover:bg-bg-elevated text-text-primary border border-border-strong",
    ghost: "bg-transparent hover:bg-bg-elevated text-text-secondary hover:text-white border border-transparent",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs w-auto",
    md: "h-10 px-4 py-2 text-sm w-auto",
    lg: "h-12 px-8 text-base w-auto",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
