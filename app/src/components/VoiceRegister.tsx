import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MapPin, User, Phone } from 'lucide-react';

export interface VoiceRegisterProps {
  onRegister?: (data: { name: string; phone: string; region: string }) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SUPPORTED_REGIONS = [
  'VN-DKL',
  'VN-LDG',
  'VN-GLA',
  'ET-SNNP',
  'ET-ORO',
  'UG-BUG',
  'CO-HUI',
  'PE-JUN',
];

const regionLabels: Record<string, string> = {
  'VN-DKL': 'Vietnam — Da Lat (Highlands)',
  'VN-LDG': 'Vietnam — Lam Dong (Highlands)',
  'VN-GLA': 'Vietnam — Gia Lai (Central Highlands)',
  'ET-SNNP': 'Ethiopia — Sidama (SNNP)',
  'ET-ORO': 'Ethiopia — Oromia',
  'UG-BUG': 'Uganda — Bugisu',
  'CO-HUI': 'Colombia — Huila',
  'PE-JUN': 'Peru — Junín',
};

const formVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const VoiceRegister: React.FC<VoiceRegisterProps> = ({
  onRegister,
  isOpen = false,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState(SUPPORTED_REGIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      onRegister?.({ name: name.trim(), phone: phone.trim(), region });
      setName('');
      setPhone('');
      setRegion(SUPPORTED_REGIONS[0]);
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={backdropVariants}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            variants={formVariants}
            className="relative w-full max-w-md bg-canvas rounded-lg shadow-e4 border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Mic className="text-teal" size={18} />
                <h2 className="text-lg font-display font-medium text-ink">
                  Voice Register
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-teal"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans">
              {/* Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voice-name"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  <User size={12} />
                  <span>Name</span>
                </label>
                <input
                  id="voice-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Farmer or collector name"
                  className="w-full px-3 py-2 text-base text-ink bg-surface border border-border rounded-md placeholder-subtle focus:outline-none focus:border-teal font-sans"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voice-phone"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  <Phone size={12} />
                  <span>Phone</span>
                </label>
                <input
                  id="voice-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+25 7XX XXX XXX"
                  className="w-full px-3 py-2 text-base text-ink bg-surface border border-border rounded-md placeholder-subtle focus:outline-none focus:border-teal font-sans"
                  required
                />
              </div>

              {/* Region */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voice-region"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  <MapPin size={12} />
                  <span>Region</span>
                </label>
                <select
                  id="voice-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 text-base text-ink bg-surface border border-border rounded-md focus:outline-none focus:border-teal font-mono text-sm"
                >
                  {SUPPORTED_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {regionLabels[r] ?? r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monospace hint for voice-enabled region codes */}
              <div className="text-xs font-mono text-subtle bg-recessed/20 border border-border rounded-md px-3 py-2">
                Voice-enabled zones: {SUPPORTED_REGIONS.join(', ')}
              </div>

              {/* Error message placeholder */}
              <p className="text-xs text-danger font-sans min-h-[1.25rem]" role="alert">
                {!name && !phone ? '' : ''}
              </p>
            </form>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border bg-recessed/30 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-teal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !name.trim() || !phone.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-navy hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-e1 transition-colors focus-visible:ring-1 focus-visible:ring-teal"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-label="loading"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Registering…
                  </span>
                ) : (
                  <>
                    <Mic size={14} />
                    Register
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
