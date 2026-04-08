const STORAGE_KEYS = {
  questionText: "sliit.quiz.questionText",
  session: "sliit.quiz.session",
  history: "sliit.quiz.history",
  activeView: "sliit.quiz.activeView",
  selectedSubject: "sliit.quiz.selectedSubject"
};

const AUTO_SYNC_INTERVAL_MS = 12000;
const QUIZ_ROUND_LIMIT = 20;
const QUESTION_TIME_LIMIT_SECONDS = 30;
const DAILY_SESSION_TARGET = 10;

const state = {
  allQuestions: [],
  queue: [],
  index: 0,
  history: [],
  questionStats: {},
  selectedSubject: readStorageValue(STORAGE_KEYS.selectedSubject) || "ALL",
  currentAnswerSet: new Set(),
  timerHandle: null,
  timeLeft: QUESTION_TIME_LIMIT_SECONDS,
  roundLog: [],
  announcedTimes: new Set(),
  sessionStartedAt: new Date().toISOString()
};

const refs = {
  loadDefaultBtn: document.getElementById("loadDefaultBtn"),
  resetBtn: document.getElementById("resetBtn"),
  loadMessage: document.getElementById("loadMessage"),

  tabDashboardBtn: document.getElementById("tabDashboardBtn"),
  tabPracticeBtn: document.getElementById("tabPracticeBtn"),
  dashboardView: document.getElementById("dashboardView"),
  practiceView: document.getElementById("practiceView"),

  totalQuestions: document.getElementById("totalQuestions"),
  answeredCount: document.getElementById("answeredCount"),
  correctCount: document.getElementById("correctCount"),
  accuracy: document.getElementById("accuracy"),
  wrongCount: document.getElementById("wrongCount"),
  skippedCount: document.getElementById("skippedCount"),
  timedOutCount: document.getElementById("timedOutCount"),
  unseenCount: document.getElementById("unseenCount"),
  subjectSelector: document.getElementById("subjectSelector"),
  subjectScopeText: document.getElementById("subjectScopeText"),
  topicBreakdownBody: document.getElementById("topicBreakdownBody"),
  weakTopicsList: document.getElementById("weakTopicsList"),
  practiceWeakBtn: document.getElementById("practiceWeakBtn"),
  reviewMistakesBtn: document.getElementById("reviewMistakesBtn"),
  dailyStreakCount: document.getElementById("dailyStreakCount"),
  sessionTargetText: document.getElementById("sessionTargetText"),
  coverageText: document.getElementById("coverageText"),
  momentumText: document.getElementById("momentumText"),

  quizPlaceholder: document.getElementById("quizPlaceholder"),
  practiceStartOverlay: document.getElementById("practiceStartOverlay"),
  resumeSessionBtn: document.getElementById("resumeSessionBtn"),
  startFreshRoundBtn: document.getElementById("startFreshRoundBtn"),
  overlayWeakBtn: document.getElementById("overlayWeakBtn"),
  overlayReviewBtn: document.getElementById("overlayReviewBtn"),
  quizPanel: document.getElementById("quizPanel"),
  hudSubject: document.getElementById("hudSubject"),
  hudStreak: document.getElementById("hudStreak"),
  hudTarget: document.getElementById("hudTarget"),
  completionRingPath: document.getElementById("completionRingPath"),
  completionRingText: document.getElementById("completionRingText"),
  questionCounter: document.getElementById("questionCounter"),
  metaInfo: document.getElementById("metaInfo"),
  roundProgressText: document.getElementById("roundProgressText"),
  roundProgressFill: document.getElementById("roundProgressFill"),
  timerValue: document.getElementById("timerValue"),
  timerProgressFill: document.getElementById("timerProgressFill"),
  questionText: document.getElementById("questionText"),
  quizHint: document.getElementById("quizHint"),
  optionsContainer: document.getElementById("optionsContainer"),
  submitBtn: document.getElementById("submitBtn"),
  skipBtn: document.getElementById("skipBtn"),
  nextBtn: document.getElementById("nextBtn"),
  feedback: document.getElementById("feedback"),

  roundSummaryModal: document.getElementById("roundSummaryModal"),
  summaryLead: document.getElementById("summaryLead"),
  summaryAnswered: document.getElementById("summaryAnswered"),
  summaryCorrect: document.getElementById("summaryCorrect"),
  summaryAccuracy: document.getElementById("summaryAccuracy"),
  summaryTimedOut: document.getElementById("summaryTimedOut"),
  summaryWeakTopics: document.getElementById("summaryWeakTopics"),
  summaryRetryWeakBtn: document.getElementById("summaryRetryWeakBtn"),
  summaryReviewMistakesBtn: document.getElementById("summaryReviewMistakesBtn"),
  summaryNewRoundBtn: document.getElementById("summaryNewRoundBtn"),
  summaryCloseBtn: document.getElementById("summaryCloseBtn"),
  a11yLive: document.getElementById("a11yLive")
};

function saveStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    // Ignore storage failures (private mode, quota, disabled storage).
  }
}

function readStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function removeStorageValue(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // Ignore storage failures.
  }
}

function normalizeQuestionText(text) {
  return String(text || "").replace(/\r\n/g, "\n").trim();
}

function shuffleArray(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikeCode(text) {
  if (!text || !text.includes("\n")) {
    return false;
  }

  return /(^\s*class\s+\w+|public\s+static\s+void\s+main|System\.out\.println|^\s*if\s*\(|[;{}]\s*$)/m.test(text);
}

function formatQuestionHtml(questionText) {
  const normalized = String(questionText || "").replace(/\r\n/g, "\n").trim();
  if (!normalized.includes("\n")) {
    return `<div class="question-title">${escapeHtml(normalized)}</div>`;
  }

  const [firstLine, ...rest] = normalized.split("\n");
  const trailing = rest.join("\n").trim();
  if (trailing && looksLikeCode(trailing)) {
    return [
      `<div class="question-title">${escapeHtml(firstLine)}</div>`,
      `<pre class="question-code"><code>${escapeHtml(trailing)}</code></pre>`
    ].join("");
  }

  return `<div class="question-title">${escapeHtml(normalized).replace(/\n/g, "<br>")}</div>`;
}

function formatOptionHtml(optionText) {
  const normalized = String(optionText || "").replace(/\r\n/g, "\n");
  if (!normalized.includes("\n")) {
    return escapeHtml(normalized);
  }
  return `<span class="option-multiline">${escapeHtml(normalized).replace(/\n/g, "<br>")}</span>`;
}

function announce(message) {
  if (!refs.a11yLive || !message) {
    return;
  }

  refs.a11yLive.textContent = "";
  setTimeout(() => {
    refs.a11yLive.textContent = message;
  }, 10);
}

function showPracticeOverlay() {
  clearQuestionTimer();
  closeRoundSummaryModal();
  refs.practiceStartOverlay.classList.remove("hidden");
  refs.quizPlaceholder.classList.add("hidden");
  refs.quizPanel.classList.add("hidden");
}

function hidePracticeOverlay() {
  refs.practiceStartOverlay.classList.add("hidden");
  refs.quizPlaceholder.classList.add("hidden");
  refs.quizPanel.classList.remove("hidden");
}

function closeRoundSummaryModal() {
  const modal = refs.roundSummaryModal;
  if (!modal) {
    return;
  }

  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function setFeedback(statusClass, summaryText, reasoningText = "") {
  refs.feedback.className = `feedback ${statusClass}`.trim();

  const summaryHtml = `<p class="feedback-summary">${escapeHtml(summaryText || "")}</p>`;
  const reasoningHtml = reasoningText
    ? `<details class="feedback-details"><summary>Show explanation</summary><p>${escapeHtml(reasoningText).replace(/\n/g, "<br>")}</p></details>`
    : "";

  refs.feedback.innerHTML = `${summaryHtml}${reasoningHtml}`;
}

function refreshOptionSelectionClasses() {
  refs.optionsContainer.querySelectorAll(".option").forEach((opt) => {
    const input = opt.querySelector("input");
    opt.classList.toggle("selected", Boolean(input && input.checked));
  });
}

function getTodayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDailyStreak(history) {
  if (!history.length) {
    return 0;
  }

  const activeDays = new Set(history.map((h) => getTodayKey(h.timestamp || new Date())));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = getTodayKey(cursor);
    if (!activeDays.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function calculateCurrentCorrectStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const status = history[i].status || (history[i].skipped ? "skipped" : (history[i].correct ? "correct" : "wrong"));
    if (status === "correct") {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function calculateRecentMomentum(history, sample = 10) {
  const recent = history
    .slice()
    .reverse()
    .filter((h) => {
      const status = h.status || (h.skipped ? "skipped" : (h.correct ? "correct" : "wrong"));
      return status === "correct" || status === "wrong";
    })
    .slice(0, sample);

  if (!recent.length) {
    return 0;
  }

  const correct = recent.filter((h) => (h.status || (h.correct ? "correct" : "wrong")) === "correct").length;
  return Math.round((correct / recent.length) * 100);
}

function getTodayAnsweredCount(history) {
  const todayKey = getTodayKey();
  return history.filter((h) => getTodayKey(h.timestamp || new Date()) === todayKey).length;
}

function updatePracticeHud() {
  const scopedQuestions = getScopedQuestions();
  const scopedHistory = getScopedHistory();
  const seenIds = new Set(scopedHistory.map((h) => h.id));
  const coverage = scopedQuestions.length ? Math.round((seenIds.size / scopedQuestions.length) * 100) : 0;
  const todayProgress = getTodayAnsweredCount(scopedHistory);
  const streak = calculateCurrentCorrectStreak(scopedHistory);

  refs.hudSubject.textContent = state.selectedSubject === "ALL" ? "All Subjects" : state.selectedSubject;
  refs.hudStreak.textContent = String(streak);
  refs.hudTarget.textContent = `${todayProgress} / ${DAILY_SESSION_TARGET}`;
  refs.completionRingText.textContent = `${coverage}%`;
  refs.completionRingPath.setAttribute("stroke-dasharray", `${coverage}, 100`);
}

function showRoundSummaryModal() {
  const entries = state.roundLog || [];
  const answered = entries.filter((e) => e.status === "correct" || e.status === "wrong").length;
  const correct = entries.filter((e) => e.status === "correct").length;
  const timedOut = entries.filter((e) => e.status === "timeout").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const weakHits = Array.from(new Set(
    entries
      .filter((e) => e.status === "wrong" || e.status === "timeout" || e.status === "skipped")
      .map((e) => `${e.module} | ${e.topic}`)
  ));

  refs.summaryLead.textContent = `You completed ${entries.length} question(s) in this round.`;
  refs.summaryAnswered.textContent = String(answered);
  refs.summaryCorrect.textContent = String(correct);
  refs.summaryAccuracy.textContent = `${accuracy}%`;
  refs.summaryTimedOut.textContent = String(timedOut);
  refs.summaryWeakTopics.textContent = weakHits.length
    ? `Weak topics hit: ${weakHits.slice(0, 4).join(", ")}`
    : "Weak topics hit: None";

  refs.summaryRetryWeakBtn.disabled = refs.practiceWeakBtn.disabled;
  refs.summaryReviewMistakesBtn.disabled = refs.reviewMistakesBtn.disabled;

  const modal = refs.roundSummaryModal;
  if (!modal) {
    return;
  }

  if (typeof modal.showModal === "function") {
    if (!modal.open) {
      modal.showModal();
    }
  } else {
    modal.setAttribute("open", "open");
  }
}

function getSeenCount(stat) {
  return (stat.attempts || 0) + (stat.skipped || 0) + (stat.timeout || 0);
}

function weightedPickIndex(items, weightFn) {
  const weights = items.map((item) => Math.max(0.0001, Number(weightFn(item)) || 0.0001));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let needle = Math.random() * total;

  for (let i = 0; i < items.length; i += 1) {
    needle -= weights[i];
    if (needle <= 0) {
      return i;
    }
  }
  return items.length - 1;
}

function takeWeighted(pool, count, weightFn) {
  const source = [...pool];
  const picked = [];

  while (source.length && picked.length < count) {
    const idx = weightedPickIndex(source, weightFn);
    picked.push(source.splice(idx, 1)[0]);
  }

  return picked;
}

function buildAdaptiveQueue(questions, questionStats, limit = QUIZ_ROUND_LIMIT) {
  const desired = Math.min(limit, questions.length);
  if (desired <= 0) {
    return [];
  }

  const unseen = [];
  const weak = [];
  const review = [];
  const mastered = [];

  for (const q of questions) {
    const stat = questionStats[q.id] || {};
    const seen = getSeenCount(stat);
    if (!seen) {
      unseen.push(q);
      continue;
    }

    if ((stat.wrong || 0) > 0 || (stat.skipped || 0) > 0 || (stat.timeout || 0) > 0) {
      weak.push(q);
      continue;
    }

    if ((stat.correct || 0) >= 2) {
      mastered.push(q);
    } else {
      review.push(q);
    }
  }

  // Coverage first: reserve most slots for unseen while still reinforcing weak/review items.
  const minWeakSlots = weak.length ? Math.min(weak.length, Math.max(2, Math.floor(desired * 0.15))) : 0;
  const minReviewSlots = review.length ? Math.min(review.length, Math.max(1, Math.floor(desired * 0.1))) : 0;

  const unseenTarget = unseen.length
    ? Math.min(unseen.length, Math.max(0, desired - minWeakSlots - minReviewSlots))
    : 0;

  let remaining = desired - unseenTarget;

  let weakTarget = 0;
  if (remaining > 0 && weak.length) {
    const desiredWeak = Math.max(minWeakSlots, Math.ceil(remaining * 0.7));
    weakTarget = Math.min(weak.length, desiredWeak, remaining);
    remaining -= weakTarget;
  }

  let reviewTarget = 0;
  if (remaining > 0 && review.length) {
    const desiredReview = Math.max(minReviewSlots, Math.ceil(remaining * 0.6));
    reviewTarget = Math.min(review.length, desiredReview, remaining);
    remaining -= reviewTarget;
  }

  let masteredTarget = 0;
  if (remaining > 0 && mastered.length) {
    masteredTarget = Math.min(mastered.length, remaining);
    remaining -= masteredTarget;
  }

  const pickedUnseen = takeWeighted(unseen, unseenTarget, () => 1 + Math.random());
  const pickedWeak = takeWeighted(weak, weakTarget, (q) => {
    const stat = questionStats[q.id] || {};
    const seen = getSeenCount(stat);
    const wrongBoost = (stat.wrong || 0) * 4;
    const skippedBoost = (stat.skipped || 0) * 3;
    const timeoutBoost = (stat.timeout || 0) * 3;
    const freshnessBoost = 2 / (seen + 1);
    return 1 + wrongBoost + skippedBoost + timeoutBoost + freshnessBoost + Math.random();
  });
  const pickedReview = takeWeighted(review, reviewTarget, (q) => {
    const stat = questionStats[q.id] || {};
    const seen = getSeenCount(stat);
    const confidencePenalty = (stat.correct || 0) * 0.4;
    return 1 + 2 / (seen + 1) + Math.max(0, 1 - confidencePenalty) + Math.random();
  });
  const pickedMastered = takeWeighted(mastered, masteredTarget, (q) => {
    const stat = questionStats[q.id] || {};
    const seen = getSeenCount(stat);
    return 0.2 + 0.5 / (seen + 1) + (Math.random() * 0.2);
  });

  const selectedIds = new Set([...pickedUnseen, ...pickedWeak, ...pickedReview, ...pickedMastered].map((q) => q.id));
  const remainderPool = questions.filter((q) => !selectedIds.has(q.id));
  const needed = Math.max(0, desired - (pickedUnseen.length + pickedWeak.length + pickedReview.length + pickedMastered.length));
  const pickedRemainder = takeWeighted(remainderPool, needed, (q) => {
    const stat = questionStats[q.id] || {};
    const seen = getSeenCount(stat);
    const unseenBoost = seen === 0 ? 8 : 0;
    const weakSignal = (stat.wrong || 0) * 3 + (stat.skipped || 0) * 2 + (stat.timeout || 0) * 2;
    const isMastered = (stat.correct || 0) >= 2 && weakSignal === 0;
    const masteredPenalty = isMastered ? 0.1 : 1;
    return (1 + unseenBoost + weakSignal + 1 / (seen + 1) + Math.random()) * masteredPenalty;
  });

  return shuffleArray([...pickedUnseen, ...pickedWeak, ...pickedReview, ...pickedMastered, ...pickedRemainder]);
}

function rebuildStatsFromHistory(history) {
  const stats = {};
  for (const h of history || []) {
    if (!h || !h.id) {
      continue;
    }

    if (!stats[h.id]) {
      stats[h.id] = { attempts: 0, correct: 0, wrong: 0, skipped: 0, timeout: 0, lastSeen: null };
    }

    const s = stats[h.id];
    const status = h.status || (h.skipped ? "skipped" : (h.correct ? "correct" : "wrong"));
    if (status === "skipped") {
      s.skipped += 1;
    } else if (status === "timeout") {
      s.timeout += 1;
    } else if (status === "correct") {
      s.attempts += 1;
      s.correct += 1;
    } else {
      s.attempts += 1;
      s.wrong += 1;
    }
    s.lastSeen = h.timestamp || new Date().toISOString();
  }
  return stats;
}

function recordQuestionOutcome(question, status, selected = "") {
  if (!state.questionStats[question.id]) {
    state.questionStats[question.id] = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      timeout: 0,
      lastSeen: null
    };
  }

  const stat = state.questionStats[question.id];
  if (status === "skipped") {
    stat.skipped += 1;
  } else if (status === "timeout") {
    stat.timeout += 1;
  } else if (status === "correct") {
    stat.attempts += 1;
    stat.correct += 1;
  } else {
    stat.attempts += 1;
    stat.wrong += 1;
  }
  stat.lastSeen = new Date().toISOString();

  state.history.push({
    id: question.id,
    module: question.module,
    topic: question.topic,
    status,
    correct: status === "correct",
    skipped: status === "skipped",
    selected,
    timestamp: stat.lastSeen
  });
}

function startNextAdaptiveRound(message = "New adaptive round started.") {
  const scopedQuestions = getScopedQuestions();
  if (!scopedQuestions.length) {
    refs.loadMessage.textContent = "No questions available for the selected subject.";
    state.queue = [];
    state.index = 0;
    updateRoundProgressUI();
    persistSession();
    return;
  }

  state.queue = buildAdaptiveQueue(scopedQuestions, state.questionStats, QUIZ_ROUND_LIMIT);
  state.index = 0;
  state.roundLog = [];
  closeRoundSummaryModal();
  refs.loadMessage.textContent = `${message} Showing ${state.queue.length} questions.`;
  hidePracticeOverlay();
  renderQuestion();
  persistSession();
}

function getScopedQuestions() {
  if (state.selectedSubject === "ALL") {
    return state.allQuestions;
  }

  return state.allQuestions.filter((q) => q.module === state.selectedSubject);
}

function getScopedHistory() {
  if (state.selectedSubject === "ALL") {
    return state.history;
  }

  return state.history.filter((h) => h.module === state.selectedSubject);
}

function refreshSubjectSelector() {
  const modules = Array.from(new Set(state.allQuestions.map((q) => q.module).filter(Boolean))).sort();
  const options = ["ALL", ...modules];

  if (!options.includes(state.selectedSubject)) {
    state.selectedSubject = "ALL";
  }

  refs.subjectSelector.innerHTML = "";
  for (const moduleName of options) {
    const opt = document.createElement("option");
    opt.value = moduleName;
    opt.textContent = moduleName === "ALL" ? "All Subjects" : moduleName;
    refs.subjectSelector.appendChild(opt);
  }
  refs.subjectSelector.value = state.selectedSubject;
  saveStorageValue(STORAGE_KEYS.selectedSubject, state.selectedSubject);

  refs.subjectScopeText.textContent = state.selectedSubject === "ALL"
    ? "Showing all subjects."
    : `Showing subject: ${state.selectedSubject}`;
}

function rebuildScopedQueue(renderNow = false) {
  const scopedQuestions = getScopedQuestions();
  state.queue = buildAdaptiveQueue(scopedQuestions, state.questionStats, QUIZ_ROUND_LIMIT);
  state.index = 0;
  state.roundLog = [];

  if (renderNow) {
    renderQuestion();
  } else {
    updateRoundProgressUI();
  }

  persistSession();
}

function onSubjectSelectorChange() {
  state.selectedSubject = refs.subjectSelector.value || "ALL";
  saveStorageValue(STORAGE_KEYS.selectedSubject, state.selectedSubject);
  refreshSubjectSelector();
  updateDashboard();

  const shouldRenderNow = refs.practiceView.classList.contains("active") && !refs.quizPanel.classList.contains("hidden");
  rebuildScopedQueue(shouldRenderNow);

  if (!getScopedQuestions().length) {
    refs.loadMessage.textContent = "Selected subject has no questions in the current dataset.";
    return;
  }

  refs.loadMessage.textContent = state.selectedSubject === "ALL"
    ? `Subject set to All Subjects. Adaptive round: ${state.queue.length}.`
    : `Subject set to ${state.selectedSubject}. Adaptive round: ${state.queue.length}.`;
}

function clearQuestionTimer() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function isPracticeTimerContext() {
  return refs.practiceView.classList.contains("active")
    && !refs.quizPanel.classList.contains("hidden")
    && refs.practiceStartOverlay.classList.contains("hidden");
}

function updateTimerUI() {
  const remaining = Math.max(0, state.timeLeft);
  refs.timerValue.textContent = String(remaining);

  const pct = Math.max(0, Math.min(100, (remaining / QUESTION_TIME_LIMIT_SECONDS) * 100));
  refs.timerProgressFill.style.width = `${pct}%`;

  if ((remaining === 10 || remaining === 5) && !state.announcedTimes.has(remaining)) {
    state.announcedTimes.add(remaining);
    announce(`${remaining} seconds remaining.`);
  }
}

function updateRoundProgressUI() {
  const total = state.queue.length;
  const justSubmittedCurrent =
    getCurrentQuestion() &&
    !refs.nextBtn.classList.contains("hidden") &&
    refs.nextBtn.textContent !== "Start Next Round";
  const completedBase = state.index + (justSubmittedCurrent ? 1 : 0);
  const completed = Math.min(completedBase, total);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  refs.roundProgressText.textContent = `Progress ${completed} / ${total}`;
  refs.roundProgressFill.style.width = `${pct}%`;
}

function onQuestionTimedOut() {
  const q = getCurrentQuestion();
  if (!q) {
    return;
  }

  clearQuestionTimer();
  state.timeLeft = 0;
  updateTimerUI();

  // Timeout is tracked as timeout (not correct/wrong), then answer is shown for learning.
  recordQuestionOutcome(q, "timeout");
  state.roundLog.push({ id: q.id, module: q.module, topic: q.topic, status: "timeout" });

  lockOptions();
  highlightAnswers(state.currentAnswerSet, new Set());

  const sortedAnswers = Array.from(state.currentAnswerSet).sort().join(", ");
  setFeedback(
    "bad",
    `Time is up. Correct answers: ${sortedAnswers}. This timeout is not counted as a correct answer.`,
    q.reasoning
  );
  announce("Time is up. Review the answer and continue.");

  refs.submitBtn.classList.add("hidden");
  refs.skipBtn.classList.add("hidden");
  refs.nextBtn.classList.remove("hidden");
  refs.submitBtn.disabled = true;
  refs.skipBtn.disabled = true;
  refs.nextBtn.disabled = false;

  refs.loadMessage.textContent = `Time up on ${q.id}. Review the answer, then continue.`;
  updateRoundProgressUI();
  updateDashboard();
  persistSession();
}

function startQuestionTimer() {
  if (!isPracticeTimerContext()) {
    clearQuestionTimer();
    return;
  }

  clearQuestionTimer();
  state.timeLeft = QUESTION_TIME_LIMIT_SECONDS;
  state.announcedTimes = new Set();
  updateTimerUI();

  state.timerHandle = setInterval(() => {
    if (!isPracticeTimerContext()) {
      clearQuestionTimer();
      return;
    }

    state.timeLeft -= 1;
    updateTimerUI();
    if (state.timeLeft <= 0) {
      onQuestionTimedOut();
    }
  }, 1000);
}

function setActiveView(viewName, persist = true) {
  const dashboardActive = viewName === "dashboard";
  const practiceActive = viewName === "practice";

  refs.dashboardView.classList.toggle("active", dashboardActive);
  refs.practiceView.classList.toggle("active", practiceActive);
  refs.tabDashboardBtn.classList.toggle("active", dashboardActive);
  refs.tabPracticeBtn.classList.toggle("active", practiceActive);

  if (!practiceActive) {
    clearQuestionTimer();
    closeRoundSummaryModal();
  } else {
    const hasCurrentQuestion = Boolean(getCurrentQuestion());
    const awaitingAnswer = refs.nextBtn.classList.contains("hidden");
    const overlayHidden = refs.practiceStartOverlay.classList.contains("hidden");
    if (hasCurrentQuestion && awaitingAnswer && overlayHidden && !state.timerHandle) {
      startQuestionTimer();
    }
  }

  if (persist) {
    saveStorageValue(STORAGE_KEYS.activeView, viewName);
  }
}

function showPracticeState(hasQuestions) {
  if (!hasQuestions) {
    refs.practiceStartOverlay.classList.add("hidden");
  }

  const overlayVisible = !refs.practiceStartOverlay.classList.contains("hidden");
  refs.quizPlaceholder.classList.toggle("hidden", hasQuestions);
  refs.quizPanel.classList.toggle("hidden", !hasQuestions || overlayVisible);
}

function parseQuestionText(text) {
  const blockRegex = /QUESTION_START([\s\S]*?)QUESTION_END/g;
  const questions = [];
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const block = match[1].trim();
    const lines = block.split(/\r?\n/);
    const item = {};
    let currentKey = null;

    for (const line of lines) {
      const fieldMatch = line.match(/^(ID|MODULE|TOPIC|SUBTOPIC|TYPE|DIFFICULTY|EXPLANATION_LEVEL|QUESTION|OPTION_[A-F]|ANSWER|REASONING):\s*(.*)$/);
      if (fieldMatch) {
        currentKey = fieldMatch[1].toUpperCase();
        item[currentKey] = fieldMatch[2];
        continue;
      }

      if (currentKey) {
        item[currentKey] = `${item[currentKey]}\n${line}`;
      }
    }

    for (const key of Object.keys(item)) {
      item[key] = String(item[key]).trim();
    }

    const required = ["ID", "MODULE", "TOPIC", "QUESTION", "ANSWER"];
    for (const field of required) {
      if (!item[field]) {
        throw new Error(`Missing ${field} in one question block.`);
      }
    }

    const options = [];
    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
      const key = `OPTION_${letter}`;
      if (item[key]) {
        options.push({
          key: letter,
          text: item[key]
        });
      }
    }

    if (options.length < 2) {
      throw new Error(`Question ${item.ID} must have at least 2 options.`);
    }

    const answerSet = new Set(
      item.ANSWER.split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    );

    questions.push({
      id: item.ID,
      module: item.MODULE,
      topic: item.TOPIC,
      subtopic: item.SUBTOPIC || "General",
      type: (item.TYPE || (answerSet.size > 1 ? "MSQ" : "MCQ")).toUpperCase(),
      difficulty: item.DIFFICULTY || "Unknown",
      question: item.QUESTION,
      options,
      answers: answerSet,
      reasoning: item.REASONING || "No reasoning provided."
    });
  }

  if (!questions.length) {
    throw new Error("No valid question blocks found.");
  }

  return questions;
}

function serializeQuestions(questions) {
  return questions.map((q) => ({
    ...q,
    answers: Array.from(q.answers)
  }));
}

function deserializeQuestions(questions) {
  return (questions || []).map((q) => ({
    ...q,
    type: (q.type || ((Array.isArray(q.answers) && q.answers.length > 1) ? "MSQ" : "MCQ")).toUpperCase(),
    answers: new Set(Array.isArray(q.answers) ? q.answers : [])
  }));
}

function persistSession() {
  if (!state.allQuestions.length) {
    removeStorageValue(STORAGE_KEYS.session);
    removeStorageValue(STORAGE_KEYS.history);
    return;
  }

  const payload = {
    allQuestions: serializeQuestions(state.allQuestions),
    queueIds: state.queue.map((q) => q.id),
    index: state.index,
    history: state.history,
    questionStats: state.questionStats
  };

  saveStorageValue(STORAGE_KEYS.session, JSON.stringify(payload));
  saveStorageValue(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function restoreSessionFromStorage() {
  const rawSession = readStorageValue(STORAGE_KEYS.session);
  if (!rawSession) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawSession);
    const allQuestions = deserializeQuestions(parsed.allQuestions);
    if (!allQuestions.length) {
      return false;
    }

    state.allQuestions = allQuestions;
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
    state.questionStats = parsed.questionStats || rebuildStatsFromHistory(state.history);
    refreshSubjectSelector();

    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const queue = (parsed.queueIds || []).map((id) => byId.get(id)).filter(Boolean);
    const scopedQuestionIds = new Set(getScopedQuestions().map((q) => q.id));
    const scopedQueue = queue.filter((q) => scopedQuestionIds.has(q.id));
    state.queue = (scopedQueue.length && scopedQueue.length <= QUIZ_ROUND_LIMIT)
      ? scopedQueue
      : buildAdaptiveQueue(getScopedQuestions(), state.questionStats, QUIZ_ROUND_LIMIT);

    const maxIndex = Math.max(state.queue.length - 1, 0);
    const parsedIndex = Number(parsed.index);
    state.index = Number.isFinite(parsedIndex) ? Math.min(Math.max(parsedIndex, 0), maxIndex) : 0;

    showPracticeState(true);
    updateDashboard();
    renderQuestion();
    refs.loadMessage.textContent = "Restored previous session from local browser storage.";
    return true;
  } catch (err) {
    removeStorageValue(STORAGE_KEYS.session);
  }

  const storedText = readStorageValue(STORAGE_KEYS.questionText);
  if (!storedText) {
    return false;
  }

  try {
    const questions = parseQuestionText(storedText);
    const rawHistory = readStorageValue(STORAGE_KEYS.history);
    state.history = rawHistory ? JSON.parse(rawHistory) : [];
    state.questionStats = rebuildStatsFromHistory(state.history);
    state.allQuestions = questions;
    refreshSubjectSelector();
    state.queue = buildAdaptiveQueue(getScopedQuestions(), state.questionStats, QUIZ_ROUND_LIMIT);
    state.index = 0;

    showPracticeState(true);
    updateDashboard();
    renderQuestion();
    refs.loadMessage.textContent = "Restored question set from local browser storage.";
    persistSession();
    return true;
  } catch (err) {
    removeStorageValue(STORAGE_KEYS.questionText);
    removeStorageValue(STORAGE_KEYS.history);
    return false;
  }
}

function setsAreEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const v of a) {
    if (!b.has(v)) {
      return false;
    }
  }
  return true;
}

function getCurrentQuestion() {
  return state.queue[state.index];
}

function renderQuestion() {
  const q = getCurrentQuestion();
  updateRoundProgressUI();
  updatePracticeHud();

  if (!q) {
    clearQuestionTimer();
    state.timeLeft = 0;
    updateTimerUI();
    refs.questionText.innerHTML = '<div class="question-title">No more questions in this set.</div>';
    refs.optionsContainer.innerHTML = "";
    refs.submitBtn.classList.add("hidden");
    refs.skipBtn.classList.add("hidden");
    refs.nextBtn.classList.remove("hidden");
    refs.nextBtn.textContent = "Start Next Round";
    refs.submitBtn.disabled = true;
    refs.skipBtn.disabled = true;
    refs.nextBtn.disabled = false;
    refs.quizHint.textContent = "Press Space to start the next adaptive round.";
    setFeedback("", "Round completed. Start the next adaptive round to continue.");
    state.currentAnswerSet = new Set();
    showRoundSummaryModal();
    return;
  }

  refs.questionCounter.textContent = `Question ${state.index + 1} / ${state.queue.length}`;
  refs.metaInfo.textContent = `${q.module} | ${q.topic} | ${q.subtopic} | ${q.difficulty}`;
  refs.questionText.innerHTML = formatQuestionHtml(q.question);
  refs.quizHint.textContent = q.type === "MSQ"
    ? "This is MSQ. Select one or more answers, then submit. Space submits after selection, and Space again moves next."
    : "This is MCQ. Select one answer to auto-submit. Space moves to next after feedback.";

  const shuffledOptions = shuffleArray([...q.options]);
  const displayLetters = ["A", "B", "C", "D", "E", "F"];
  const displayOptions = shuffledOptions.map((opt, idx) => ({
    displayKey: displayLetters[idx],
    originalKey: opt.key,
    text: opt.text
  }));
  state.currentAnswerSet = new Set(
    displayOptions
      .filter((opt) => q.answers.has(opt.originalKey))
      .map((opt) => opt.displayKey)
  );

  refs.optionsContainer.innerHTML = "";
  displayOptions.forEach((opt) => {
    const div = document.createElement("div");
    div.className = "option";
    div.dataset.key = opt.displayKey;

    const id = `opt-${q.id}-${opt.displayKey}`;
    const inputType = q.type === "MSQ" ? "checkbox" : "radio";
    div.innerHTML = `
      <label for="${id}">
        <input id="${id}" type="${inputType}" name="question-${q.id}" value="${opt.displayKey}" />
        <strong>${opt.displayKey}.</strong> ${formatOptionHtml(opt.text)}
      </label>
    `;
    refs.optionsContainer.appendChild(div);
  });

  refreshOptionSelectionClasses();

  const isMsq = q.type === "MSQ";
  refs.submitBtn.classList.toggle("hidden", !isMsq);
  refs.skipBtn.classList.remove("hidden");
  refs.nextBtn.classList.add("hidden");
  refs.nextBtn.textContent = "Next Question";
  refs.submitBtn.disabled = !isMsq;
  refs.skipBtn.disabled = false;
  refs.nextBtn.disabled = true;
  refs.feedback.className = "feedback";
  refs.feedback.innerHTML = "";
  startQuestionTimer();
}

function onOptionSelectionChange(event) {
  const q = getCurrentQuestion();
  if (!q) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.type !== "radio") {
    refreshOptionSelectionClasses();
    return;
  }

  refreshOptionSelectionClasses();

  // One-tap MCQ flow: selecting an option submits immediately.
  onSubmitAnswer();
}

function getSelectedAnswers() {
  const checked = refs.optionsContainer.querySelectorAll("input:checked");
  return new Set(Array.from(checked).map((node) => node.value.toUpperCase()));
}

function lockOptions() {
  refs.optionsContainer.querySelectorAll("input").forEach((el) => {
    el.disabled = true;
  });
  refreshOptionSelectionClasses();
}

function highlightAnswers(correctSet, selectedSet) {
  refs.optionsContainer.querySelectorAll(".option").forEach((opt) => {
    const key = opt.dataset.key;
    const isCorrect = correctSet.has(key);
    const isSelected = selectedSet.has(key);

    if (isCorrect) {
      opt.classList.add("correct");
    } else if (isSelected && !isCorrect) {
      opt.classList.add("wrong");
    }
  });
}

function onSubmitAnswer() {
  const q = getCurrentQuestion();
  if (!q) {
    return;
  }

  const selected = getSelectedAnswers();
  if (!selected.size) {
    setFeedback("bad", "Select at least one option before submitting.");
    return;
  }

  const isCorrect = setsAreEqual(selected, state.currentAnswerSet);

  clearQuestionTimer();
  recordQuestionOutcome(q, isCorrect ? "correct" : "wrong", Array.from(selected).sort().join(","));
  state.roundLog.push({ id: q.id, module: q.module, topic: q.topic, status: isCorrect ? "correct" : "wrong" });

  lockOptions();
  highlightAnswers(state.currentAnswerSet, selected);

  const sortedAnswers = Array.from(state.currentAnswerSet).sort().join(", ");
  setFeedback(
    isCorrect ? "good" : "bad",
    isCorrect ? "Correct answer." : `Incorrect. Correct answers: ${sortedAnswers}`,
    q.reasoning
  );
  announce(isCorrect ? "Correct answer." : "Incorrect answer.");

  refs.submitBtn.classList.add("hidden");
  refs.skipBtn.classList.add("hidden");
  refs.nextBtn.classList.remove("hidden");
  refs.submitBtn.disabled = true;
  refs.skipBtn.disabled = true;
  refs.nextBtn.disabled = false;

  updateRoundProgressUI();
  updateDashboard();
  persistSession();
}

function onSkipQuestion() {
  const q = getCurrentQuestion();
  if (!q) {
    return;
  }

  clearQuestionTimer();
  recordQuestionOutcome(q, "skipped");
  state.roundLog.push({ id: q.id, module: q.module, topic: q.topic, status: "skipped" });
  state.index += 1;
  refs.loadMessage.textContent = `Skipped ${q.id}.`;
  updateDashboard();
  renderQuestion();
  persistSession();
}

function onNextQuestion() {
  clearQuestionTimer();
  closeRoundSummaryModal();

  if (!getCurrentQuestion()) {
    startNextAdaptiveRound();
    return;
  }

  state.index += 1;
  renderQuestion();
  persistSession();
}

function calculateTopicStats() {
  const map = new Map();
  const scopedHistory = getScopedHistory();

  for (const h of scopedHistory) {
    const key = `${h.module}::${h.topic}`;
    if (!map.has(key)) {
      map.set(key, { module: h.module, topic: h.topic, attempts: 0, correct: 0, wrong: 0, skipped: 0, timeout: 0 });
    }
    const item = map.get(key);

    const status = h.status || (h.skipped ? "skipped" : (h.correct ? "correct" : "wrong"));
    if (status === "correct") {
      item.attempts += 1;
      item.correct += 1;
    } else if (status === "wrong") {
      item.attempts += 1;
      item.wrong += 1;
    } else if (status === "timeout") {
      item.timeout += 1;
    } else {
      item.skipped += 1;
    }
  }

  return Array.from(map.values()).map((t) => ({
    ...t,
    accuracy: t.attempts ? t.correct / t.attempts : 0
  }));
}

function updateDashboard() {
  const scopedQuestions = getScopedQuestions();
  const scopedHistory = getScopedHistory();

  const answered = scopedHistory.filter((h) =>
    h.status === "correct" || h.status === "wrong" || (!h.status && !h.skipped)
  ).length;
  const correct = scopedHistory.filter((h) => h.status === "correct" || (!h.status && h.correct)).length;
  const wrong = scopedHistory.filter((h) => h.status === "wrong" || (!h.status && !h.correct && !h.skipped)).length;
  const skipped = scopedHistory.filter((h) => h.status === "skipped" || (!h.status && h.skipped)).length;
  const timedOut = scopedHistory.filter((h) => h.status === "timeout").length;
  const seenIds = new Set(scopedHistory.map((h) => h.id));
  const unseen = Math.max(0, scopedQuestions.length - seenIds.size);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  refs.totalQuestions.textContent = String(scopedQuestions.length);
  refs.answeredCount.textContent = String(answered);
  refs.correctCount.textContent = String(correct);
  refs.accuracy.textContent = `${accuracy}%`;
  refs.wrongCount.textContent = String(wrong);
  refs.skippedCount.textContent = String(skipped);
  refs.timedOutCount.textContent = String(timedOut);
  refs.unseenCount.textContent = String(unseen);

  const dailyStreak = calculateDailyStreak(scopedHistory);
  const todayProgress = getTodayAnsweredCount(scopedHistory);
  const coverage = scopedQuestions.length ? Math.round(((scopedQuestions.length - unseen) / scopedQuestions.length) * 100) : 0;
  const momentum = calculateRecentMomentum(scopedHistory);
  refs.dailyStreakCount.textContent = String(dailyStreak);
  refs.sessionTargetText.textContent = `${todayProgress} / ${DAILY_SESSION_TARGET}`;
  refs.coverageText.textContent = `${coverage}%`;
  refs.momentumText.textContent = `${momentum}%`;

  const topicStats = calculateTopicStats();
  const weakTopics = topicStats.filter((t) => t.attempts >= 2 && t.accuracy < 0.6);

  refs.topicBreakdownBody.innerHTML = "";
  if (!topicStats.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6">No attempts yet.</td>';
    refs.topicBreakdownBody.appendChild(tr);
  } else {
    topicStats
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 12)
      .forEach((t) => {
        const tr = document.createElement("tr");
        tr.innerHTML = [
          `<td>${t.module} | ${t.topic}</td>`,
          `<td>${t.attempts}</td>`,
          `<td>${t.correct}</td>`,
          `<td>${t.wrong}</td>`,
          `<td>${t.skipped + t.timeout}</td>`,
          `<td>${Math.round(t.accuracy * 100)}%</td>`
        ].join("");
        refs.topicBreakdownBody.appendChild(tr);
      });
  }

  refs.weakTopicsList.innerHTML = "";
  if (!weakTopics.length) {
    const li = document.createElement("li");
    li.textContent = "No weak topics yet (need at least 2 attempts and below 60%).";
    refs.weakTopicsList.appendChild(li);
    refs.practiceWeakBtn.disabled = true;
    refs.overlayWeakBtn.disabled = true;
  } else {
    weakTopics
      .sort((a, b) => a.accuracy - b.accuracy)
      .forEach((t) => {
        const li = document.createElement("li");
        li.textContent = `${t.module} | ${t.topic} - ${Math.round(t.accuracy * 100)}% (${t.correct}/${t.attempts})`;
        refs.weakTopicsList.appendChild(li);
      });
    refs.practiceWeakBtn.disabled = false;
    refs.overlayWeakBtn.disabled = false;
  }

  const hasMistakes = scopedHistory.some((h) => {
    const status = h.status || (h.skipped ? "skipped" : (h.correct ? "correct" : "wrong"));
    return status === "wrong" || status === "skipped" || status === "timeout";
  });
  refs.reviewMistakesBtn.disabled = !hasMistakes;
  refs.overlayReviewBtn.disabled = !hasMistakes;

  updatePracticeHud();
}

function loadQuestionSet(questions, sourceText, options = {}) {
  const preserveHistory = Boolean(options.preserveHistory);
  const keepView = Boolean(options.keepView);

  clearQuestionTimer();
  state.timeLeft = QUESTION_TIME_LIMIT_SECONDS;

  const previousHistory = preserveHistory ? [...state.history] : [];
  const previousStats = preserveHistory ? { ...state.questionStats } : {};
  const validQuestionIds = new Set(questions.map((q) => q.id));

  state.allQuestions = questions;
  refreshSubjectSelector();
  state.queue = buildAdaptiveQueue(getScopedQuestions(), preserveHistory ? previousStats : {}, QUIZ_ROUND_LIMIT);
  state.index = 0;
  state.roundLog = [];
  state.history = preserveHistory
    ? previousHistory.filter((h) => validQuestionIds.has(h.id))
    : [];
  state.questionStats = preserveHistory
    ? Object.fromEntries(Object.entries(previousStats).filter(([id]) => validQuestionIds.has(id)))
    : {};

  if (typeof sourceText === "string") {
    saveStorageValue(STORAGE_KEYS.questionText, sourceText);
  }

  showPracticeState(true);
  refs.loadMessage.textContent = `Loaded ${questions.length} questions. Adaptive round: ${state.queue.length} questions.`;

  updateDashboard();
  renderQuestion();
  if (!keepView) {
    setActiveView("practice");
    showPracticeOverlay();
  }
  persistSession();
}

function resetSession() {
  clearQuestionTimer();
  closeRoundSummaryModal();

  state.allQuestions = [];
  state.queue = [];
  state.index = 0;
  state.history = [];
  state.questionStats = {};
  state.timeLeft = QUESTION_TIME_LIMIT_SECONDS;
  state.roundLog = [];

  showPracticeState(false);
  refs.loadMessage.textContent = "Session reset. Local saved data was cleared.";

  removeStorageValue(STORAGE_KEYS.questionText);
  removeStorageValue(STORAGE_KEYS.session);
  removeStorageValue(STORAGE_KEYS.history);

  updateDashboard();
  updateRoundProgressUI();
  updateTimerUI();
  setActiveView("dashboard");
}

function practiceWeakTopics() {
  const weakTopicKeys = new Set(
    calculateTopicStats()
      .filter((t) => t.attempts >= 2 && t.accuracy < 0.6)
      .map((t) => `${t.module}::${t.topic}`)
  );

  const weakQuestions = state.allQuestions.filter((q) => weakTopicKeys.has(`${q.module}::${q.topic}`));
  if (!weakQuestions.length) {
    refs.loadMessage.textContent = "No weak-topic question pool available yet.";
    return;
  }

  state.queue = buildAdaptiveQueue(weakQuestions, state.questionStats, QUIZ_ROUND_LIMIT);
  state.index = 0;
  state.roundLog = [];
  refs.loadMessage.textContent = `Practice mode: ${state.queue.length} weak-topic questions loaded.`;
  closeRoundSummaryModal();
  hidePracticeOverlay();
  renderQuestion();
  setActiveView("practice");
  persistSession();
}

function practiceMistakes() {
  const scopedHistory = getScopedHistory();
  const mistakeIds = [];

  for (let i = scopedHistory.length - 1; i >= 0; i -= 1) {
    const h = scopedHistory[i];
    const status = h.status || (h.skipped ? "skipped" : (h.correct ? "correct" : "wrong"));
    if (status === "wrong" || status === "skipped" || status === "timeout") {
      if (!mistakeIds.includes(h.id)) {
        mistakeIds.push(h.id);
      }
    }
    if (mistakeIds.length >= QUIZ_ROUND_LIMIT * 2) {
      break;
    }
  }

  const byId = new Map(getScopedQuestions().map((q) => [q.id, q]));
  const candidates = mistakeIds
    .map((id) => byId.get(id))
    .filter(Boolean);

  if (!candidates.length) {
    refs.loadMessage.textContent = "No mistakes found yet in this subject scope.";
    return;
  }

  state.queue = buildAdaptiveQueue(candidates, state.questionStats, QUIZ_ROUND_LIMIT);
  state.index = 0;
  state.roundLog = [];
  refs.loadMessage.textContent = `Review mode: ${state.queue.length} mistakes-focused questions loaded.`;
  hidePracticeOverlay();
  renderQuestion();
  setActiveView("practice");
  persistSession();
}

async function loadFromProjectFile(showFailureMessage = true, options = {}) {
  try {
    const response = await fetch("mcq-data.txt", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const questions = parseQuestionText(text);
    const mergedOptions = {
      preserveHistory: true,
      ...options
    };
    loadQuestionSet(questions, text, mergedOptions);
    refs.loadMessage.textContent = `Loaded ${questions.length} questions from mcq-data.txt. Adaptive round: ${state.queue.length}.`;
  } catch (err) {
    if (showFailureMessage) {
      refs.loadMessage.textContent = [
        "Could not auto-load mcq-data.txt.",
        "If you opened index.html directly, run a local server to allow file access."
      ].join(" ");
    }
  }
}

async function autoSyncProjectFile() {
  try {
    const response = await fetch("mcq-data.txt", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const text = await response.text();
    const normalizedIncoming = normalizeQuestionText(text);
    const normalizedSaved = normalizeQuestionText(readStorageValue(STORAGE_KEYS.questionText));

    if (!normalizedIncoming || normalizedIncoming === normalizedSaved) {
      return;
    }

    const questions = parseQuestionText(text);
    loadQuestionSet(questions, text, { preserveHistory: true, keepView: true });
    refs.loadMessage.textContent = `mcq-data.txt changed. Auto-synced ${questions.length} questions.`;
  } catch (err) {
    // Silent on auto-sync failures to avoid noisy status changes.
  }
}

function openPracticeView() {
  if (!getScopedQuestions().length) {
    refs.loadMessage.textContent = "No questions found from mcq-data.txt for the selected subject.";
    setActiveView("dashboard");
    return;
  }

  if (!state.queue.length) {
    rebuildScopedQueue(false);
  }

  setActiveView("practice");

  // If there is an active question in the queue, resume immediately.
  if (getCurrentQuestion()) {
    hidePracticeOverlay();
    renderQuestion();
    return;
  }

  showPracticeOverlay();
}

function openDashboardView() {
  setActiveView("dashboard");
}

function resumePracticeSession() {
  if (!state.queue.length) {
    refs.loadMessage.textContent = "No active queue found. Start a new round.";
    startNextAdaptiveRound("Started a new adaptive round.");
    return;
  }

  hidePracticeOverlay();
  renderQuestion();
}

function startFreshRoundFromOverlay() {
  startNextAdaptiveRound("Fresh adaptive round started.");
}

function onOverlayPracticeWeak() {
  closeRoundSummaryModal();
  practiceWeakTopics();
}

function onOverlayReviewMistakes() {
  closeRoundSummaryModal();
  practiceMistakes();
}

function shouldIgnoreSpacebarShortcut(target) {
  if (!target) {
    return false;
  }

  const tag = String(target.tagName || "").toLowerCase();
  if (["input", "textarea", "button", "select"].includes(tag)) {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest && target.closest("textarea, input, button, select"));
}

function onGlobalSpacebar(event) {
  if (event.code !== "Space") {
    return;
  }

  if (shouldIgnoreSpacebarShortcut(event.target)) {
    return;
  }

  const inPractice = refs.practiceView.classList.contains("active") && !refs.quizPanel.classList.contains("hidden");
  if (refs.practiceView.classList.contains("active") && !refs.practiceStartOverlay.classList.contains("hidden")) {
    event.preventDefault();
    resumePracticeSession();
    return;
  }

  if (!inPractice) {
    return;
  }

  if (!refs.nextBtn.classList.contains("hidden") && !refs.nextBtn.disabled) {
    event.preventDefault();
    onNextQuestion();
    return;
  }

  if (!refs.submitBtn.classList.contains("hidden") && !refs.submitBtn.disabled && getSelectedAnswers().size > 0) {
    event.preventDefault();
    onSubmitAnswer();
  }
}

refs.loadDefaultBtn.addEventListener("click", () => loadFromProjectFile(true));
refs.submitBtn.addEventListener("click", onSubmitAnswer);
refs.skipBtn.addEventListener("click", onSkipQuestion);
refs.nextBtn.addEventListener("click", onNextQuestion);
refs.optionsContainer.addEventListener("change", onOptionSelectionChange);
refs.resetBtn.addEventListener("click", resetSession);
refs.practiceWeakBtn.addEventListener("click", practiceWeakTopics);
refs.reviewMistakesBtn.addEventListener("click", practiceMistakes);
refs.tabDashboardBtn.addEventListener("click", openDashboardView);
refs.tabPracticeBtn.addEventListener("click", openPracticeView);
refs.subjectSelector.addEventListener("change", onSubjectSelectorChange);
refs.resumeSessionBtn.addEventListener("click", resumePracticeSession);
refs.startFreshRoundBtn.addEventListener("click", startFreshRoundFromOverlay);
refs.overlayWeakBtn.addEventListener("click", onOverlayPracticeWeak);
refs.overlayReviewBtn.addEventListener("click", onOverlayReviewMistakes);
refs.summaryRetryWeakBtn.addEventListener("click", () => {
  closeRoundSummaryModal();
  practiceWeakTopics();
});
refs.summaryReviewMistakesBtn.addEventListener("click", () => {
  closeRoundSummaryModal();
  practiceMistakes();
});
refs.summaryNewRoundBtn.addEventListener("click", () => {
  closeRoundSummaryModal();
  startNextAdaptiveRound();
});
refs.summaryCloseBtn.addEventListener("click", closeRoundSummaryModal);
document.addEventListener("keydown", onGlobalSpacebar);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    autoSyncProjectFile();
  }
});

window.addEventListener("beforeunload", () => {
  persistSession();
});

updateDashboard();
showPracticeState(false);
updateRoundProgressUI();
updateTimerUI();

const restored = restoreSessionFromStorage();
if (restored) {
  refreshSubjectSelector();
  const savedView = readStorageValue(STORAGE_KEYS.activeView);
  const mappedView = savedView === "practice" ? "practice" : "dashboard";
  setActiveView(mappedView, false);
  if (mappedView === "practice" && state.queue.length) {
    hidePracticeOverlay();
    renderQuestion();
  }
  loadFromProjectFile(false, { preserveHistory: true, keepView: true });
} else {
  setActiveView("dashboard", false);
  refreshSubjectSelector();
  refs.practiceStartOverlay.classList.add("hidden");
  loadFromProjectFile(false);
}

setInterval(autoSyncProjectFile, AUTO_SYNC_INTERVAL_MS);
