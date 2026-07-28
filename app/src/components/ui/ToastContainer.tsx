import React from 'react';
import { useUi } from '../../stores/root-store';

export const ToastContainer: React.FC = () => {
  const ui = useUi();
  return (
    <div className="fixed bottom-4 right-4 z-max space-y-2">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-md shadow-e3 text-sm font-sans text-white ${t.kind === 'error' ? 'bg-danger' : t.kind === 'success' ? 'bg-leaf' : 'bg-navy'}`}>
          <div className="flex items-center gap-2">
            <span>{t.message}</span>
            <button onClick={() => ui.dismissToast(t.id)} className="ml-2 opacity-70 hover:opacity-100">×</button>
          </div>
        </div>
      ))}
    </div>
  );
};
