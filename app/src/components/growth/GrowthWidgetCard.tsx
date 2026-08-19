import React from 'react';

export interface GrowthWidgetCardProps {
  title: string;
  children: React.ReactNode;
}

export const GrowthWidgetCard: React.FC<GrowthWidgetCardProps> = ({
  title,
  children,
}) => {
  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="overline text-xs text-muted font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
};
