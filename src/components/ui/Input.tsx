import * as React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-lg bg-canvas border border-border-subtle px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent transition-colors disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 w-full rounded-lg bg-canvas border border-border-subtle px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent transition-colors disabled:opacity-50 cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
