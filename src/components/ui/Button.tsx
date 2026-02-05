'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary:
        'bg-agesci-yellow text-agesci-blue hover:shadow-playful hover:-translate-y-0.5 focus:ring-agesci-yellow active:translate-y-0',
      secondary:
        'bg-agesci-blue text-white hover:bg-agesci-blue-light hover:-translate-y-0.5 focus:ring-agesci-blue active:translate-y-0',
      outline:
        'border-2 border-agesci-blue text-agesci-blue bg-transparent hover:bg-agesci-blue hover:text-white focus:ring-agesci-blue',
      ghost:
        'text-agesci-blue bg-transparent hover:bg-agesci-blue/10 focus:ring-agesci-blue',
      accent:
        'bg-lc-green text-white hover:bg-lc-green-dark hover:-translate-y-0.5 focus:ring-lc-green active:translate-y-0',
      danger:
        'bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5 focus:ring-red-500 active:translate-y-0',
    };

    const sizeClasses = {
      sm: 'px-4 py-2 text-sm rounded-lg',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg rounded-2xl',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
