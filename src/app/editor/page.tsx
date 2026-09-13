import { Suspense } from "react";
import EditorScreen from "./EditorScreen";

export default function EditorPage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-16 text-center text-sm text-muted">Loading…</p>}
    >
      <EditorScreen />
    </Suspense>
  );
}
