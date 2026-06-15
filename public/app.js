"use strict";

const STORAGE_KEYS = {
  theme: "marketlens:theme",
  read: "marketlens:read",
  watchlist: "marketlens:watchlist",
  endpoints: "marketlens:endpoints",
};

const DEFAULT_ENDPOINTS = {
  disclosures: "/api/disclosures?days=3&limit=120",
  calendar: "/api/calendar?days=90",
};

const JPX_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-01-12",
  "2026-02-11",
  "2026-02-23",
  "2026-03-20",
  "2026-04-29",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-05-06",
  "2026-07-20",
  "2026-08-11",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-10-12",
  "2026-11-03",
  "2026-11-23",
  "2026-12-31",
]);

const companyNames = {
  7203: "トヨタ自動車",
  6758: "ソニーグループ",
  9984: "ソフトバンクグループ",
  8306: "三菱UFJフィナンシャル・グループ",
  9432: "日本電信電話",
  6501: "日立製作所",
  7974: "任天堂",
  8058: "三菱商事",
};

const todayIso = getTokyoDateParts(new Date()).date;
const currentMonthDate = parseIsoDate(todayIso);

let disclosures = [
  {
    id: "d-001",
    code: "7203",
    company: companyNames["7203"],
    datetime: `${todayIso}T15:12:00+09:00`,
    title: "デモ: 通期業績予想の修正に関するお知らせ",
    category: "業績修正",
    priority: "high",
    tone: "positive",
    metrics: { impact: "高", speed: "5分", confidence: "88" },
    summary: [
      "売上高と営業利益の前提が上方に更新されています。",
      "為替・原材料費・地域別販売の寄与を確認する価値があります。",
      "同業他社の修正有無をウォッチ対象に追加すると比較しやすくなります。",
    ],
    tags: ["デモ", "業績修正", "ウォッチ候補"],
    url: "https://www.release.tdnet.info/",
  },
  {
    id: "d-002",
    code: "6758",
    company: companyNames["6758"],
    datetime: `${todayIso}T15:05:00+09:00`,
    title: "デモ: 自己株式取得に係る事項の決定に関するお知らせ",
    category: "資本政策",
    priority: "high",
    tone: "positive",
    metrics: { impact: "高", speed: "8分", confidence: "82" },
    summary: [
      "取得上限、取得期間、発行済株式数に対する割合を確認します。",
      "過去の還元方針との一貫性が投資家反応の焦点です。",
      "同時発表の決算・中計更新があれば合わせて読むと判断しやすくなります。",
    ],
    tags: ["デモ", "自己株式", "還元"],
    url: "https://www.release.tdnet.info/",
  },
  {
    id: "d-003",
    code: "8306",
    company: companyNames["8306"],
    datetime: `${todayIso}T12:45:00+09:00`,
    title: "デモ: 剰余金の配当に関するお知らせ",
    category: "配当",
    priority: "medium",
    tone: "neutral",
    metrics: { impact: "中", speed: "18分", confidence: "76" },
    summary: [
      "1株当たり配当、基準日、効力発生日を確認します。",
      "配当性向と自己資本比率のバランスを見ると継続性を判断しやすくなります。",
    ],
    tags: ["デモ", "配当", "銀行"],
    url: "https://www.release.tdnet.info/",
  },
  {
    id: "d-004",
    code: "9984",
    company: companyNames["9984"],
    datetime: `${todayIso}T11:31:00+09:00`,
    title: "デモ: 連結子会社の異動を伴う株式譲渡に関するお知らせ",
    category: "M&A",
    priority: "high",
    tone: "mixed",
    metrics: { impact: "高", speed: "32分", confidence: "79" },
    summary: [
      "譲渡価額、損益影響、クロージング条件が確認ポイントです。",
      "次回決算でのセグメント別影響を追跡します。",
    ],
    tags: ["デモ", "M&A", "子会社"],
    url: "https://www.release.tdnet.info/",
  },
  {
    id: "d-005",
    code: "9432",
    company: companyNames["9432"],
    datetime: `${addDaysIso(todayIso, -1)}T16:00:00+09:00`,
    title: "デモ: 代表取締役の異動に関するお知らせ",
    category: "人事",
    priority: "low",
    tone: "neutral",
    metrics: { impact: "低", speed: "1日", confidence: "65" },
    summary: [
      "異動理由、新体制の開始日、経営方針の変更有無を確認します。",
      "中期計画の更新が近い場合はイベント予定に登録します。",
    ],
    tags: ["デモ", "人事"],
    url: "https://www.release.tdnet.info/",
  },
  {
    id: "d-006",
    code: "6501",
    company: companyNames["6501"],
    datetime: `${addDaysIso(todayIso, -2)}T15:30:00+09:00`,
    title: "デモ: 第1四半期決算短信〔IFRS〕（連結）",
    category: "決算",
    priority: "medium",
    tone: "neutral",
    metrics: { impact: "中", speed: "2日", confidence: "72" },
    summary: [
      "売上収益、調整後営業利益、受注残の推移を確認します。",
      "セグメント別の強弱が次回発表までの注目点です。",
    ],
    tags: ["デモ", "決算", "IFRS"],
    url: "https://www.release.tdnet.info/",
  },
];

let calendarEvents = [
  {
    id: "e-001",
    date: todayIso,
    title: "デモ: 主要企業の決算発表",
    type: "earnings",
    market: "TSE",
    codes: ["6501", "6758"],
  },
  {
    id: "e-002",
    date: todayIso,
    title: "デモ: 15:30以降の開示集中帯",
    type: "disclosure",
    market: "TDnet",
    codes: ["7203", "9984"],
  },
  {
    id: "e-003",
    date: addDaysIso(todayIso, 2),
    title: "デモ: 権利付き最終日チェック",
    type: "market",
    market: "TSE",
    codes: ["8306", "9432"],
  },
  {
    id: "e-004",
    date: addDaysIso(todayIso, 4),
    title: "デモ: 株主総会集中日",
    type: "market",
    market: "JPX",
    codes: [],
  },
  {
    id: "e-005",
    date: addDaysIso(todayIso, 9),
    title: "デモ: 決算発表予定更新",
    type: "earnings",
    market: "J-Quants",
    codes: ["7974", "8058"],
  },
  {
    id: "e-006",
    date: "2026-07-20",
    title: "市場休日: 海の日",
    type: "holiday",
    market: "JPX",
    codes: [],
  },
  {
    id: "e-007",
    date: "2026-08-11",
    title: "市場休日: 山の日",
    type: "holiday",
    market: "JPX",
    codes: [],
  },
];

const connectors = [
  {
    name: "TDnet API",
    status: "公式 / 有料",
    text: "適時開示のインデックス、PDF、XBRLを正規取得する本命データ源。",
    url: "https://www.jpx.co.jp/markets/paid-info-listing/tdnet/02.html",
  },
  {
    name: "J-Quants Earnings Calendar",
    status: "JPX系",
    text: "決算発表予定日を取得する候補。利用プランと対象範囲の確認が必要。",
    url: "https://jpx-jquants.com/en/spec/eq-earnings-cal",
  },
  {
    name: "J-Quants Trading Calendar",
    status: "JPX系",
    text: "東証・大証の営業日、非営業日、祝日取引情報を取得する候補。",
    url: "https://jpx-jquants.com/en/spec/mkt-cal",
  },
  {
    name: "EDINET API v2",
    status: "金融庁",
    text: "有価証券報告書など法定開示の一覧・書類取得に使う候補。",
    url: "https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WZEK0110.html",
  },
];

const state = {
  category: "all",
  priority: "all",
  selectedId: disclosures[0].id,
  search: "",
  currentMonth: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1),
  readIds: new Set(readJson(STORAGE_KEYS.read, [])),
  watchlist: readJson(STORAGE_KEYS.watchlist, [
    { code: "7203", company: companyNames["7203"] },
    { code: "6758", company: companyNames["6758"] },
    { code: "8306", company: companyNames["8306"] },
  ]),
  endpoints: { ...DEFAULT_ENDPOINTS, ...readJson(STORAGE_KEYS.endpoints, {}) },
  dataMode: "demo",
};

const el = {
  marketDot: document.querySelector("#marketDot"),
  marketClock: document.querySelector("#marketClock"),
  marketStatusLabel: document.querySelector("#marketStatusLabel"),
  marketSessionText: document.querySelector("#marketSessionText"),
  unreadHighCount: document.querySelector("#unreadHighCount"),
  todayEventCount: document.querySelector("#todayEventCount"),
  nextEventText: document.querySelector("#nextEventText"),
  watchCount: document.querySelector("#watchCount"),
  watchSummary: document.querySelector("#watchSummary"),
  globalSearch: document.querySelector("#globalSearch"),
  disclosureList: document.querySelector("#disclosureList"),
  detailPanel: document.querySelector("#detailPanel"),
  categoryFilters: document.querySelector("#categoryFilters"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarTitle: document.querySelector("#calendarTitle"),
  eventList: document.querySelector("#eventList"),
  watchGrid: document.querySelector("#watchGrid"),
  connectorGrid: document.querySelector("#connectorGrid"),
  watchDialog: document.querySelector("#watchDialog"),
  watchCodeInput: document.querySelector("#watchCodeInput"),
  watchNameInput: document.querySelector("#watchNameInput"),
  tdnetEndpoint: document.querySelector("#tdnetEndpoint"),
  calendarEndpoint: document.querySelector("#calendarEndpoint"),
  dataModeBadge: document.querySelector("#dataModeBadge"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  el.tdnetEndpoint.value = state.endpoints.disclosures || DEFAULT_ENDPOINTS.disclosures;
  el.calendarEndpoint.value = state.endpoints.calendar || DEFAULT_ENDPOINTS.calendar;

  bindEvents();
  renderAll();
  hydrateFromEndpoints();
  updateMarketClock();
  setInterval(updateMarketClock, 30 * 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

async function hydrateFromEndpoints() {
  const tasks = [];

  if (state.endpoints.disclosures) {
    tasks.push(
      fetchJson(state.endpoints.disclosures)
        .then((payload) => ensureArray(payload, "disclosures").map(normalizeDisclosure))
        .then((rows) => {
          if (rows.length) {
            disclosures = rows.sort((a, b) => b.datetime.localeCompare(a.datetime));
            state.selectedId = disclosures[0].id;
          }
        }),
    );
  }

  if (state.endpoints.calendar) {
    tasks.push(
      fetchJson(state.endpoints.calendar)
        .then((payload) => ensureArray(payload, "events").map(normalizeEvent))
        .then((rows) => {
          if (rows.length) {
            calendarEvents = rows.sort((a, b) => a.date.localeCompare(b.date));
          }
        }),
    );
  }

  if (!tasks.length) return;

  const results = await Promise.allSettled(tasks);
  const failed = results.some((result) => result.status === "rejected");
  state.dataMode = failed ? "mixed" : "live";
  renderAll();
  showToast(failed ? "一部の取得先を読み込めませんでした" : "取得先データを反映しました");
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => activateSection(button.dataset.target));
  });

  document.querySelector("#themeToggle").addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  });

  document.querySelectorAll("#addWatchButton, #addWatchButtonSecondary").forEach((button) => {
    button.addEventListener("click", () => {
      el.watchCodeInput.value = "";
      el.watchNameInput.value = "";
      el.watchDialog.showModal();
      el.watchCodeInput.focus();
    });
  });

  el.watchDialog.querySelector("form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") {
      return;
    }
    event.preventDefault();
    const code = el.watchCodeInput.value.trim();
    const company = el.watchNameInput.value.trim() || companyNames[code] || "名称未設定";
    if (!/^[0-9A-Za-z]{4,5}$/.test(code)) {
      showToast("4〜5桁の証券コードを入力してください");
      return;
    }
    upsertWatch({ code: normalizeSecurityCode(code), company });
    renderAll();
    el.watchDialog.close();
    showToast(`${code}をウォッチに追加しました`);
  });

  el.globalSearch.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderDisclosures();
  });

  el.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    el.categoryFilters.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDisclosures();
  });

  document.querySelector(".filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-priority]");
    if (!button) return;
    state.priority = button.dataset.priority;
    document.querySelectorAll("[data-priority]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDisclosures();
  });

  el.disclosureList.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    const item = event.target.closest("[data-id]");
    if (!item) return;
    const disclosure = disclosures.find((entry) => entry.id === item.dataset.id);
    if (!disclosure) return;

    if (action?.dataset.action === "watch") {
      toggleWatch(disclosure.code, disclosure.company);
      return;
    }

    if (action?.dataset.action === "read") {
      toggleRead(disclosure.id);
      return;
    }

    state.selectedId = disclosure.id;
    state.readIds.add(disclosure.id);
    persistReadIds();
    renderDisclosures();
    renderDetail();
    renderSummary();
  });

  document.querySelector("#prevMonth").addEventListener("click", () => {
    state.currentMonth = new Date(
      state.currentMonth.getFullYear(),
      state.currentMonth.getMonth() - 1,
      1,
    );
    renderCalendar();
  });

  document.querySelector("#nextMonth").addEventListener("click", () => {
    state.currentMonth = new Date(
      state.currentMonth.getFullYear(),
      state.currentMonth.getMonth() + 1,
      1,
    );
    renderCalendar();
  });

  document.querySelector("#exportIcs").addEventListener("click", exportCalendar);

  document.querySelector("#saveEndpoints").addEventListener("click", () => {
    state.endpoints = {
      disclosures: el.tdnetEndpoint.value.trim(),
      calendar: el.calendarEndpoint.value.trim(),
    };
    localStorage.setItem(STORAGE_KEYS.endpoints, JSON.stringify(state.endpoints));
    showToast("取得先を保存しました");
    hydrateFromEndpoints();
  });
}

function renderAll() {
  renderSummary();
  renderDisclosures();
  renderDetail();
  renderCalendar();
  renderEvents();
  renderWatchlist();
  renderConnectors();
}

function renderSummary() {
  const unreadHigh = disclosures.filter(
    (item) => item.priority === "high" && !state.readIds.has(item.id),
  ).length;
  const todayEvents = calendarEvents.filter((event) => event.date === todayIso);
  const nextEvent = calendarEvents
    .filter((event) => event.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  el.unreadHighCount.textContent = String(unreadHigh);
  el.todayEventCount.textContent = String(todayEvents.length);
  el.nextEventText.textContent = nextEvent
    ? `${formatShortDate(nextEvent.date)} ${nextEvent.title}`
    : "予定なし";
  el.watchCount.textContent = String(state.watchlist.length);
  el.watchSummary.textContent = state.watchlist.map((item) => item.code).join(" / ") || "未登録";
}

function renderDisclosures() {
  const rows = getFilteredDisclosures();
  if (!rows.length) {
    el.disclosureList.innerHTML = `<div class="detail-empty">条件に一致する開示がありません</div>`;
    return;
  }

  el.disclosureList.innerHTML = rows
    .map((item) => {
      const isActive = item.id === state.selectedId;
      const isWatched = isCodeWatched(item.code);
      const isRead = state.readIds.has(item.id);
      return `
        <article class="disclosure-item ${isActive ? "active" : ""}" data-id="${item.id}" tabindex="0">
          <div class="disclosure-time">
            <span>${formatShortDate(item.datetime.slice(0, 10))}</span>
            <strong>${formatTime(item.datetime)}</strong>
          </div>
          <div class="disclosure-main">
            <div class="ticker-line">
              <span class="ticker">${escapeHtml(item.code)}</span>
              <span class="company">${escapeHtml(item.company)}</span>
            </div>
            <div class="disclosure-title">${escapeHtml(item.title)}</div>
            <div class="tag-row">
              <span class="tag ${item.priority}">${priorityLabel(item.priority)}</span>
              <span class="tag">${escapeHtml(item.category)}</span>
              <span class="tag">${toneLabel(item.tone)}</span>
              ${isRead ? `<span class="tag low">既読</span>` : `<span class="tag high">未読</span>`}
            </div>
          </div>
          <div class="item-actions">
            <button class="mini-button ${isWatched ? "active" : ""}" data-action="watch" type="button" aria-label="ウォッチ切替">★</button>
            <button class="mini-button ${isRead ? "active" : ""}" data-action="read" type="button" aria-label="既読切替">✓</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDetail() {
  const item = disclosures.find((entry) => entry.id === state.selectedId) || disclosures[0];
  if (!item) {
    el.detailPanel.innerHTML = `<div class="detail-empty">開示を選択してください</div>`;
    return;
  }

  el.detailPanel.innerHTML = `
    <div class="ticker-line">
      <span class="ticker">${escapeHtml(item.code)}</span>
      <span class="company">${escapeHtml(item.company)}</span>
    </div>
    <h2 class="detail-title">${escapeHtml(item.title)}</h2>
    <div class="tag-row">
      ${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <div class="detail-metrics">
      <div class="metric-box"><span>影響度</span><strong>${escapeHtml(item.metrics.impact)}</strong></div>
      <div class="metric-box"><span>検知</span><strong>${escapeHtml(item.metrics.speed)}</strong></div>
      <div class="metric-box"><span>確度</span><strong>${escapeHtml(item.metrics.confidence)}</strong></div>
    </div>
    <ul class="summary-list">
      ${item.summary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>
    <a class="source-link" href="${item.url}" target="_blank" rel="noreferrer">開示ページを開く</a>
  `;
}

function renderCalendar() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  el.calendarTitle.textContent = `${year}年${month + 1}月`;

  const firstDate = new Date(year, month, 1);
  const startOffset = firstDate.getDay();
  const startDate = new Date(year, month, 1 - startOffset);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const cells = weekdays.map((day) => `<div class="weekday">${day}</div>`);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const iso = toIsoDate(date);
    const events = eventsForDate(iso);
    const isOutside = date.getMonth() !== month;
    const isToday = iso === todayIso;
    const isHoliday = JPX_HOLIDAYS_2026.has(iso) || isWeekend(date);
    cells.push(`
      <div class="day-cell ${isOutside ? "outside" : ""} ${isToday ? "today" : ""}">
        <div class="day-number">
          <span>${date.getDate()}</span>
          ${isHoliday ? `<span>休</span>` : ``}
        </div>
        <div class="day-events">
          ${events
            .slice(0, 3)
            .map(
              (event) =>
                `<span class="day-pill ${event.type}">${escapeHtml(shortEventTitle(event.title))}</span>`,
            )
            .join("")}
          ${events.length > 3 ? `<span class="day-pill">+${events.length - 3}</span>` : ``}
        </div>
      </div>
    `);
  }

  el.calendarGrid.innerHTML = cells.join("");
  renderEvents();
}

function renderEvents() {
  const rows = calendarEvents
    .filter((event) => event.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  el.eventList.innerHTML = rows
    .map(
      (event) => `
        <article class="event-card">
          <span class="event-date">${formatLongDate(event.date)}</span>
          <span class="event-title">${escapeHtml(event.title)}</span>
          <div class="event-meta">
            <span>${escapeHtml(event.market)}</span>
            <span>${event.codes.length ? event.codes.join(" / ") : eventTypeLabel(event.type)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    el.watchGrid.innerHTML = `<div class="detail-empty">ウォッチ銘柄がありません</div>`;
    return;
  }

  el.watchGrid.innerHTML = state.watchlist
    .map((item) => {
      const relatedDisclosures = disclosures.filter((entry) => entry.code === item.code);
      const relatedEvents = calendarEvents.filter((event) => event.codes.includes(item.code));
      const latest = relatedDisclosures[0];
      return `
        <article class="watch-card">
          <header>
            <div>
              <span class="watch-code">${escapeHtml(item.code)}</span>
              <strong>${escapeHtml(item.company)}</strong>
            </div>
            <button class="mini-button active" data-remove-watch="${escapeHtml(item.code)}" type="button" aria-label="削除">×</button>
          </header>
          <div class="watch-stats">
            <span>開示 ${relatedDisclosures.length}</span>
            <span>予定 ${relatedEvents.length}</span>
          </div>
          <span class="company">${latest ? escapeHtml(latest.title) : "新着なし"}</span>
        </article>
      `;
    })
    .join("");

  el.watchGrid.querySelectorAll("[data-remove-watch]").forEach((button) => {
    button.addEventListener("click", () => {
      state.watchlist = state.watchlist.filter((item) => item.code !== button.dataset.removeWatch);
      persistWatchlist();
      renderAll();
    });
  });
}

function renderConnectors() {
  const modeLabel = {
    demo: "デモ表示中",
    live: "実データ連携中",
    mixed: "一部デモ fallback",
  }[state.dataMode];
  el.dataModeBadge.textContent = modeLabel || "API確認中";

  el.connectorGrid.innerHTML = connectors
    .map(
      (connector) => `
        <article class="connector-card">
          <div class="tag-row">
            <span class="tag">${escapeHtml(connector.status)}</span>
          </div>
          <strong>${escapeHtml(connector.name)}</strong>
          <p>${escapeHtml(connector.text)}</p>
          <a href="${connector.url}" target="_blank" rel="noreferrer">仕様を見る</a>
        </article>
      `,
    )
    .join("");
}

function updateMarketClock() {
  const parts = getTokyoDateParts(new Date());
  const status = getMarketStatus(parts);
  el.marketClock.textContent = parts.time;
  el.marketDot.className = `status-dot ${status.kind}`;
  el.marketStatusLabel.textContent = status.label;
  el.marketSessionText.textContent = status.detail;
}

function getFilteredDisclosures() {
  const query = state.search.toLowerCase();
  return disclosures.filter((item) => {
    const categoryMatch = state.category === "all" || item.category === state.category;
    const text = `${item.code} ${item.company} ${item.title} ${item.category}`.toLowerCase();
    const searchMatch = !query || text.includes(query);
    const priorityMatch =
      state.priority === "all" ||
      (state.priority === "high" && item.priority === "high") ||
      (state.priority === "watch" && isCodeWatched(item.code)) ||
      (state.priority === "unread" && !state.readIds.has(item.id));
    return categoryMatch && searchMatch && priorityMatch;
  });
}

function activateSection(targetId) {
  document.querySelectorAll(".workspace").forEach((section) => {
    section.classList.toggle("active-section", section.id === targetId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
}

function toggleRead(id) {
  if (state.readIds.has(id)) {
    state.readIds.delete(id);
  } else {
    state.readIds.add(id);
  }
  persistReadIds();
  renderDisclosures();
  renderSummary();
}

function toggleWatch(code, company) {
  if (isCodeWatched(code)) {
    state.watchlist = state.watchlist.filter((item) => item.code !== code);
    showToast(`${code}をウォッチから外しました`);
  } else {
    upsertWatch({ code, company });
    showToast(`${code}をウォッチに追加しました`);
  }
  renderAll();
}

function upsertWatch(entry) {
  const normalized = { ...entry, code: normalizeSecurityCode(entry.code) };
  const exists = state.watchlist.some((item) => item.code === normalized.code);
  if (!exists) {
    state.watchlist = [...state.watchlist, normalized].sort((a, b) => a.code.localeCompare(b.code));
    persistWatchlist();
  }
}

function isCodeWatched(code) {
  return state.watchlist.some((item) => item.code === code);
}

function persistReadIds() {
  localStorage.setItem(STORAGE_KEYS.read, JSON.stringify([...state.readIds]));
}

function persistWatchlist() {
  localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(state.watchlist));
}

function eventsForDate(isoDate) {
  const holidayEvent =
    JPX_HOLIDAYS_2026.has(isoDate) && !calendarEvents.some((event) => event.date === isoDate)
      ? [{ id: `holiday-${isoDate}`, date: isoDate, title: "市場休日", type: "holiday", market: "JPX", codes: [] }]
      : [];
  return [...calendarEvents.filter((event) => event.date === isoDate), ...holidayEvent];
}

function getMarketStatus(parts) {
  const date = parts.date;
  const weekday = Number(parts.weekday);
  const [hour, minute] = parts.time.split(":").map(Number);
  const minutes = hour * 60 + minute;
  const closedDay = weekday === 0 || weekday === 6 || JPX_HOLIDAYS_2026.has(date);

  if (closedDay) {
    return { kind: "closed", label: "休場日", detail: "東証の取引はありません" };
  }

  if (minutes >= 9 * 60 && minutes < 11 * 60 + 30) {
    return { kind: "open", label: "前場", detail: "9:00 - 11:30" };
  }

  if (minutes >= 12 * 60 + 30 && minutes < 15 * 60 + 30) {
    return { kind: "open", label: "後場", detail: "12:30 - 15:30" };
  }

  if (minutes >= 11 * 60 + 30 && minutes < 12 * 60 + 30) {
    return { kind: "closed", label: "昼休み", detail: "12:30再開" };
  }

  return { kind: "closed", label: "時間外", detail: "次回 9:00" };
}

function exportCalendar() {
  const body = calendarEvents
    .map((event) => {
      const dt = event.date.replaceAll("-", "");
      return [
        "BEGIN:VEVENT",
        `UID:${event.id}@marketlens-jp`,
        `DTSTAMP:${dt}T000000Z`,
        `DTSTART;VALUE=DATE:${dt}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `DESCRIPTION:${escapeIcs(`${event.market} ${event.codes.join(" ")}`.trim())}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MarketLens JP//JP Market Calendar//JA", body, "END:VCALENDAR"].join(
    "\r\n",
  );
  downloadFile("marketlens-jp-calendar.ics", ics, "text/calendar;charset=utf-8");
  showToast("ICSを書き出しました");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("visible");
  }, 2200);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }
  return response.json();
}

function ensureArray(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function normalizeDisclosure(item, index) {
  const code = normalizeSecurityCode(item.code || item.stockCode || "");
  return {
    id: String(item.id || item.disclosureNumber || `remote-d-${index}`),
    code,
    company: String(item.company || item.companyName || companyNames[code] || "名称未設定"),
    datetime: String(item.datetime || item.disclosedAt || item.dateTime || `${todayIso}T15:30:00+09:00`),
    title: String(item.title || "タイトル未設定"),
    category: String(item.category || item.type || "その他"),
    priority: ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
    tone: ["positive", "negative", "neutral", "mixed"].includes(item.tone) ? item.tone : "neutral",
    metrics: {
      impact: String(item.metrics?.impact || item.impact || "中"),
      speed: String(item.metrics?.speed || item.speed || "-"),
      confidence: String(item.metrics?.confidence || item.confidence || "-"),
    },
    summary: Array.isArray(item.summary) ? item.summary.map(String) : ["詳細を確認してください。"],
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [String(item.category || "その他")],
    url: String(item.url || item.documentUrl || "https://www.release.tdnet.info/"),
  };
}

function normalizeEvent(item, index) {
  return {
    id: String(item.id || `remote-e-${index}`),
    date: String(item.date || todayIso).slice(0, 10),
    title: String(item.title || "予定"),
    type: String(item.type || "market"),
    market: String(item.market || "TSE"),
    codes: Array.isArray(item.codes) ? item.codes.map(String) : [],
  };
}

function normalizeSecurityCode(value) {
  const raw = String(value).trim().toUpperCase();
  if (/^[0-9A-Z]{5}$/.test(raw) && raw.endsWith("0")) {
    return raw.slice(0, 4);
  }
  return raw;
}

function getTokyoDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: weekdayMap[parts.weekday],
  };
}

function parseIsoDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysIso(iso, amount) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatShortDate(iso) {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLongDate(iso) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseIsoDate(iso));
}

function shortEventTitle(title) {
  return title.replace("デモ: ", "").replace("市場休日: ", "");
}

function priorityLabel(priority) {
  return { high: "重要", medium: "確認", low: "通常" }[priority] || priority;
}

function toneLabel(tone) {
  return { positive: "ポジティブ", negative: "ネガティブ", neutral: "中立", mixed: "混在" }[tone] || tone;
}

function eventTypeLabel(type) {
  return { earnings: "決算", market: "市場", disclosure: "開示", holiday: "休場" }[type] || type;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeIcs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}
