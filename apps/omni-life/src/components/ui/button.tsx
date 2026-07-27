import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    // Uses the shared Le Studio primitives so this button matches every other
    // app's. `primary` is the ink accent, not the blue conversation accent:
    // the old blue fill converted to bg-speak, which is meant for conversation
    // UI rather than a primary action.
    const baseStyles = 'btn';

    const variantStyles = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      danger: 'bg-danger text-onaccent hover:brightness-90',
    };

    const sizeStyles = {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
