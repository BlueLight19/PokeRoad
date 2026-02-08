import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: size === 'sm' ? '10px' : size === 'lg' ? '14px' : '12px',
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '14px 24px' : '10px 18px',
    transition: 'all 0.15s ease',
    opacity: disabled ? 0.5 : 1,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, #4CAF50, #388E3C)',
      color: '#fff',
      boxShadow: '0 3px 0 #2E7D32, 0 4px 8px rgba(0,0,0,0.3)',
    },
    secondary: {
      background: 'linear-gradient(180deg, #2196F3, #1976D2)',
      color: '#fff',
      boxShadow: '0 3px 0 #1565C0, 0 4px 8px rgba(0,0,0,0.3)',
    },
    danger: {
      background: 'linear-gradient(180deg, #f44336, #d32f2f)',
      color: '#fff',
      boxShadow: '0 3px 0 #c62828, 0 4px 8px rgba(0,0,0,0.3)',
    },
    ghost: {
      background: 'transparent',
      color: '#ddd',
      border: '2px solid #555',
      boxShadow: 'none',
    },
  };

  return (
    <button
      style={{ ...baseStyle, ...variantStyles[variant] }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
