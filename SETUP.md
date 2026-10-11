# The Great, the Bold and the Brave — 6E Topic Book

An interactive pupil workbook for the IPC unit, built for iPads.
Plain HTML/JavaScript, no build step. Hosted on GitHub Pages, with work saved in Firebase.

**Try it before setting anything up:** the site runs in *demo mode* until `js/config.js` is filled in.
In demo mode work is saved only in that browser. Logins: `Student01` / `abc`, and the teacher is `teacher` / `teacher`.

---

## One-time setup (about 20 minutes)

### 1. Firebase
1. Go to [console.firebase.google.com](https://console.firebase.google.com), then **Add project** (Google Analytics is not needed).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database.** Pick a location (for example `asia-east1`) and start in **production mode**.
4. **Firestore → Rules:** delete what is there, paste in the whole of `firestore.rules`, and click **Publish**.
5. **Project settings (cog) → General → Your apps → Web (`</>`)**: register an app (no hosting needed) and copy the `firebaseConfig` values.

### 2. Connect the site
Open `js/config.js` and paste the six values into `FIREBASE_CONFIG`. This is the only file you edit.
(These values are not secret. The security comes from the rules.)

### 3. Put it on GitHub Pages
1. Create a new repository and upload **everything in this folder**, including `.nojekyll`.
2. **Settings → Pages → Deploy from a branch → `main` / root → Save.**
3. After a minute the site is at `https://YOUR-NAME.github.io/REPO-NAME/`.
4. **Firebase → Authentication → Settings → Authorized domains → Add domain:** `YOUR-NAME.github.io`

### 4. Create the accounts
1. Open `https://YOUR-NAME.github.io/REPO-NAME/tools/create-accounts.html`
2. Enter 30 pupils, password `abc`, and a strong teacher password, then click **Create accounts**.
3. **Then switch off sign-up:** Firebase → Authentication → Settings → User actions → untick **Enable create (sign-up)**.
   After this, nobody can make new accounts.
4. Optional: delete `tools/create-accounts.html` from the repo.

> If Firebase rejects `abc` as too short, set `passwordSuffix: "123"` in `js/config.js`, upload, and run the tool again.
> Pupils still type `abc`; the site adds the suffix for them.

### 5. Check the rules work (2 minutes)
Sign in as `Student01`, do an activity, and sign out. Sign in as `teacher` and open **Teacher panel → Load class**.
You should see Student01's work. If you get a "Missing or insufficient permissions" error, re-publish `firestore.rules`.

### 6. On each iPad
Open the site in Safari, then **Share → Add to Home Screen**. It then opens full-screen like an app.

---

## Using it

| Who | What they can do |
|---|---|
| Pupils | Sign in, open lessons you have unlocked, do activities (saved automatically), switch language with the tabs at the top, tap 🔊 to hear text read aloud, play Tower Builder |
| Teacher | Everything above, plus the **Teacher panel**: open or close lessons, see a class overview (who has done which activity), tap a pupil to read all their work, reset the tower leaderboard |

* Usernames are forgiving: `student1`, `Student 01` and `STUDENT01` all work.
* All 10 lessons plus Tower Builder are built. Only Lesson 1 is open at first. Open each one from the Teacher panel as you reach it in class.
* Read-aloud uses the iPad's own voices. English, Chinese and Russian are built in. If there's no Kazakh voice on the iPad, the 🔊 button hides itself in Kazakh.

## Files

```
index.html            the app
css/style.css         the look
js/config.js          ← your Firebase settings (the only file you edit)
js/app.js             pages, login, saving
js/activities.js      activity types: sort / Venn, fill the gap, quiz, write, draw
js/activities2.js     map pins, timeline order, table, self-rating, checklist, choose, storyboard
js/tower.js           Tower Builder game (physics: js/vendor/matter.min.js, MIT licence)
js/teacher.js         teacher panel
js/i18n.js            English / 中文 / Русский / Қазақша interface text
lessons/index.json    the lesson menu
lessons/lesson1.json … lesson9.json, ple1.json, ple2.json  lesson content in all four languages
assets/               maps and drawings used by the lessons
firestore.rules       security rules (paste into Firebase)
tools/create-accounts.html   one-off account creator
```

## Where the data lives (Firestore)

| Collection | Contents |
|---|---|
| `work/{studentNN}/items/{lesson__activity}` | each pupil's answers, drawings and writing |
| `config/lessons` | which lessons are open |
| `scores/{studentNN}` | best Tower Builder height |

No pupil names are stored anywhere. Only `Student01`, `Student02` and so on.

## Lesson plan

| Week | File | Content |
|---|---|---|
| 1 | lesson1 + Tower Builder | Entry Point, Knowledge Harvest |
| 2 | lesson2 | Greece map, Athens v Sparta, who could vote |
| 3 | lesson3 | Persian War, bias, democracy v oligarchy |
| 4 | lesson4 | Parthenon, Greek theatre, masks |
| 5 | lesson5 | Alexander the Great, Rome, social classes, homes |
| 6 | lesson6 | Roman guide, the Republic |
| 7 | lesson7 | Roman army and Britain, good and bad effects |
| 8 | lesson8 | Fall of Rome, Anglo-Saxons, Sutton Hoo |
| 9 | lesson9 | Vikings, Alfred, 1066, migrants and refugees |
| 10–11 | ple1, ple2 | Greek-style play toolkit, rehearsal, reflection |
