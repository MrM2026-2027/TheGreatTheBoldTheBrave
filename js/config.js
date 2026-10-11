// ---------------------------------------------------------------------------
// SITE CONFIGURATION  (the only file you need to edit to connect Firebase)
// ---------------------------------------------------------------------------
// 1. In the Firebase console: Project settings > General > Your apps > Web app.
// 2. Copy the values from the "firebaseConfig" block into FIREBASE_CONFIG below.
//    These values are NOT secret - security comes from firestore.rules.
// While apiKey still starts with "YOUR_", the site runs in DEMO MODE: it works
// fully, but work is saved only in the browser on that device.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSgBZskWIwM2iEKzDRk0dbDZsF4i2gVI8",
  authDomain: "thegreattheboldthebrave.firebaseapp.com",
  projectId: "thegreattheboldthebrave",
  storageBucket: "thegreattheboldthebrave.firebasestorage.app",
  messagingSenderId: "977171868958",
  appId: "1:977171868958:web:a7eecd4a93bc91299e6d0f",
};

export const SETTINGS = {
  // Pupils sign in as Student01, Student02 ... behind the scenes this becomes
  // student01@ipc.local. Must match tools/create-accounts.mjs and firestore.rules.
  emailDomain: "ipc.local",

  // Added to every password before it is sent to Firebase (Firebase needs 6+
  // characters). Leave "" if your Firebase project accepts "abc" as it is.
  // If it is rejected, set this to e.g. "123" and re-run the accounts script.
  passwordSuffix: "123",

  teacherUsername: "teacher",

  // How many Student accounts exist (Student01 ... StudentNN).
  pupilCount: 30,

  className: "6E",
};

export const DEMO_MODE = FIREBASE_CONFIG.apiKey.startsWith("YOUR_");
