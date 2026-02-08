import React from 'react';

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
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e',
          border: '3px solid #e94560',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          style={{
            color: '#e94560',
            fontSize: '14px',
            fontFamily: "'Press Start 2P', monospace",
            marginBottom: '16px',
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
