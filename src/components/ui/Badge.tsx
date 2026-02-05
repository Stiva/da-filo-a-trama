'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'yellow' | 'green' | 'outline' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Badge({
  children,
  variant = 'blue',
  size = 'md',
  className = '',
}: BadgeProps) {
  const variantClasses = {
    blue: 'bg-agesci-blue/10 text-agesci-blue',
    yellow: 'bg-agesci-yellow text-agesci-blue',
    green: 'bg-lc-green/10 text-lc-green-dark',
    outline: 'border-2 border-agesci-blue text-agesci-blue bg-transparent',
    gray: 'bg-gray-100 text-gray-600',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
