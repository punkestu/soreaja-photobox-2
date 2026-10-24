import React, { memo } from 'react';

export interface CropInfo {
  isCropped: boolean;
  type: 'sides' | 'topBottom' | 'none';
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  croppedSidePercent: number;
  slotAspect: number;
  cameraAspect: number;
  label: string;
}

interface CropGuideOverlayProps {
  showCropGuide: boolean;
  showGridLines: boolean;
  cropInfo: CropInfo;
}

export const CropGuideOverlay: React.FC<CropGuideOverlayProps> = memo(({
  showCropGuide,
  showGridLines,
  cropInfo,
}) => {
  return (
    <>
      {showCropGuide && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Left & Right Cropped Area Dark Masks */}
          {cropInfo.type === 'sides' && (
            <>
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] flex flex-col items-center justify-center border-r-2 border-dashed border-red-500/85 shadow-inner"
                style={{ width: `${cropInfo.leftPercent}%` }}
              >
                <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                  ✂ Terpotong
                </div>
              </div>
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] flex flex-col items-center justify-center border-l-2 border-dashed border-red-500/85 shadow-inner"
                style={{ width: `${cropInfo.leftPercent}%` }}
              >
                <div className="rotate-90 whitespace-nowrap text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                  ✂ Terpotong
                </div>
              </div>
            </>
          )}

          {/* Top & Bottom Cropped Area Dark Masks */}
          {cropInfo.type === 'topBottom' && (
            <>
              <div
                className="absolute top-0 left-0 right-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center border-b-2 border-dashed border-red-500/85 shadow-inner"
                style={{ height: `${cropInfo.topPercent}%` }}
              >
                <span className="text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                  ✂ Area Terpotong Bingkai
                </span>
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center border-t-2 border-dashed border-red-500/85 shadow-inner"
                style={{ height: `${cropInfo.topPercent}%` }}
              >
                <span className="text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                  ✂ Area Terpotong Bingkai
                </span>
              </div>
            </>
          )}

          {/* Active Photo Framing Boundary */}
          <div
            className={`absolute transition-all duration-200 ${
              cropInfo.isCropped
                ? 'border-2 border-[var(--theme-accent,#E11D48)] shadow-[0_0_24px_rgba(225,29,72,0.45)]'
                : 'border-2 border-white/50'
            }`}
            style={{
              left: `${cropInfo.leftPercent}%`,
              top: `${cropInfo.topPercent}%`,
              width: `${cropInfo.widthPercent}%`,
              height: `${cropInfo.heightPercent}%`,
            }}
          >
            {/* Studio Viewfinder Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-[3px] border-l-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-[3px] border-r-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-[3px] border-l-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-[3px] border-r-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />

            {/* Center Crosshair Alignment Mark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-8 h-8 opacity-40">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white -translate-x-1/2" />
                <div className="absolute inset-1.5 border border-white rounded-full" />
              </div>
            </div>

            {/* Rule-of-Thirds Grid inside the Active Crop Area */}
            {showGridLines && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            )}
          </div>
        </div>
      )}

      {!showCropGuide && showGridLines && (
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 z-10">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-white" />
          <div className="border-r border-white" />
          <div />
        </div>
      )}
    </>
  );
});
