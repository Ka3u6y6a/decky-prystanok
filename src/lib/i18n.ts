// Tiny i18n. Source is Ukrainian; English is the only translation (everything
// else falls back to English). Outside Steam (tests) there's no
// LocalizationManager, so we resolve to uk. Overlapping keys are mirrored in
// py_modules for the store surface.

type Entry = { uk: string; en: string };

const STR: Record<string, Entry> = {
  // — badges (gamepad overlay + modal status) —
  "badge.russian": { uk: "російська гра", en: "Russian game" },
  "badge.suspect": { uk: "ймовірно сумнівна гра", en: "likely questionable game" },
  "badge.suspect.short": { uk: "сумнівна", en: "questionable" },
  "badge.vendor": { uk: "видавець видавав рос. ігри", en: "publisher released Russian games" },
  "badge.vendor.short": { uk: "видавець", en: "publisher" },
  "badge.ukGame": { uk: "українська гра", en: "Ukrainian game" },
  "loc.text": { uk: "текст", en: "text" },
  "loc.audio": { uk: "текст + озвучення", en: "text + voice" },
  "loc.uaPrefix": { uk: "УКР", en: "UA" },
  "loc.fanPrefix": { uk: "Українізатор", en: "Fan UA" },
  "loc.semiPrefix": { uk: "Напівофіційна", en: "Semi-official" },
  "chip.rf": { uk: "рф", en: "RU" },
  "chip.ukGame": { uk: "УКР гра", en: "UA game" },

  // — verdict banner —
  "verdict.russian.title": { uk: "Російська гра", en: "Russian game" },
  "verdict.russian.sub": {
    uk: "Розробник або видавець — російський.",
    en: "The developer or publisher is Russian.",
  },
  "verdict.russian.uaSuffix": {
    uk: " Українська є, але гра російська.",
    en: " Ukrainian exists, but the game is Russian.",
  },
  "verdict.suspect.title": { uk: "Ймовірно сумнівна гра", en: "Likely questionable game" },
  "verdict.suspect.sub": {
    uk: "{name}: рос. ігри — більшість портфоліо.",
    en: "{name}: Russian games are most of the portfolio.",
  },
  "verdict.suspect.subFallback": {
    uk: "Видавець видавав переважно рос. ігри.",
    en: "Publisher released mostly Russian games.",
  },
  "verdict.vendor.title": { uk: "Видавець видавав рос. ігри", en: "Publisher released Russian games" },
  "verdict.vendor.sub": {
    uk: "Видавці видавали й рос. ігри (меншість). Розробник не російський.",
    en: "Publishers also released Russian games (minority). The developer isn't Russian.",
  },
  "verdict.links.sub": {
    uk: "Виявлено російські посилання (див. нижче).",
    en: "Russian links detected (see below).",
  },
  "verdict.clean.title": { uk: "Загроз не виявлено", en: "No threats found" },

  // — modal —
  "modal.loc": { uk: "Локалізація", en: "Localization" },
  "modal.dev": { uk: "Розробник", en: "Developer" },
  "modal.bloody": { uk: "⚠ Продається в рф", en: "⚠ Sold in Russia" },
  "modal.vendors": { uk: "Причетні компанії — частка рос. ігор", en: "Involved companies — Russian-game share" },
  "modal.links": { uk: "Російські посилання", en: "Russian links" },
  "modal.reviews": { uk: "Рецензії кураторів", en: "Curator reviews" },
  "modal.why": { uk: "Чому купувати російські ігри — погано", en: "Why buying Russian games is wrong" },
  "modal.whyText": {
    uk:
      "Гроші за гру російського розробника/видавця через податки та зарплати живлять бюджет " +
      "країни-терориста, яка на ці гроші купує зброю для вбивства людей в Україні. Обирайте " +
      "українських або інших розробників.",
    en:
      "Money for a Russian developer's/publisher's game feeds — through taxes and salaries — the " +
      "budget of a terrorist state that uses it to buy weapons to kill people in Ukraine. Choose " +
      "Ukrainian or other developers.",
  },
  "modal.loading": { uk: "Завантаження…", en: "Loading…" },
  "review.up": { uk: "рекомендує", en: "recommends" },
  "review.down": { uk: "не рекомендує", en: "doesn't recommend" },
  "review.info": { uk: "інфо", en: "info" },
  "btn.prystanok": { uk: "Пристанок", en: "Prystanok" },
  "btn.kuli": { uk: "КУЛІ", en: "KULI" },
  "btn.close": { uk: "Закрити", en: "Close" },

  // — localization source line —
  "locsrc.steam": { uk: "Офіційна — джерело Steam", en: "Official — from Steam" },
  "locsrc.both": { uk: "Офіційна — Steam + Пристанок", en: "Official — Steam + Prystanok" },
  "locsrc.official": { uk: "Офіційна — джерело Пристанок", en: "Official — from Prystanok" },
  "locsrc.semi": { uk: "Напівофіційна — джерело Пристанок", en: "Semi-official — from Prystanok" },
  "locsrc.fan": { uk: "Українізатор — джерело Пристанок", en: "Fan translation — from Prystanok" },

  // — vendor risk (QAM) —
  "vendor.risk": {
    uk: "рос. ігор: {rus} з {total} ({pct}%)",
    en: "Russian games: {rus} of {total} ({pct}%)",
  },

  // — Quick Access panel —
  "qam.kuli": { uk: "Сторінка на КУЛІ", en: "KULI page" },
  "qam.checkPrystanok": { uk: "Перевірити на Пристанку", en: "Check on Prystanok" },
  "qam.empty": {
    uk: "Відкрийте гру, щоб побачити деталі та попередження.",
    en: "Open a game to see details and warnings.",
  },
  "qam.error": {
    uk: "Не вдалося отримати дані. Перевірте інтернет.",
    en: "Couldn't fetch data. Check your connection.",
  },
  "qam.notInDb": { uk: "Гра відсутня в базі Пристанку.", en: "Game not in the Prystanok database." },
  "qam.checkLibrary": { uk: "Перевірити мою бібліотеку", en: "Check my library" },
  "qam.service": { uk: "Сервіс", en: "Service" },
  "qam.clearCache": { uk: "Очистити кеш", en: "Clear cache" },
  "qam.clearCacheTitle": { uk: "Очистити кеш?", en: "Clear cache?" },
  "qam.clearCacheDesc": {
    uk: "Збережені дані ігор буде видалено; вони підвантажаться знову при потребі.",
    en: "Cached game data will be removed; it will be re-fetched when needed.",
  },
  "qam.resetSettings": { uk: "Скинути налаштування", en: "Reset settings" },
  "qam.resetTitle": { uk: "Скинути налаштування?", en: "Reset settings?" },
  "qam.resetDesc": {
    uk: "Усі налаштування бейджів повернуться до стандартних.",
    en: "All badge settings will return to defaults.",
  },
  "qam.reset": { uk: "Скинути", en: "Reset" },
  "qam.cancel": { uk: "Скасувати", en: "Cancel" },
  "toast.cacheCleared": { uk: "Кеш очищено", en: "Cache cleared" },
  "toast.settingsReset": { uk: "Налаштування скинуто", en: "Settings reset" },

  // — settings —
  "set.title": { uk: "Бейджі", en: "Badges" },
  "set.secLoc": { uk: "Локалізація", en: "Localization" },
  "set.secPanel": { uk: "Панель", en: "Panel" },
  "set.surfaceOn": { uk: "Показувати", en: "Show" },
  "set.capsules": { uk: "Капсули та сітка", en: "Capsules & grid" },
  "set.appPage": { uk: "Сторінка гри", en: "Game page" },
  "set.store": { uk: "Сторінка магазину", en: "Store page" },
  "set.position": { uk: "Позиція", en: "Position" },
  "set.size": { uk: "Розмір", en: "Size" },
  "set.offsetX": { uk: "Відступ X", en: "Offset X" },
  "set.offsetY": { uk: "Відступ Y", en: "Offset Y" },
  "set.showLoc": { uk: "Показувати", en: "Show" },
  "set.showLocDesc": {
    uk: "Показується лише на ввімкнених поверхнях",
    en: "Shown only on enabled surfaces",
  },
  "set.detailed": { uk: "Детально", en: "Detailed" },
  "set.detailedDesc": { uk: "Текст/озвучення, офіційна/неофіційна", en: "Text/voice, official/unofficial" },
  "set.qamDetails": { uk: "Деталі гри в цій панелі", en: "Game details in this panel" },
  "set.langLabel": { uk: "Яку мову шукати", en: "Which language to look for" },
  "set.off": { uk: "(вимкнено)", en: "(off)" },
  "set.langAuto": { uk: "Як у Steam", en: "Same as Steam" },
};

let _lang: "uk" | "en" | null = null;

/** UI language, resolved once: uk for Ukrainian Steam or outside Steam, else en. */
export function uiLang(): "uk" | "en" {
  if (_lang) return _lang;
  try {
    const lm = (window as unknown as { LocalizationManager?: { m_rgLocalesToUse?: string[] } })
      .LocalizationManager;
    const raw = lm?.m_rgLocalesToUse?.[0];
    if (raw) {
      _lang = String(raw).toLowerCase().split("-")[0] === "uk" ? "uk" : "en";
      return _lang;
    }
  } catch {
    /* no Steam runtime */
  }
  _lang = "uk";
  return _lang;
}

/** Test seam: force the resolved language. */
export function setLangForTest(lang: "uk" | "en" | null): void {
  _lang = lang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const entry = STR[key];
  if (!entry) return key;
  let s = entry[uiLang()] ?? entry.uk;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`));
  }
  return s;
}
