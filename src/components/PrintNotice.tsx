"use client";

import { useEffect, useState } from "react";

/**
 * iOS blocks window.print() in home-screen ("standalone") web apps — the call
 * returns silently and no print dialog appears. The same page prints fine in
 * Safari proper, so offer a way across.
 *
 * Detection runs in an effect rather than during render: the page is
 * pre-rendered at build time, where there is no navigator to ask.
 */
export default function PrintNotice() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isIOS = /iPad|iPhone|iPod/.test(nav.userAgent);
    const isStandalone =
      nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    setBlocked(isIOS && isStandalone);
  }, []);

  if (!blocked) return null;

  return (
    <div className="no-print rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <p className="font-semibold">Printing from the home-screen app is unreliable on iPhone.</p>
      <p className="mt-1">
        If nothing happens when you tap Print, open this page in Safari and print from there.
      </p>
      <button
        type="button"
        onClick={() => window.open(window.location.href, "_blank")}
        className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm font-semibold"
      >
        Open in Safari
      </button>
    </div>
  );
}
