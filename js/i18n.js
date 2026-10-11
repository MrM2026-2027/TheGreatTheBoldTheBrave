// Language handling: English (main), Simplified Chinese, Russian, Kazakh (Cyrillic).
export const LANGS = [
  { code: "en", name: "English", short: "English", speech: "en-GB" },
  { code: "zh", name: "简体中文", short: "中文", speech: "zh-CN" },
  { code: "ru", name: "Русский", short: "Русский", speech: "ru-RU" },
  { code: "kk", name: "Қазақша", short: "Қазақша", speech: "kk-KZ" },
];

let lang = "en";
try {
  const s = localStorage.getItem("ipc_lang");
  if (s && LANGS.some((l) => l.code === s)) lang = s;
} catch (_) { /* private mode */ }
document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(l) {
  if (!LANGS.some((x) => x.code === l)) return;
  lang = l;
  try { localStorage.setItem("ipc_lang", l); } catch (_) { /* ignore */ }
  document.documentElement.lang = l;
  window.dispatchEvent(new CustomEvent("langchange"));
}

// Pick the text for the current language from {en, zh, ru, kk}; fall back to English.
export function tx(obj, l = lang) {
  if (obj === null || obj === undefined) return "";
  if (typeof obj === "string") return obj;
  return obj[l] || obj.en || "";
}

const UI = {
  appTitle: { en: "The Great, the Bold and the Brave", zh: "伟大、大胆与勇敢", ru: "Великие, смелые и отважные", kk: "Ұлы, батыл және ержүрек" },
  username: { en: "Username", zh: "用户名", ru: "Имя пользователя", kk: "Пайдаланушы аты" },
  password: { en: "Password", zh: "密码", ru: "Пароль", kk: "Құпия сөз" },
  signIn: { en: "Sign in", zh: "登录", ru: "Войти", kk: "Кіру" },
  signOut: { en: "Sign out", zh: "退出", ru: "Выйти", kk: "Шығу" },
  loginError: { en: "Wrong username or password. Try again.", zh: "用户名或密码错误，请再试一次。", ru: "Неверное имя или пароль. Попробуй ещё раз.", kk: "Аты немесе құпия сөз қате. Қайта көр." },
  loginHelp: { en: "Type your username (for example Student01).", zh: "输入你的用户名（例如 Student01）。", ru: "Введи своё имя пользователя (например, Student01).", kk: "Пайдаланушы атыңды жаз (мысалы, Student01)." },
  lessons: { en: "My lessons", zh: "我的课程", ru: "Мои уроки", kk: "Менің сабақтарым" },
  locked: { en: "Not open yet", zh: "尚未开放", ru: "Пока закрыто", kk: "Әзірге жабық" },
  comingSoon: { en: "Coming soon", zh: "即将推出", ru: "Скоро", kk: "Жақында" },
  openLesson: { en: "Open", zh: "打开", ru: "Открыть", kk: "Ашу" },
  play: { en: "Play", zh: "开始玩", ru: "Играть", kk: "Ойнау" },
  back: { en: "Back", zh: "返回", ru: "Назад", kk: "Артқа" },
  saving: { en: "Saving…", zh: "保存中…", ru: "Сохранение…", kk: "Сақталуда…" },
  saved: { en: "Saved ✓", zh: "已保存 ✓", ru: "Сохранено ✓", kk: "Сақталды ✓" },
  saveError: { en: "Not saved. Check your internet.", zh: "未保存，请检查网络。", ru: "Не сохранено. Проверь интернет.", kk: "Сақталмады. Интернетті тексер." },
  loading: { en: "Loading…", zh: "加载中…", ru: "Загрузка…", kk: "Жүктелуде…" },
  loadError: { en: "Could not load this page. Check your internet and try again.", zh: "无法加载此页面。请检查网络后重试。", ru: "Не удалось загрузить страницу. Проверь интернет и попробуй снова.", kk: "Бетті жүктеу мүмкін болмады. Интернетті тексеріп, қайта көр." },
  check: { en: "Check my answers", zh: "检查答案", ru: "Проверить ответы", kk: "Жауаптарды тексеру" },
  score: { en: "Score", zh: "得分", ru: "Результат", kk: "Нәтиже" },
  correct: { en: "Correct!", zh: "正确！", ru: "Правильно!", kk: "Дұрыс!" },
  notQuite: { en: "Not quite.", zh: "不太对。", ru: "Не совсем.", kk: "Толық емес." },
  listen: { en: "Listen", zh: "听", ru: "Слушать", kk: "Тыңдау" },
  undo: { en: "Undo", zh: "撤销", ru: "Отменить", kk: "Болдырмау" },
  clear: { en: "Clear", zh: "清除", ru: "Очистить", kk: "Тазалау" },
  clearConfirm: { en: "Clear your drawing?", zh: "清除你的画？", ru: "Очистить рисунок?", kk: "Суретті тазалайсың ба?" },
  eraser: { en: "Eraser", zh: "橡皮", ru: "Ластик", kk: "Өшіргіш" },
  pen: { en: "Pen", zh: "画笔", ru: "Ручка", kk: "Қалам" },
  add: { en: "Add", zh: "添加", ru: "Добавить", kk: "Қосу" },
  typeIdea: { en: "Type your own idea…", zh: "输入你自己的想法…", ru: "Напиши свою идею…", kk: "Өз идеяңды жаз…" },
  writeHere: { en: "Write here…", zh: "在这里写…", ru: "Пиши здесь…", kk: "Осы жерге жаз…" },
  tapWord: { en: "Tap a card to see what it means.", zh: "点击卡片查看意思。", ru: "Нажми на карточку, чтобы узнать значение.", kk: "Мағынасын көру үшін карточканы бас." },
  dragFromHere: { en: "Drag from here", zh: "从这里拖动", ru: "Перетаскивай отсюда", kk: "Осы жерден апар" },
  sentenceStarters: { en: "Sentence starters (tap to use)", zh: "句子开头（点击使用）", ru: "Начало предложения (нажми, чтобы использовать)", kk: "Сөйлем басы (қолдану үшін бас)" },
  progress: { en: "{n} of {m} activities done", zh: "已完成 {n} / {m} 个活动", ru: "Выполнено {n} из {m} заданий", kk: "{m} тапсырманың {n}-і орындалды" },
  game: { en: "Game", zh: "游戏", ru: "Игра", kk: "Ойын" },
  teacherPanel: { en: "Teacher panel", zh: "教师面板", ru: "Панель учителя", kk: "Мұғалім панелі" },
  // ---- tower game ----
  towerTitle: { en: "Tower Builder", zh: "高塔建造者", ru: "Строитель башни", kk: "Мұнара салушы" },
  towerHelp: { en: "1. Tap a piece. 2. Touch the sky and slide to choose where. 3. Let go to drop it. Build the tallest tower you can!", zh: "1. 点选一个积木。2. 触摸天空并滑动选择位置。3. 松手放下。搭出你能搭的最高的塔！", ru: "1. Выбери деталь. 2. Коснись неба и подвигай, чтобы выбрать место. 3. Отпусти, чтобы уронить деталь. Построй самую высокую башню!", kk: "1. Бөлікті таңда. 2. Аспанға тиіп, орнын таңдау үшін жылжыт. 3. Түсіру үшін жібер. Ең биік мұнараны сал!" },
  piecesLeft: { en: "Pieces left", zh: "剩余积木", ru: "Осталось деталей", kk: "Қалған бөліктер" },
  height: { en: "Height", zh: "高度", ru: "Высота", kk: "Биіктік" },
  best: { en: "My best", zh: "我的最高纪录", ru: "Мой рекорд", kk: "Менің рекордым" },
  rotate: { en: "Turn", zh: "旋转", ru: "Повернуть", kk: "Бұру" },
  newGame: { en: "New game", zh: "重新开始", ru: "Новая игра", kk: "Жаңа ойын" },
  leaderboard: { en: "Class leaderboard", zh: "班级排行榜", ru: "Таблица лидеров класса", kk: "Сыныптың үздіктер тізімі" },
  noScores: { en: "No scores yet. Be the first!", zh: "还没有成绩。来当第一名吧！", ru: "Пока нет результатов. Будь первым!", kk: "Әзірге нәтиже жоқ. Бірінші бол!" },
  roundOver: { en: "Tower finished!", zh: "高塔完成！", ru: "Башня готова!", kk: "Мұнара дайын!" },
  waitSettle: { en: "Wait… is your tower still standing?", zh: "等一下……你的塔还立着吗？", ru: "Подожди… твоя башня стоит?", kk: "Күте тұр… мұнараң әлі тұр ма?" },
  newBest: { en: "New best!", zh: "新纪录！", ru: "Новый рекорд!", kk: "Жаңа рекорд!" },
  factTitle: { en: "Did you know?", zh: "你知道吗？", ru: "А ты знаешь?", kk: "Білесің бе?" },
  factText: { en: "Greek builders used columns with beams across the top. This is called post and lintel. Romans later used arches to build even bigger buildings!", zh: "希腊建造者用柱子在顶部架上横梁，这叫做“柱梁结构”。后来罗马人用拱门建造了更大的建筑！", ru: "Греческие строители ставили колонны и клали сверху балки. Это называется «стоечно-балочная конструкция». Позже римляне стали использовать арки и строить ещё большие здания!", kk: "Грек құрылысшылары бағаналардың үстіне арқалық қойған. Мұны «тірек-арқалық» құрылысы дейді. Кейін римдіктер арка қолданып, одан да үлкен ғимараттар салды!" },
  you: { en: "you", zh: "你", ru: "ты", kk: "сен" },
  pieceColumn: { en: "Column", zh: "柱子", ru: "Колонна", kk: "Бағана" },
  pieceBeam: { en: "Beam", zh: "横梁", ru: "Балка", kk: "Арқалық" },
  pieceBlock: { en: "Block", zh: "石块", ru: "Блок", kk: "Блок" },
  pieceRoof: { en: "Roof", zh: "屋顶", ru: "Крыша", kk: "Шатыр" },
};

Object.assign(UI, {
  tapPlace: { en: "Tap a name, then tap the map.", zh: "先点名字，再点地图。", ru: "Нажми на название, потом на карту.", kk: "Атауды басып, содан кейін картаны бас." },
  tapMap: { en: "Now tap the right place on the map.", zh: "现在点地图上正确的位置。", ru: "Теперь нажми на нужное место на карте.", kk: "Енді картадағы дұрыс жерді бас." },
  tapRemove: { en: "Tap to take the pin off", zh: "点一下取下图钉", ru: "Нажми, чтобы убрать метку", kk: "Белгіні алу үшін бас" },
  caption: { en: "Write a short caption…", zh: "写一句简短的说明…", ru: "Напиши короткую подпись…", kk: "Қысқа жазу жаз…" },
  scene: { en: "Scene {n}", zh: "第{n}幕", ru: "Сцена {n}", kk: "{n}-көрініс" },
  notYet: { en: "Not yet", zh: "还不会", ru: "Пока нет", kk: "Әзірге жоқ" },
  gettingThere: { en: "Getting there", zh: "快会了", ru: "Почти", kk: "Жақындап қалдым" },
  gotIt: { en: "Got it!", zh: "我会了！", ru: "Понял(а)!", kk: "Түсіндім!" },
  nextLesson: { en: "Next lesson", zh: "下一课", ru: "Следующий урок", kk: "Келесі сабақ" },
  didYouKnow: { en: "Did you know?", zh: "你知道吗？", ru: "А ты знаешь?", kk: "Білесің бе?" },
});

export function t(key, vars) {
  const e = UI[key];
  let s = e ? e[lang] || e.en : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// ---------- read aloud (uses the iPad's built-in voices) ----------
function voices() {
  return "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
}
const speechCode = (l) => LANGS.find((x) => x.code === l).speech;

export function canSpeak(l = lang) {
  if (!("speechSynthesis" in window)) return false;
  const v = voices();
  if (!v.length) return l !== "kk"; // voices load late on some devices
  const prefix = speechCode(l).slice(0, 2);
  return v.some((x) => x.lang.toLowerCase().replace("_", "-").startsWith(prefix));
}

export function speak(text, l = lang) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechCode(l);
  u.rate = 0.9;
  const exact = voices().find((x) => x.lang.toLowerCase().replace("_", "-") === u.lang.toLowerCase());
  if (exact) u.voice = exact;
  window.speechSynthesis.speak(u);
}
