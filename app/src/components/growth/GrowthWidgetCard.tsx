import React from 'react';

export interface GrowthWidgetCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const GrowthWidgetCard: React.FC<GrowthWidgetCardProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
      <div className="border-b border-border pb-3 space-y-1">
        <h3 className="overline text-xs text-muted font-bold">{title}</h3>
        {description && (
          <p className="text-sm text-muted font-sans">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
};
