/**
 * Emulator mode is easy to leave switched on by accident, and the failure it
 * causes in a real deployment (nothing loads, sign-in times out) gives no hint
 * why. This makes it obvious.
 */
export default function EmulatorBanner() {
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR !== "1") return null;
  return (
    <p className="no-print bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
      Local emulator — this data is not real. Remove NEXT_PUBLIC_FIREBASE_EMULATOR to go live.
    </p>
  );
}
