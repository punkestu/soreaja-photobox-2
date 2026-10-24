import React, { useState } from 'react';
import { usePhotobox } from '../../context/PhotoboxContext';

interface ResetAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetAllDataModal: React.FC<ResetAllDataModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t, language, resetAllData } = usePhotobox();
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsResetting(true);
    setErrorMsg(null);
    try {
      await resetAllData();
      setIsResetting(false);
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Reset all data error:', err);
      setIsResetting(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : language === 'en'
          ? 'Failed to reset data. Please try again.'
          : 'Gagal mereset data. Silakan coba kembali.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning accent */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 sm:p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-sm">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="reset-modal-title"
              className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight"
            >
              {t.admin.resetAllDataModalTitle}
            </h3>
            <p className="text-xs sm:text-sm text-rose-800 font-medium mt-1">
              {t.admin.resetAllDataModalWarning}
            </p>
          </div>
        </div>

        {/* Content list */}
        <div className="p-5 sm:p-6 space-y-4">
          <ul className="space-y-2.5 text-xs sm:text-sm text-neutral-700">
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500 font-bold shrink-0">✕</span>
              <span>{t.admin.resetAllDataModalItem1}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500 font-bold shrink-0">✕</span>
              <span>{t.admin.resetAllDataModalItem2}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500 font-bold shrink-0">✕</span>
              <span>{t.admin.resetAllDataModalItem3}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500 font-bold shrink-0">✕</span>
              <span>{t.admin.resetAllDataModalItem4}</span>
            </li>
          </ul>

          <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-600 font-mono-tabular leading-relaxed">
            {language === 'en'
              ? '💡 Note: This is recommended when setting up for a brand new event or clearing past customer session archives.'
              : '💡 Catatan: Disarankan saat persiapan booth untuk event baru atau membersihkan riwayat sesi tamu sebelumnya.'}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F4F4F0] border-t border-neutral-200 p-4 sm:p-5 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isResetting}
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {t.admin.resetAllDataCancelBtn}
          </button>

          <button
            type="button"
            disabled={isResetting}
            onClick={handleConfirm}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isResetting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
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
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>{language === 'en' ? 'Resetting...' : 'Mereset...'}</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>{t.admin.resetAllDataConfirmBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
