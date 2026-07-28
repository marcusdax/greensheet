import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  info?: React.ReactNode;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  pageSize,
  onPageSizeChange,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  info,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) => {
  return (
    <div className={`px-4 py-3 bg-recessed/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-muted ${className}`}>
      {info && <span className="font-sans">{info}</span>}
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Page size"
            className="px-2 py-1 border border-border-interactive rounded-md bg-surface text-ink text-xs focus:border-teal font-sans"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="flex items-center gap-1 px-2.5 py-1 border border-border-interactive rounded-md bg-surface text-ink hover:bg-hover/20 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span className="font-sans">Prev</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="flex items-center gap-1 px-2.5 py-1 border border-border-interactive rounded-md bg-surface text-ink hover:bg-hover/20 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <span className="font-sans">Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
