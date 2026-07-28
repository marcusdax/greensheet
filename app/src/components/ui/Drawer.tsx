import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const widthClass = (size?: 'sm' | 'md' | 'lg' | 'xl' | 'full') => {
  switch (size) {
    case 'sm': return 'max-w-[320px]';
    case 'lg': return 'max-w-[560px]';
    case 'xl': return 'max-w-[720px]';
    case 'full': return 'max-w-full';
    default: return 'max-w-[480px]';
  }
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  position = 'right',
  size = 'md',
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

  const positionClass = position === 'left' ? 'left-0 border-r' : 'right-0 border-l';

  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-labelledby={title ? 'drawer-title' : undefined}>
      <div
        className="absolute inset-0 bg-navy-900/50 backdrop-blur-xs"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`absolute top-0 bottom-0 ${positionClass} ${position === 'left' ? '-translate-x-0' : 'translate-x-0'} w-full ${widthClass(size)} bg-surface shadow-e5 flex flex-col animate-slide-in`}
      >
        {title && (
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 id="drawer-title" className="text-lg font-display font-medium text-ink">
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
  );
};
