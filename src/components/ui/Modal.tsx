import React from 'react';
import { theme } from '../../theme';

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: theme.colors.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.colors.panelBg,
          border: theme.borders.thick(theme.colors.primary),
          borderRadius: `${theme.radius.lg}px`,
          padding: `${theme.spacing.xl}px`,
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          style={{
            color: theme.colors.primary,
            fontSize: theme.font.xxl,
            fontFamily: theme.font.family,
            marginBottom: `${theme.spacing.lg}px`,
            textAlign: 'center',
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
