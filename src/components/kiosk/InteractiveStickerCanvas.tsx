import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { PlacedSticker } from '../../types/photobox';

interface InteractiveStickerCanvasProps {
  stickers: PlacedSticker[];
  onStickersChange: (stickers: PlacedSticker[]) => void;
  selectedStickerId: string | null;
  onSelectSticker: (id: string | null) => void;
  themeColor?: string;
  isInteractive?: boolean;
}

interface DragState {
  type: 'move' | 'transform';
  stickerId: string;
  startX: number;
  startY: number;
  initialStickerX: number;
  initialStickerY: number;
  initialScale: number;
  initialRotation: number;
  centerX: number;
  centerY: number;
  initialDist: number;
  initialAngle: number;
}

export const InteractiveStickerCanvas: React.FC<InteractiveStickerCanvasProps> = ({
  stickers,
  onStickersChange,
  selectedStickerId,
  onSelectSticker,
  themeColor = '#E11D48',
  isInteractive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [activeTouchCount, setActiveTouchCount] = useState<number>(0);
  const touchPinchRef = useRef<{ initialDist: number; initialAngle: number; initialScale: number; initialRot: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(360);

  // Synchronize on-screen rendered canvas width for exact 1:1 sticker sizing with compositor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Deselect when clicking empty space
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement) === containerRef.current) {
      onSelectSticker(null);
    }
  };

  // Start dragging / moving a sticker
  const handleStickerPointerDown = (e: React.PointerEvent, sticker: PlacedSticker) => {
    if (!isInteractive) return;
    e.stopPropagation();
    onSelectSticker(sticker.id);

    // Bring active sticker to top of rendering order so it always appears above others
    if (stickers[stickers.length - 1]?.id !== sticker.id) {
      const rest = stickers.filter((s) => s.id !== sticker.id);
      onStickersChange([...rest, sticker]);
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    dragStateRef.current = {
      type: 'move',
      stickerId: sticker.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStickerX: sticker.x,
      initialStickerY: sticker.y,
      initialScale: sticker.scale || 1.0,
      initialRotation: sticker.rotation || 0,
      centerX: rect.left + sticker.x * rect.width,
      centerY: rect.top + sticker.y * rect.height,
      initialDist: 0,
      initialAngle: 0,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Start transform (scale & rotate) from corner handle
  const handleTransformHandlePointerDown = (e: React.PointerEvent, sticker: PlacedSticker) => {
    if (!isInteractive) return;
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + sticker.x * rect.width;
    const centerY = rect.top + sticker.y * rect.height;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    dragStateRef.current = {
      type: 'transform',
      stickerId: sticker.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStickerX: sticker.x,
      initialStickerY: sticker.y,
      initialScale: sticker.scale || 1.0,
      initialRotation: sticker.rotation || 0,
      centerX,
      centerY,
      initialDist: dist > 5 ? dist : 40,
      initialAngle: angle,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Move or Transform
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !isInteractive) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (state.type === 'move') {
        const deltaX = (e.clientX - state.startX) / rect.width;
        const deltaY = (e.clientY - state.startY) / rect.height;

        // Allow graceful overflow so stickers can be placed on or beyond edges
        const newX = Math.max(-0.25, Math.min(1.25, state.initialStickerX + deltaX));
        const newY = Math.max(-0.25, Math.min(1.25, state.initialStickerY + deltaY));

        onStickersChange(
          stickers.map((s) => (s.id === state.stickerId ? { ...s, x: newX, y: newY } : s))
        );
      } else if (state.type === 'transform') {
        const dx = e.clientX - state.centerX;
        const dy = e.clientY - state.centerY;
        const currentDist = Math.hypot(dx, dy);
        const currentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

        const scaleFactor = currentDist / state.initialDist;
        const newScale = Math.max(0.4, Math.min(2.5, Number((state.initialScale * scaleFactor).toFixed(2))));

        const angleDelta = currentAngle - state.initialAngle;
        let newRot = Math.round(state.initialRotation + angleDelta);
        while (newRot > 180) newRot -= 360;
        while (newRot < -180) newRot += 360;

        onStickersChange(
          stickers.map((s) =>
            s.id === state.stickerId ? { ...s, scale: newScale, rotation: newRot } : s
          )
        );
      }
    },
    [isInteractive, onStickersChange, stickers]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture errors
    }
    dragStateRef.current = null;
  };

  // Two-finger pinch to scale & twist on touchscreens
  const handleTouchStart = (e: React.TouchEvent) => {
    setActiveTouchCount(e.touches.length);
    if (e.touches.length === 2 && selectedStickerId) {
      const s = stickers.find((item) => item.id === selectedStickerId);
      if (!s) return;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;
      touchPinchRef.current = {
        initialDist: dist > 10 ? dist : 50,
        initialAngle: angle,
        initialScale: s.scale || 1.0,
        initialRot: s.rotation || 0,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && selectedStickerId && touchPinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const currentAngle =
        (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;

      const scaleRatio = currentDist / touchPinchRef.current.initialDist;
      const newScale = Math.max(
        0.4,
        Math.min(2.5, Number((touchPinchRef.current.initialScale * scaleRatio).toFixed(2)))
      );
      const rotDelta = currentAngle - touchPinchRef.current.initialAngle;
      let newRot = Math.round(touchPinchRef.current.initialRot + rotDelta);
      while (newRot > 180) newRot -= 360;
      while (newRot < -180) newRot += 360;

      onStickersChange(
        stickers.map((s) =>
          s.id === selectedStickerId ? { ...s, scale: newScale, rotation: newRot } : s
        )
      );
    }
  };

  const handleTouchEnd = () => {
    touchPinchRef.current = null;
    setActiveTouchCount(0);
  };

  // Helper actions for active sticker
  const handleDeleteSticker = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onStickersChange(stickers.filter((s) => s.id !== id));
    if (selectedStickerId === id) {
      onSelectSticker(null);
    }
  };

  const handleRotateStep = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onStickersChange(
      stickers.map((s) => {
        if (s.id !== id) return s;
        let rot = (s.rotation || 0) + delta;
        while (rot > 180) rot -= 360;
        while (rot < -180) rot += 360;
        return { ...s, rotation: rot };
      })
    );
  };

  const handleScaleStep = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onStickersChange(
      stickers.map((s) => {
        if (s.id !== id) return s;
        const scale = Math.max(0.4, Math.min(2.5, Number(((s.scale || 1.0) + delta).toFixed(2))));
        return { ...s, scale };
      })
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 w-full h-full overflow-visible z-40 select-none pointer-events-none"
    >
      {stickers.map((sticker) => {
        const isSelected = selectedStickerId === sticker.id;
        const leftPercent = `${sticker.x * 100}%`;
        const topPercent = `${sticker.y * 100}%`;
        const scale = sticker.scale || 1.0;
        const rotation = sticker.rotation || 0;
        const isNearBottom = sticker.y > 0.8;
        const toolbarPositionClass = isNearBottom ? '-top-14' : '-bottom-14';

        // Proportional baseSize matching canvas compositor (15% of width at scale 1.0)
        const baseSize = (containerWidth || 360) * 0.15;
        const stickerPixelSize = baseSize * scale;
        const badgeFontSize = Math.round(stickerPixelSize * 0.32);
        const badgePadX = Math.round(badgeFontSize * 0.85);
        const badgePadY = Math.round(badgeFontSize * 0.45);
        const badgeRadius = Math.round(stickerPixelSize * 0.12);
        const badgeBorderW = Math.max(2, Math.round(stickerPixelSize * 0.04));

        return (
          <div
            key={sticker.id}
            data-sticker-item="true"
            onPointerDown={(e) => handleStickerPointerDown(e, sticker)}
            style={{
              left: leftPercent,
              top: topPercent,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            className={`absolute flex items-center justify-center cursor-move transition-shadow duration-150 pointer-events-auto ${
              isSelected ? 'z-50' : 'z-30'
            }`}
          >
            {/* Sticker Graphic Content */}
            {sticker.type === 'emoji' ? (
              <span
                style={{
                  fontSize: `${Math.round(stickerPixelSize)}px`,
                  lineHeight: 1,
                }}
                className="select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.65)] pointer-events-none block"
              >
                {sticker.content}
              </span>
            ) : (
              <div
                style={{
                  backgroundColor: themeColor,
                  fontSize: `${badgeFontSize}px`,
                  padding: `${badgePadY}px ${badgePadX}px`,
                  borderRadius: `${badgeRadius}px`,
                  borderWidth: `${badgeBorderW}px`,
                  borderColor: '#FFFFFF',
                  lineHeight: 1.2,
                }}
                className="text-white font-extrabold tracking-wider uppercase shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none whitespace-nowrap pointer-events-none"
              >
                {sticker.content}
              </div>
            )}

            {/* Selected Control Frame & Handles */}
            {isSelected && isInteractive && (
              <>
                {/* Dashed Selection Bounding Box */}
                <div className="absolute -inset-2.5 rounded-xl border-2 border-dashed border-white/90 shadow-[0_0_12px_rgba(225,29,72,0.8)] pointer-events-none z-10" />

                {/* Top-Right Delete Handle */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteSticker(sticker.id, e)}
                  aria-label="Delete sticker"
                  className="absolute -top-4 -right-4 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white cursor-pointer active:scale-90 pointer-events-auto transition-transform z-50"
                >
                  ✕
                </button>

                {/* Bottom-Right Scale/Rotate Handle */}
                <div
                  onPointerDown={(e) => handleTransformHandlePointerDown(e, sticker)}
                  aria-label="Transform handle"
                  title="Drag to resize and rotate"
                  className="absolute -bottom-4 -right-4 w-7 h-7 rounded-full bg-white text-zinc-900 hover:bg-zinc-100 flex items-center justify-center text-xs font-black shadow-lg border-2 border-zinc-900 cursor-nwse-resize active:scale-95 pointer-events-auto z-50"
                >
                  ⤢
                </div>

                {/* Mini Quick Touch Floating Toolbar */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute ${toolbarPositionClass} left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-950/95 px-2 py-1 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/20 backdrop-blur-md pointer-events-auto whitespace-nowrap z-50`}
                >
                  <button
                    type="button"
                    onClick={(e) => handleScaleStep(sticker.id, 0.15, e)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-700 active:scale-90"
                    title="Scale Up"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleScaleStep(sticker.id, -0.15, e)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-700 active:scale-90"
                    title="Scale Down"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRotateStep(sticker.id, 45, e)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-white text-[11px] font-bold hover:bg-zinc-700 active:scale-90"
                    title="Rotate 45°"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSticker(sticker.id, e)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-700 text-white text-xs font-bold hover:bg-rose-600 active:scale-90"
                    title="Delete"
                  >
                    🗑️
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSticker(null);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 active:scale-90"
                    title="Done"
                  >
                    ✓
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
