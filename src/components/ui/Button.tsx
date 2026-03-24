import React from 'react';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

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
    borderRadius: `${theme.radius.md}px`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: theme.font.family,
    fontSize: size === 'sm' ? theme.font.md : size === 'lg' ? theme.font.xxl : theme.font.xl,
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '14px 24px' : '10px 18px',
    transition: 'all 0.15s ease',
    opacity: disabled ? 0.5 : 1,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${theme.spacing.sm}px`,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(180deg, ${theme.colors.success}, ${theme.colors.successDark})`,
      color: theme.colors.textPrimary,
      boxShadow: theme.shadows.button3d(theme.colors.successDarker),
    },
    secondary: {
      background: `linear-gradient(180deg, ${theme.colors.info}, ${theme.colors.infoDark})`,
      color: theme.colors.textPrimary,
      boxShadow: theme.shadows.button3d(theme.colors.infoDarker),
    },
    danger: {
      background: `linear-gradient(180deg, ${theme.colors.danger}, ${theme.colors.dangerDark})`,
      color: theme.colors.textPrimary,
      boxShadow: theme.shadows.button3d(theme.colors.dangerDarker),
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.textSecondary,
      border: theme.borders.medium(theme.colors.borderMid),
      boxShadow: 'none',
    },
  };

  return (
    <button
      {...props}
      style={{ ...baseStyle, ...variantStyles[variant], ...(props.style || {}) }}
      disabled={disabled}
      onClick={(e) => {
        if (!disabled) soundManager.playClick();
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
