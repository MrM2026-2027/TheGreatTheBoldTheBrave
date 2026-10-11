// Storage + login. Two interchangeable back ends:
//   - Firebase (real use)           - Demo (this device only, used until config.js is filled in)
import { FIREBASE_CONFIG, SETTINGS, DEMO_MODE } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

export const toEmail = (username) => `${username}@${SETTINGS.emailDomain}`;
export const toPassword = (p) => p + SETTINGS.passwordSuffix;
export const isTeacherName = (u) => u === SETTINGS.teacherUsername;

// "Student1", "student 01", "STUDENT01" all become "student01".
export function normaliseUsername(raw) {
  let u = (raw || "").trim().toLowerCase().replace(/\s+/g, "");
  const m = u.match(/^student0*(\d{1,3})$/);
  if (m) u = "student" + m[1].padStart(2, "0");
  return u;
}

export async function createBackend() {
  return DEMO_MODE ? createDemo() : createFirebase();
}

// ---------------------------------------------------------------- Firebase
async function createFirebase() {
  const [appMod, authMod, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch (_) {
    db = fs.getFirestore(app);
  }
  const nameOf = (u) => (u ? u.email.split("@")[0] : null);
  const itemId = (lessonId, activityId) => `${lessonId}__${activityId}`;

  return {
    demo: false,
    onAuth: (cb) => authMod.onAuthStateChanged(auth, (u) => cb(nameOf(u))),
    signIn: (username, password) =>
      authMod.signInWithEmailAndPassword(auth, toEmail(username), isTeacherName(username) ? password : toPassword(password)),
    signOut: () => authMod.signOut(auth),

    async saveWork(username, lessonId, activityId, data) {
      await fs.setDoc(fs.doc(db, "work", username, "items", itemId(lessonId, activityId)), {
        lessonId, activityId, data, updatedAt: fs.serverTimestamp(),
      });
    },
    async loadWork(username, lessonId) {
      const snap = await fs.getDocs(
        fs.query(fs.collection(db, "work", username, "items"), fs.where("lessonId", "==", lessonId))
      );
      const out = {};
      snap.forEach((d) => { out[d.data().activityId] = d.data().data; });
      return out;
    },

    async getOpen() {
      const d = await fs.getDoc(fs.doc(db, "config", "lessons"));
      return d.exists() ? d.data().open || {} : {};
    },
    async setOpen(map) {
      await fs.setDoc(fs.doc(db, "config", "lessons"), { open: map });
    },

    async getScores() {
      const snap = await fs.getDocs(fs.collection(db, "scores"));
      return snap.docs.map((d) => ({ username: d.id, best: d.data().best }));
    },
    async submitScore(username, best) {
      const ref = fs.doc(db, "scores", username);
      const cur = await fs.getDoc(ref);
      if (cur.exists() && cur.data().best >= best) return false;
      await fs.setDoc(ref, { username, best, updatedAt: fs.serverTimestamp() });
      return true;
    },
    async resetScores() {
      const snap = await fs.getDocs(fs.collection(db, "scores"));
      await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
    },
  };
}

// -------------------------------------------------------------------- Demo
function createDemo() {
  const read = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (_) { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* full */ } };
  let listener = () => {};
  return {
    demo: true,
    onAuth(cb) { listener = cb; setTimeout(() => cb(read("ipc_demo_user", null)), 0); },
    async signIn(username, password) {
      const okPupil = /^student\d{2,3}$/.test(username) && password === "abc";
      const okTeacher = isTeacherName(username) && password === "teacher";
      if (!okPupil && !okTeacher) throw new Error("bad-credentials");
      write("ipc_demo_user", username);
      listener(username);
    },
    async signOut() { localStorage.removeItem("ipc_demo_user"); listener(null); },

    async saveWork(username, lessonId, activityId, data) {
      const all = read("ipc_demo_work_" + username, {});
      all[`${lessonId}__${activityId}`] = { lessonId, activityId, data };
      write("ipc_demo_work_" + username, all);
    },
    async loadWork(username, lessonId) {
      const all = read("ipc_demo_work_" + username, {});
      const out = {};
      Object.values(all).forEach((x) => { if (x.lessonId === lessonId) out[x.activityId] = x.data; });
      return out;
    },

    async getOpen() { return read("ipc_demo_open", {}); },
    async setOpen(map) { write("ipc_demo_open", map); },

    async getScores() { return Object.entries(read("ipc_demo_scores", {})).map(([username, best]) => ({ username, best })); },
    async submitScore(username, best) {
      const s = read("ipc_demo_scores", {});
      if ((s[username] || 0) >= best) return false;
      s[username] = best;
      write("ipc_demo_scores", s);
      return true;
    },
    async resetScores() { write("ipc_demo_scores", {}); },
  };
}
