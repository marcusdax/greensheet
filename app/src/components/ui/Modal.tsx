import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnScrimClick?: boolean;
}

const sizeClass = (size?: 'sm' | 'md' | 'lg' | 'xl') => {
  switch (size) {
    case 'sm': return 'max-w-sm';
    case 'lg': return 'max-w-2xl';
    case 'xl': return 'max-w-4xl';
    default: return 'max-w-md';
  }
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnScrimClick = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
      <div
        className="absolute inset-0 bg-navy-900/50 backdrop-blur-xs"
        onClick={closeOnScrimClick ? onClose : undefined}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          className={`pointer-events-auto w-full ${sizeClass(size)} bg-surface rounded-lg shadow-e4 border border-border flex flex-col max-h-[90vh]`}
        >
          {title && (
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 id="modal-title" className="text-lg font-display font-medium text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5">
            {children}
          </div>
          {footer && (
            <div className="px-5 py-4 border-t border-border bg-recessed/30 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
