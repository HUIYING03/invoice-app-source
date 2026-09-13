import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase is initialised lazily and only in the browser, so a missing or
 * half-filled .env.local fails with a clear message instead of a stack trace
 * from deep inside the SDK.
 *
 * These values are not secrets. A Firebase web config is meant to ship in the
 * client bundle; what actually protects the data is Firestore's security rules
 * plus signing in. See firestore.rules.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigError(): string | null {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
  if (missing.length === Object.keys(config).length) {
    return "Firebase is not set up yet. Copy .env.example to .env.local and fill in the values from your Firebase project.";
  }
  if (missing.length) {
    return `Firebase config is incomplete. Missing: ${missing.join(", ")}.`;
  }
  return null;
}

/**
 * Point at the local Firebase emulators instead of the real project. Set
 * NEXT_PUBLIC_FIREBASE_EMULATOR=1 to try things out without touching live data.
 */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  const error = firebaseConfigError();
  if (error) throw new Error(error);
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(config as Required<typeof config>);
  }
  return app;
}

export function getDb(): Firestore {
  if (!firestore) {
    firestore = useEmulators
      ? initializeFirestore(getFirebaseApp(), {})
      : // Offline cache: the app keeps working on a phone with no signal and
        // syncs when it reconnects. Multi-tab so the Mac can have several open.
        initializeFirestore(getFirebaseApp(), {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
    if (useEmulators) connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  }
  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (useEmulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}
