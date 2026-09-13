"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { SHEET_WIDTH_PX } from "@/lib/print";

/**
 * Shrinks the fixed-width A4 sheet to fit narrow screens instead of letting it
 * reflow. What the phone shows is then exactly what comes out of the printer.
 * Printing ignores the transform entirely.
 */
export default function SheetScaler({
  children,
  onNaturalHeight,
}: {
  children: ReactNode;
  /** Unscaled height of the sheet, so the caller can work out the page count. */
  onNaturalHeight?: (height: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const frameEl = frame.current;
    const innerEl = inner.current;
    if (!frameEl || !innerEl) return undefined;

    const measure = () => {
      const next = Math.min(1, frameEl.clientWidth / SHEET_WIDTH_PX);
      const natural = innerEl.offsetHeight;
      setScale(next);
      setHeight(natural * next);
      onNaturalHeight?.(natural);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl);
    observer.observe(innerEl);
    return () => observer.disconnect();
  }, [onNaturalHeight]);

  return (
    <div ref={frame} className="w-full overflow-hidden print:overflow-visible">
      <div style={{ height }} className="print:!h-auto">
        <div
          ref={inner}
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_WIDTH_PX }}
          className="print:!w-full print:!transform-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
