import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface CropBox {
  x: number;      // 0 to 1 (left offset percentage)
  y: number;      // 0 to 1 (top offset percentage)
  width: number;  // 0 to 1 (width percentage)
  height: number; // 0 to 1 (height percentage)
}

interface CropFrameOverlayProps {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  cropBox: CropBox;
  onChange: (newBox: CropBox) => void;
  containerWidth: number;
  containerHeight: number;
}

export const CropFrameOverlay: React.FC<CropFrameOverlayProps> = ({
  aspectRatio,
  cropBox,
  onChange,
  containerWidth,
  containerHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; boxX: number; boxY: number } | null>(null);

  // Active handle for resizing in custom mode
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    mouseX: number;
    mouseY: number;
    initialBox: CropBox;
  } | null>(null);

  // Update box when aspect ratio changes if needed
  useEffect(() => {
    if (aspectRatio === '16:9') {
      onChange({ x: 0, y: 0, width: 1, height: 1 });
      return;
    }

    let targetRatio = 1;
    if (aspectRatio === '9:16') targetRatio = 9 / 16;
    else if (aspectRatio === '1:1') targetRatio = 1;
    else if (aspectRatio === '4:5') targetRatio = 4 / 5;

    if (aspectRatio !== 'custom' && containerWidth > 0 && containerHeight > 0) {
      // Calculate normalized width and height preserving video canvas aspect
      const containerAspect = containerWidth / containerHeight;
      let w = 1;
      let h = 1;

      if (targetRatio < containerAspect) {
        // Narrower than container (e.g. 9:16 in 16:9 container)
        h = 1;
        w = Math.min(1, (targetRatio / containerAspect));
      } else {
        w = 1;
        h = Math.min(1, (containerAspect / targetRatio));
      }

      // Clamp current X and Y with new dimensions
      const newX = Math.max(0, Math.min(cropBox.x, 1 - w));
      const newY = Math.max(0, Math.min(cropBox.y, 1 - h));
      onChange({ x: newX, y: newY, width: w, height: h });
    }
  }, [aspectRatio, containerWidth, containerHeight]);

  const handleMouseDownBox = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
    });
  };

  const handleMouseDownHandle = (handle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialBox: { ...cropBox },
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && dragStart && containerWidth > 0 && containerHeight > 0) {
      const deltaX = (e.clientX - dragStart.mouseX) / containerWidth;
      const deltaY = (e.clientY - dragStart.mouseY) / containerHeight;

      const newX = Math.max(0, Math.min(1 - cropBox.width, dragStart.boxX + deltaX));
      const newY = Math.max(0, Math.min(1 - cropBox.height, dragStart.boxY + deltaY));

      onChange({
        ...cropBox,
        x: newX,
        y: newY,
      });
    } else if (activeHandle && resizeStart && containerWidth > 0 && containerHeight > 0) {
      const deltaX = (e.clientX - resizeStart.mouseX) / containerWidth;
      const deltaY = (e.clientY - resizeStart.mouseY) / containerHeight;
      const init = resizeStart.initialBox;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      const minSize = 0.15; // Minimum 15% size

      if (activeHandle.includes('right')) {
        newW = Math.max(minSize, Math.min(1 - init.x, init.width + deltaX));
      }
      if (activeHandle.includes('left')) {
        const potentialW = init.width - deltaX;
        if (potentialW >= minSize && init.x + deltaX >= 0) {
          newX = init.x + deltaX;
          newW = potentialW;
        }
      }
      if (activeHandle.includes('bottom')) {
        newH = Math.max(minSize, Math.min(1 - init.y, init.height + deltaY));
      }
      if (activeHandle.includes('top')) {
        const potentialH = init.height - deltaY;
        if (potentialH >= minSize && init.y + deltaY >= 0) {
          newY = init.y + deltaY;
          newH = potentialH;
        }
      }

      onChange({
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        width: Math.min(1, newW),
        height: Math.min(1, newH),
      });
    }
  }, [isDragging, dragStart, activeHandle, resizeStart, cropBox, containerWidth, containerHeight, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setActiveHandle(null);
    setResizeStart(null);
  }, []);

  useEffect(() => {
    if (isDragging || activeHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, activeHandle, handleMouseMove, handleMouseUp]);

  if (aspectRatio === '16:9') {
    return null; // Full frame, no crop overlay needed
  }

  const leftPercent = cropBox.x * 100;
  const topPercent = cropBox.y * 100;
  const widthPercent = cropBox.width * 100;
  const heightPercent = cropBox.height * 100;

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 pointer-events-none z-20 select-none overflow-hidden"
    >
      {/* 4 Shaded Cutout Masks Around Active Crop Frame */}
      {/* Top Mask */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 right-0 top-0 bg-black/60 backdrop-blur-[1px] transition-[height] duration-75 pointer-events-auto cursor-default"
        style={{ height: `${topPercent}%` }}
      />
      {/* Bottom Mask */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 right-0 bottom-0 bg-black/60 backdrop-blur-[1px] transition-[height] duration-75 pointer-events-auto cursor-default"
        style={{ height: `${100 - (topPercent + heightPercent)}%` }}
      />
      {/* Left Mask */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 bg-black/60 backdrop-blur-[1px] transition-[width] duration-75 pointer-events-auto cursor-default"
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
          width: `${leftPercent}%`,
        }}
      />
      {/* Right Mask */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 bg-black/60 backdrop-blur-[1px] transition-[width] duration-75 pointer-events-auto cursor-default"
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
          width: `${100 - (leftPercent + widthPercent)}%`,
        }}
      />

      {/* Active Crop Box */}
      <div
        onMouseDown={handleMouseDownBox}
        className="absolute border-2 border-white shadow-[0_0_20px_rgba(0,0,0,0.9)] rounded-lg pointer-events-auto cursor-move flex items-center justify-center group"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
        }}
      >
        {/* Rule of Thirds Grid Lines (Subtle on hover/drag) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity">
          <div className="border-r border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div />
        </div>

        {/* Center Framing Label */}
        <div className="bg-black/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-[10px] font-extrabold text-white tracking-wider uppercase shadow-lg select-none pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
          <span>{aspectRatio.toUpperCase()}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400 text-[9px] font-mono">
            {Math.round(cropBox.x * 100)}%
          </span>
        </div>

        {/* Corner Guides */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl-sm pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr-sm pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl-sm pointer-events-none" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white rounded-br-sm pointer-events-none" />

        {/* Custom Resize Handles (Only in Custom Mode) */}
        {aspectRatio === 'custom' && (
          <>
            <div
              onMouseDown={(e) => handleMouseDownHandle('top-left', e)}
              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black rounded-full cursor-nwse-resize shadow pointer-events-auto"
            />
            <div
              onMouseDown={(e) => handleMouseDownHandle('top-right', e)}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black rounded-full cursor-nesw-resize shadow pointer-events-auto"
            />
            <div
              onMouseDown={(e) => handleMouseDownHandle('bottom-left', e)}
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black rounded-full cursor-nesw-resize shadow pointer-events-auto"
            />
            <div
              onMouseDown={(e) => handleMouseDownHandle('bottom-right', e)}
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black rounded-full cursor-nwse-resize shadow pointer-events-auto"
            />
          </>
        )}
      </div>
    </div>
  );
};
