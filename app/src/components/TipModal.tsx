import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, CreditCard, ArrowRight, CheckCircle, Loader } from 'lucide-react';
import { useConnections } from '../stores/root-store';
import type { MobileMoneyRail } from '../types/lotspace';

interface TipModalProps {
  farmerSpaceId: string;
  farmerName: string;
  farmerLocation: string;
  onClose: () => void;
}

const PRESET_AMOUNTS_CENTS = [100, 500, 1000, 2500]; // $1, $5, $10, $25

const RAILS: { id: MobileMoneyRail; label: string; region: string; icon: React.ReactNode }[] = [
  { id: 'momo', label: 'MoMo', region: 'Vietnam', icon: <Smartphone size={14} /> },
  { id: 'zalopay', label: 'ZaloPay', region: 'Vietnam', icon: <Smartphone size={14} /> },
  { id: 'mpesa', label: 'M-Pesa', region: 'East Africa', icon: <Smartphone size={14} /> },
  { id: 'telebirr', label: 'Telebirr', region: 'Ethiopia', icon: <Smartphone size={14} /> },
  { id: 'card', label: 'Card', region: 'Global', icon: <CreditCard size={14} /> },
];

const PLATFORM_FEE_RATE = 0.05;
const MIN_FEE_CENTS = 10;

function calcFee(grossCents: number): number {
  return Math.max(MIN_FEE_CENTS, Math.round(grossCents * PLATFORM_FEE_RATE));
}

export const TipModal: React.FC<TipModalProps> = ({
  farmerSpaceId,
  farmerName,
  farmerLocation,
  onClose,
}) => {
  const { sendTip } = useConnections();
  const [selectedAmountCents, setSelectedAmountCents] = useState(500);
  const [customAmountStr, setCustomAmountStr] = useState('');
  const [selectedRail, setSelectedRail] = useState<MobileMoneyRail>('card');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const grossCents = customAmountStr
    ? Math.round(parseFloat(customAmountStr) * 100)
    : selectedAmountCents;
  const isValidAmount = grossCents >= 100 && grossCents <= 10000;
  const feeCents = isValidAmount ? calcFee(grossCents) : 0;
  const netCents = grossCents - feeCents;

  const handleSend = () => {
    if (!isValidAmount || status !== 'idle') return;
    setStatus('sending');
    sendTip({
      fromSpaceId: 'consumer_guest',
      fromName: 'You',
      toFarmerSpaceId: farmerSpaceId,
      toFarmerName: farmerName,
      grossAmountCents: grossCents,
      rail: selectedRail,
      message: message.trim() || undefined,
    });
    setTimeout(() => {
      setStatus('sent');
      setTimeout(onClose, 2000);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="tip-backdrop"
        className="fixed inset-0 z-modal bg-navy-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="tip-panel"
          className="bg-surface rounded-xl border border-border shadow-e5 w-full max-w-md p-6 space-y-5"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold text-ink">☕ Tip the Farmer</h2>
              <p className="text-xs text-muted font-sans mt-0.5">
                <span className="font-semibold text-ink">{farmerName}</span> · {farmerLocation}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-ink rounded-md hover:bg-recessed transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {status === 'sent' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle size={40} className="text-leaf" />
              <div>
                <p className="font-display font-semibold text-ink text-lg">Tip sent!</p>
                <p className="text-xs text-muted mt-1">
                  ${(netCents / 100).toFixed(2)} is on its way to {farmerName}.
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Amount presets */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted tracking-widest uppercase">Amount</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS_CENTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setSelectedAmountCents(amt); setCustomAmountStr(''); }}
                      className={`py-2 rounded-md text-sm font-mono font-semibold border transition-all duration-fast ${
                        selectedAmountCents === amt && !customAmountStr
                          ? 'bg-teal text-white border-teal shadow-e1'
                          : 'bg-recessed text-ink border-border hover:border-teal/40'
                      }`}
                    >
                      ${(amt / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Custom amount (USD)"
                  value={customAmountStr}
                  onChange={(e) => { setCustomAmountStr(e.target.value); }}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono bg-canvas focus:outline-none focus:border-teal text-ink placeholder:text-subtle"
                />
              </div>

              {/* Rail selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted tracking-widest uppercase">Payment Rail</label>
                <div className="flex flex-wrap gap-2">
                  {RAILS.map((rail) => (
                    <button
                      key={rail.id}
                      onClick={() => setSelectedRail(rail.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono font-semibold transition-all duration-fast ${
                        selectedRail === rail.id
                          ? 'bg-navy text-parchment-50 border-navy'
                          : 'bg-recessed text-ink border-border hover:border-navy/40'
                      }`}
                    >
                      {rail.icon}
                      <span>{rail.label}</span>
                      <span className="opacity-50 text-[9px]">{rail.region}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional message */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted tracking-widest uppercase">Message (optional)</label>
                <input
                  type="text"
                  placeholder="Your coffee changed how I think about coffee."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={120}
                  className="w-full px-3 py-2 border border-border rounded-md text-xs font-sans bg-canvas focus:outline-none focus:border-teal text-ink placeholder:text-subtle"
                />
              </div>

              {/* Fee breakdown */}
              {isValidAmount && (
                <div className="bg-recessed rounded-md px-3 py-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-muted">
                    <span>Gross tip</span>
                    <span>${(grossCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Platform fee (5%)</span>
                    <span>−${(feeCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-ink border-t border-border pt-1.5">
                    <span>Net to {farmerName}</span>
                    <span className="text-leaf">${(netCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!isValidAmount || status !== 'idle'}
                className="w-full flex items-center justify-center gap-2 bg-navy text-parchment-50 font-semibold text-sm py-3 rounded-lg hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-fast shadow-e1"
              >
                {status === 'sending' ? (
                  <><Loader size={16} className="animate-spin" /> Sending…</>
                ) : (
                  <>Send Tip <ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-[10px] text-subtle font-mono text-center">
                Tips are settled via your chosen payment rail. No advertising data collected.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
