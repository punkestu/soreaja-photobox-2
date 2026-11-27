import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable kiosk confirmation dialog for destructive mid-session actions
 * such as Retake All or Reset Session.
 */
export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      aria-describedby="confirm-action-desc"
      data-testid="confirm-action-modal"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-[0_25px_65px_rgba(0,0,0,0.9)] flex flex-col items-center text-center space-y-4 relative"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label={cancelLabel}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent,#E11D48)]/15 border border-[var(--theme-accent,#E11D48)]/40 text-[var(--theme-accent,#E11D48)] flex items-center justify-center shadow-inner">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3
            id="confirm-action-title"
            className="font-display text-lg sm:text-xl font-extrabold text-[#F4F4F0]"
          >
            {title}
          </h3>
          <p
            id="confirm-action-desc"
            className="text-xs sm:text-sm text-zinc-300 leading-relaxed"
          >
            {message}
          </p>
        </div>

        <div className="w-full flex flex-col-reverse sm:flex-row items-stretch gap-2.5 pt-2">
          <button
            type="button"
            data-testid="confirm-action-cancel-btn"
            onClick={onCancel}
            className="flex-1 min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all cursor-pointer border border-zinc-700/80"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            data-testid="confirm-action-confirm-btn"
            onClick={onConfirm}
            className="flex-1 min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all cursor-pointer shadow-lg"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
