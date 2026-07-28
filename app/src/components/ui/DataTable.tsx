import React from 'react';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  rowClassName?: (row: T, index: number) => string | undefined;
  onRowClick?: (row: T, index: number) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'No data available.',
  className = '',
  tableClassName = '',
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const alignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'right': return 'text-right';
      case 'center': return 'text-center';
      default: return 'text-left';
    }
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={`w-full text-left text-sm font-sans border-collapse ${tableClassName}`}>
        <thead>
          <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 font-semibold uppercase tracking-wider ${alignClass(column.align)} ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-sans">
          {data.map((row, index) => {
            const rowClass = rowClassName?.(row, index);
            return (
              <tr
                key={keyExtractor(row, index)}
                onClick={() => onRowClick?.(row, index)}
                className={`hover:bg-hover/10 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClass || ''}`}
              >
                {columns.map((column) => {
                  const content = column.render
                    ? column.render(row, index)
                    : column.accessor
                      ? column.accessor(row)
                      : String((row as Record<string, unknown>)[column.key] ?? '');
                  return (
                    <td
                      key={column.key}
                      className={`px-4 py-3.5 ${alignClass(column.align)} ${column.className || ''}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted font-sans">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
