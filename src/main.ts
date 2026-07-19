import './style.css';
import type { SavedSession, SessionConfig, SessionState, QuestionTag, QuestionData, Difficulty } from './types';

// Global variables for App State
let appState: {
  currentTab: 'config' | 'practice' | 'history' | 'summary';
  history: SavedSession[];
  activeSession: SessionState | null;
  selectedSummarySession: SavedSession | null;
} = {
  currentTab: 'config',
  history: [],
  activeSession: null,
  selectedSummarySession: null,
};

// Global interval pointer
let timerInterval: number | null = null;

let activeAccentColor = 'blue';

function applyAccentColor(color: string) {
  const root = document.documentElement;
  if (color === 'blue') {
    root.style.setProperty('--color-primary', '#0284c7');
    root.style.setProperty('--color-primary-hover', '#0369a1');
    root.style.setProperty('--color-primary-light', '#f0f9ff');
    root.style.setProperty('--color-primary-border', '#bae6fd');
    root.style.setProperty('--color-primary-gradient-stop', '#38bdf8');
  } else if (color === 'teal') {
    root.style.setProperty('--color-primary', '#0d9488');
    root.style.setProperty('--color-primary-hover', '#0f766e');
    root.style.setProperty('--color-primary-light', '#f0fdfa');
    root.style.setProperty('--color-primary-border', '#ccfbf1');
    root.style.setProperty('--color-primary-gradient-stop', '#2dd4bf');
  } else if (color === 'slate') {
    root.style.setProperty('--color-primary', '#475569');
    root.style.setProperty('--color-primary-hover', '#334155');
    root.style.setProperty('--color-primary-light', '#f1f5f9');
    root.style.setProperty('--color-primary-border', '#cbd5e1');
    root.style.setProperty('--color-primary-gradient-stop', '#94a3b8');
  } else if (color === 'terracotta') {
    root.style.setProperty('--color-primary', '#c2410c');
    root.style.setProperty('--color-primary-hover', '#9a3412');
    root.style.setProperty('--color-primary-light', '#fff7ed');
    root.style.setProperty('--color-primary-border', '#ffedd5');
    root.style.setProperty('--color-primary-gradient-stop', '#fb923c');
  }
  activeAccentColor = color;
  localStorage.setItem('jee-timer-accent-color', color);
}

// Mock / Initial Data Helper
function initApp() {
  // Load saved accent color
  const savedColor = localStorage.getItem('jee-timer-accent-color') || 'blue';
  applyAccentColor(savedColor);

  // Load history from localStorage
  const savedHistory = localStorage.getItem('jee-timer-history');
  if (savedHistory) {
    try {
      appState.history = JSON.parse(savedHistory);
    } catch (e) {
      console.error('Failed to parse history', e);
      appState.history = [];
    }
  }

  // Load active session if any
  const savedActive = localStorage.getItem('jee-timer-active-session');
  if (savedActive) {
    try {
      appState.activeSession = JSON.parse(savedActive);
      if (appState.activeSession) {
        // If it was running, restore as paused so user knows where they are
        if (appState.activeSession.status === 'running') {
          appState.activeSession.status = 'paused';
        }
        appState.currentTab = 'practice';
      }
    } catch (e) {
      console.error('Failed to parse active session', e);
      appState.activeSession = null;
    }
  }

  // Initial render
  renderApp();

  // If there was an active session restored, sync UI
  if (appState.activeSession) {
    if (appState.activeSession.status === 'paused') {
      showPauseModal('Session Restored', 'We found an unfinished practice session. It is currently paused. Would you like to resume it?');
    }
  }
}

// -------------------------------------------------------------
// TIMER LOOP ENGINE
// -------------------------------------------------------------
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = window.setInterval(() => {
    if (!appState.activeSession || appState.activeSession.status !== 'running') {
      return;
    }

    const session = appState.activeSession;
    
    // 1. Increment elapsed overall seconds
    session.elapsedSeconds++;

    // 2. Increment active question seconds
    const currentQ = session.questions[session.activeQuestionIndex];
    if (currentQ) {
      currentQ.timeSpent++;
    }

    // 3. Save state backup in LocalStorage
    localStorage.setItem('jee-timer-active-session', JSON.stringify(session));

    // 4. Update elements in DOM without full re-render (performance optimized)
    updateLiveTimerDOM();
    updateLiveStatsDOM();
    updateLiveGuidanceDOM();

    // 5. Check if total session time is exceeded
    const totalTargetSeconds = session.config.durationMinutes * 60;
    if (session.elapsedSeconds >= totalTargetSeconds) {
      // Auto finish
      clearInterval(timerInterval!);
      timerInterval = null;
      finishSession(true); // completed due to timeout
    }
  }, 1000);
}

function stopTimerLoop() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// -------------------------------------------------------------
// DOM UPDATES (DURING TIMER TICK)
// -------------------------------------------------------------
function updateLiveTimerDOM() {
  const session = appState.activeSession;
  if (!session) return;

  const totalTargetSeconds = session.config.durationMinutes * 60;
  const remainingSeconds = Math.max(0, totalTargetSeconds - session.elapsedSeconds);

  // Formats MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const timerText = formatTime(remainingSeconds);
  const globalTimerEl = document.getElementById('global-timer');
  if (globalTimerEl) {
    globalTimerEl.textContent = timerText;
    
    // Low time visual cue
    if (remainingSeconds < 300) { // < 5 mins
      globalTimerEl.style.color = 'var(--color-cross)';
      if (remainingSeconds % 2 === 0) {
        globalTimerEl.style.opacity = '0.7';
      } else {
        globalTimerEl.style.opacity = '1';
      }
    } else {
      globalTimerEl.style.color = '';
      globalTimerEl.style.opacity = '';
    }
  }

  // Active question timer display
  const activeQTimerEl = document.getElementById('active-q-timer');
  if (activeQTimerEl) {
    const currentQ = session.questions[session.activeQuestionIndex];
    if (currentQ) {
      activeQTimerEl.textContent = `Time on this question: ${formatTime(currentQ.timeSpent)}`;
    }
  }
}

function updateLiveStatsDOM() {
  const session = appState.activeSession;
  if (!session) return;

  // Recalculate metrics in real-time
  let ticks = 0, circles = 0, crosses = 0, unvisited = 0;
  let timeTicks = 0, timeCircles = 0, timeCrosses = 0, timeUnvisited = 0;

  session.questions.forEach((q) => {
    if (q.tag === 'tick') {
      ticks++;
      timeTicks += q.timeSpent;
    } else if (q.tag === 'circle') {
      circles++;
      timeCircles += q.timeSpent;
    } else if (q.tag === 'cross') {
      crosses++;
      timeCrosses += q.timeSpent;
    } else {
      unvisited++;
      timeUnvisited += q.timeSpent;
    }
  });

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  // Update counts
  const setElText = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('stat-count-tick', ticks.toString());
  setElText('stat-time-tick', formatSecs(timeTicks));
  
  setElText('stat-count-circle', circles.toString());
  setElText('stat-time-circle', formatSecs(timeCircles));
  
  setElText('stat-count-cross', crosses.toString());
  setElText('stat-time-cross', formatSecs(timeCrosses));
  
  setElText('stat-count-unvisited', unvisited.toString());
  setElText('stat-time-unvisited', formatSecs(timeUnvisited));

  // Update progress bars
  const total = session.config.totalQuestions;
  const tickBar = document.getElementById('progress-tick-bar');
  const circleBar = document.getElementById('progress-circle-bar');
  const crossBar = document.getElementById('progress-cross-bar');

  if (tickBar) tickBar.style.width = `${(ticks / total) * 100}%`;
  if (circleBar) circleBar.style.width = `${(circles / total) * 100}%`;
  if (crossBar) crossBar.style.width = `${(crosses / total) * 100}%`;
}

function updateLiveGuidanceDOM() {
  const session = appState.activeSession;
  if (!session) return;

  const currentQ = session.questions[session.activeQuestionIndex];
  if (!currentQ) return;

  const tipTitleEl = document.getElementById('guidance-tip-title');
  const tipTextEl = document.getElementById('guidance-tip-text');
  if (!tipTitleEl || !tipTextEl) return;

  // Logical rules for strategy recommendations based on active status
  if (currentQ.tag === 'unvisited' && currentQ.timeSpent > 90) {
    tipTitleEl.textContent = 'Speed Breaker Alert ⚠️';
    tipTextEl.textContent = `You've spent ${currentQ.timeSpent}s on this question without tagging it. If you are stuck or confused, tap Cross ✗ to skip immediately. You can always return to Circles later!`;
    return;
  }

  // General tag suggestions
  if (currentQ.tag === 'cross') {
    tipTitleEl.textContent = 'Strategic Skip ✗';
    tipTextEl.textContent = 'Excellent discipline! You identified a difficult speed-breaker. Every second saved here can be spent on high-probability Tick or Circle questions.';
    return;
  }

  if (currentQ.tag === 'tick') {
    tipTitleEl.textContent = 'Secure Marks ✓';
    tipTextEl.textContent = 'Great! Easy questions should be solved quickly. Try to keep average Tick times under 2 minutes to bank surplus time.';
    return;
  }

  if (currentQ.tag === 'circle') {
    tipTitleEl.textContent = 'Think & Solve ◯';
    tipTextEl.textContent = 'Good choice. Circle questions are the ones you can solve with focused effort. If you get bogged down, move on and come back in a second pass.';
    return;
  }

  // Default fallback recommendations based on overall session state
  const crossedCount = session.questions.filter(q => q.tag === 'cross').length;
  if (crossedCount > 4) {
    tipTitleEl.textContent = 'Smart Paper Scanning';
    tipTextEl.textContent = 'You are scanning the paper actively and crossing out tough problems. This is exactly how top rankers secure high percentiles in JEE.';
  } else {
    tipTitleEl.textContent = 'JEE Attempt Strategy';
    tipTextEl.textContent = 'Attempt in 2-3 passes. Pass 1: Solve only Ticks ✓. Pass 2: Work on Circles ◯. Pass 3: Review any left. Avoid Speed Breakers ✗.';
  }
}

// -------------------------------------------------------------
// NAVIGATION AND VIEW CONTROL
// -------------------------------------------------------------
function showTab(tab: 'config' | 'practice' | 'history' | 'summary') {
  // If active session is running and user leaves the practice screen, warn or pause
  if (appState.currentTab === 'practice' && tab !== 'practice' && appState.activeSession && appState.activeSession.status === 'running') {
    // Automatically pause
    pauseSession();
  }

  appState.currentTab = tab;
  renderApp();
}

// -------------------------------------------------------------
// EVENT HANDLERS
// -------------------------------------------------------------
function setupEventListeners() {
  // Top nav tabs
  const tabConfig = document.querySelector('[data-tab="config"]');
  const tabHistory = document.querySelector('[data-tab="history"]');
  
  if (tabConfig) {
    tabConfig.addEventListener('click', () => {
      // If we have an active session, redirect to practice instead of config, or ask
      if (appState.activeSession && (appState.activeSession.status === 'running' || appState.activeSession.status === 'paused')) {
        showTab('practice');
      } else {
        showTab('config');
      }
    });
  }

  if (tabHistory) {
    tabHistory.addEventListener('click', () => showTab('history'));
  }

  const btnShowHelp = document.getElementById('btn-show-help');
  if (btnShowHelp) {
    btnShowHelp.addEventListener('click', () => showHelpModal());
  }

  const btnShowFeedback = document.getElementById('btn-show-feedback');
  if (btnShowFeedback) {
    btnShowFeedback.addEventListener('click', () => showFeedbackModal());
  }

  const btnGokulSocials = document.getElementById('btn-gokul-socials');
  if (btnGokulSocials) {
    btnGokulSocials.addEventListener('click', () => showSocialsModal());
  }
}

// -------------------------------------------------------------
// STATE MUTATORS
// -------------------------------------------------------------
function startNewSession(config: SessionConfig) {
  const questions: QuestionData[] = [];
  for (let i = 1; i <= config.totalQuestions; i++) {
    questions.push({
      number: i,
      tag: 'unvisited',
      timeSpent: 0,
      visits: 0,
      solved: false,
    });
  }

  appState.activeSession = {
    config,
    status: 'running',
    activeQuestionIndex: 0,
    questions,
    elapsedSeconds: 0,
  };

  // Add 1 visit to the first question
  appState.activeSession.questions[0].visits = 1;

  // Save to LocalStorage
  localStorage.setItem('jee-timer-active-session', JSON.stringify(appState.activeSession));

  showTab('practice');
  startTimerLoop();
}

function setSolvedStatus(solved: boolean) {
  const session = appState.activeSession;
  if (!session) return;

  const currentQ = session.questions[session.activeQuestionIndex];
  if (!currentQ) return;

  currentQ.solved = solved;

  // Save state backup in LocalStorage
  localStorage.setItem('jee-timer-active-session', JSON.stringify(session));

  // Dynamic UI updates
  updateLiveStatsDOM();
  updateActiveQuestionPanelDOM();
  updateNavigatorGridDOM();
}

function pauseSession() {
  if (appState.activeSession && appState.activeSession.status === 'running') {
    appState.activeSession.status = 'paused';
    stopTimerLoop();
    localStorage.setItem('jee-timer-active-session', JSON.stringify(appState.activeSession));
    renderApp();
  }
}

function resumeSession() {
  if (appState.activeSession && appState.activeSession.status === 'paused') {
    appState.activeSession.status = 'running';
    startNewSessionTimer();
    renderApp();
  }
}

function startNewSessionTimer() {
  startTimerLoop();
}

function tagActiveQuestion(tag: QuestionTag) {
  const session = appState.activeSession;
  if (!session) return;

  const currentQ = session.questions[session.activeQuestionIndex];
  if (!currentQ) return;

  // Tag or untag
  if (currentQ.tag === tag) {
    currentQ.tag = 'unvisited'; // toggle off
  } else {
    currentQ.tag = tag;
    
    // Auto sync solved status based on strategy tag shortcut
    if (tag === 'tick') {
      currentQ.solved = true;
    } else if (tag === 'cross') {
      currentQ.solved = false;
    }
  }

  // Update in local storage
  localStorage.setItem('jee-timer-active-session', JSON.stringify(session));

  // Dynamic UI updates
  updateLiveStatsDOM();
  updateLiveGuidanceDOM();
  
  // Re-render only parts that need updates: active panel, navigator button styling
  updateActiveQuestionPanelDOM();
  updateNavigatorGridDOM();
}

function selectQuestion(index: number) {
  const session = appState.activeSession;
  if (!session) return;

  if (index >= 0 && index < session.questions.length) {
    session.activeQuestionIndex = index;
    session.questions[index].visits++;
    
    localStorage.setItem('jee-timer-active-session', JSON.stringify(session));
    
    // Update specific workspace views
    updateActiveQuestionPanelDOM();
    updateNavigatorGridDOM();
    updateLiveTimerDOM();
    updateLiveGuidanceDOM();
  }
}

function finishSession(forcedTimeout = false) {
  const session = appState.activeSession;
  if (!session) return;

  stopTimerLoop();
  session.status = 'completed';

  // Calculate diagnostic metrics
  let ticks = 0, circles = 0, crosses = 0, unvisited = 0, solved = 0;
  let timeTicks = 0, timeCircles = 0, timeCrosses = 0, timeUnvisited = 0;

  session.questions.forEach((q) => {
    if (q.solved) {
      solved++;
    }
    if (q.tag === 'tick') {
      ticks++;
      timeTicks += q.timeSpent;
    } else if (q.tag === 'circle') {
      circles++;
      timeCircles += q.timeSpent;
    } else if (q.tag === 'cross') {
      crosses++;
      timeCrosses += q.timeSpent;
    } else {
      unvisited++;
      timeUnvisited += q.timeSpent;
    }
  });

  const saved: SavedSession = {
    id: `session_${Date.now()}`,
    date: new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    config: session.config,
    elapsedSeconds: session.elapsedSeconds,
    questions: session.questions,
    metrics: {
      ticksCount: ticks,
      circlesCount: circles,
      crossesCount: crosses,
      unvisitedCount: unvisited,
      solvedCount: solved,
      totalTimeTicks: timeTicks,
      totalTimeCircles: timeCircles,
      totalTimeCrosses: timeCrosses,
      totalTimeUnvisited: timeUnvisited,
    },
  };

  // Add to history
  appState.history.unshift(saved);
  localStorage.setItem('jee-timer-history', JSON.stringify(appState.history));

  // Clear active session
  appState.activeSession = null;
  localStorage.removeItem('jee-timer-active-session');

  // Navigate to summary screen
  appState.selectedSummarySession = saved;
  showTab('summary');

  if (forcedTimeout) {
    alert("⏰ Time is up! The practice session has ended automatically. Let's analyze your Attempt Strategy.");
  }
}

function discardActiveSession() {
  stopTimerLoop();
  appState.activeSession = null;
  localStorage.removeItem('jee-timer-active-session');
  showTab('config');
}

// -------------------------------------------------------------
// VIEW RENDERERS
// -------------------------------------------------------------
function renderApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Header section is shared
  let headerHtml = `
    <header class="app-header">
      <div class="brand-section">
        <div class="brand-logo">JEE</div>
        <div class="brand-title">
          <h1>JEE Strategic Timer</h1>
          <p class="brand-tagline">
            Practice & Paper Attempt Pacing System • 
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">made with ❤️ by <button type="button" id="btn-gokul-socials" style="background: none; border: none; padding: 0; color: var(--color-primary); font-weight: 600; text-decoration: none; cursor: pointer; font-family: inherit; font-size: 0.75rem;">Gokul Anand</button></span>
          </p>
        </div>
      </div>
      <nav class="nav-tabs" id="nav-tabs" style="display: flex; align-items: center;">
        <button class="nav-btn ${appState.currentTab === 'config' ? 'active' : ''}" data-tab="config">
          ${(appState.activeSession && appState.activeSession.status !== 'completed') ? 'Active Session' : 'New Practice'}
        </button>
        <button class="nav-btn ${appState.currentTab === 'history' ? 'active' : ''}" data-tab="history">History Log</button>
        <button class="feedback-header-btn" id="btn-show-feedback" type="button">Feedback</button>
        <button class="help-btn" id="btn-show-help" title="How to use the Strategy Timer" type="button">?</button>
      </nav>
    </header>
    <main id="main-content">
      <!-- Dynamic View Inserted Here -->
    </main>
    <div id="modal-container"></div>
  `;

  appContainer.innerHTML = headerHtml;
  setupEventListeners();

  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  switch (appState.currentTab) {
    case 'config':
      // If there is an active session, show practice view directly
      if (appState.activeSession && (appState.activeSession.status === 'running' || appState.activeSession.status === 'paused')) {
        appState.currentTab = 'practice';
        renderPracticeView(mainContent);
      } else {
        renderConfigView(mainContent);
      }
      break;
    case 'practice':
      if (appState.activeSession) {
        renderPracticeView(mainContent);
      } else {
        appState.currentTab = 'config';
        renderConfigView(mainContent);
      }
      break;
    case 'history':
      renderHistoryView(mainContent);
      break;
    case 'summary':
      renderSummaryView(mainContent);
      break;
  }
}

// 1. RENDER CONFIG VIEW
function renderConfigView(container: HTMLElement) {
  container.innerHTML = `
    <div class="config-layout">
      <!-- Left Pane: Strategy Instructions -->
      <div class="config-left-pane">
        <div class="bento-card" style="border-left: 5px solid var(--color-primary); padding: 16px;">
          <h3 style="margin-bottom: 6px; font-size: 1.1rem; color: var(--color-primary);">Attempt Strategy Training</h3>
          <p style="font-size: 0.8rem; margin-bottom: 0; line-height: 1.45;">
            JEE is an exam of <strong>selective elimination</strong>. Your goal is to maximize total marks by prioritizing easy questions and quickly skipping the speed-breakers.
          </p>
        </div>
        
        <div class="bento-card" style="padding: 16px;">
          <h3 style="margin-bottom: 10px; font-size: 1rem;">The Tick-Circle-Cross Strategy</h3>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; line-height: 1.35;">
            <div class="flex items-center gap-2">
              <span class="breakdown-tag-badge tick" style="font-size: 0.65rem; padding: 2px 6px; width: 70px; text-align: center; flex-shrink:0;">TICK ✓</span>
              <span>Solved &amp; Easy. Answer immediately. (&lt;2 mins)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="breakdown-tag-badge circle" style="font-size: 0.65rem; padding: 2px 6px; width: 70px; text-align: center; flex-shrink:0;">CIRCLE ◯</span>
              <span>Think &amp; Solve. Calculative but solvable. (Pass 2)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="breakdown-tag-badge cross" style="font-size: 0.65rem; padding: 2px 6px; width: 70px; text-align: center; flex-shrink:0;">CROSS ✗</span>
              <span>Tough / Trap. Skip within 45s to save time!</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Pane: Setup Form -->
      <div class="config-right-pane">
        <div class="bento-card" style="padding: 16px 20px;">
          <h2 style="margin-bottom: 4px; font-size: 1.25rem;">Practice Setup</h2>
          <p style="font-size: 0.8rem; margin-bottom: 12px;">Set up your target test parameters to begin timing.</p>
          
          <form id="config-form">
            <div class="form-group">
              <label for="config-subject">Subject / Topic Name</label>
              <input type="text" id="config-subject" class="form-control" placeholder="e.g. Physics Mock, Math Advanced" required value="Mixed Subject Test">
            </div>
            
            <div class="form-group">
              <label>Pacing Template</label>
              <div class="preset-container">
                <button type="button" class="preset-btn active" data-preset="adv-pacing">15 Ques / 90 mins (Adv)</button>
                <button type="button" class="preset-btn" data-preset="main-pacing">20 Ques / 60 mins (Main)</button>
                <button type="button" class="preset-btn" data-preset="full-test">75 Ques / 180 mins</button>
                <button type="button" class="preset-btn" data-preset="custom">Custom</button>
              </div>
            </div>
            
            <div class="form-group id-custom-inputs hidden">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label for="config-questions">Questions</label>
                  <input type="number" id="config-questions" class="form-control" min="1" max="120" value="15">
                </div>
                <div>
                  <label for="config-time">Minutes</label>
                  <input type="number" id="config-time" class="form-control" min="2" max="360" value="90">
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label>Difficulty Target</label>
              <div class="option-selector-grid">
                <div class="selector-option selected" data-diff="advanced" style="padding: 6px;">
                  <h4 style="font-size: 0.85rem; margin-bottom: 2px;">Advanced</h4>
                  <p style="font-size: 0.65rem;">Concept focus</p>
                </div>
                <div class="selector-option" data-diff="main" style="padding: 6px;">
                  <h4 style="font-size: 0.85rem; margin-bottom: 2px;">Main</h4>
                  <p style="font-size: 0.65rem;">Speed focus</p>
                </div>
                <div class="selector-option" data-diff="mixed" style="padding: 6px;">
                  <h4 style="font-size: 0.85rem; margin-bottom: 2px;">Mixed</h4>
                  <p style="font-size: 0.65rem;">Balanced mix</p>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label>Theme Accent Color</label>
              <div style="display: flex; gap: 12px; margin-top: 6px;">
                <button type="button" class="color-dot-btn ${activeAccentColor === 'blue' ? 'active' : ''}" data-color="blue" style="background-color: #0284c7;" title="Ocean Blue"></button>
                <button type="button" class="color-dot-btn ${activeAccentColor === 'teal' ? 'active' : ''}" data-color="teal" style="background-color: #0d9488;" title="Forest Teal"></button>
                <button type="button" class="color-dot-btn ${activeAccentColor === 'slate' ? 'active' : ''}" data-color="slate" style="background-color: #475569;" title="Steel Slate"></button>
                <button type="button" class="color-dot-btn ${activeAccentColor === 'terracotta' ? 'active' : ''}" data-color="terracotta" style="background-color: #c2410c;" title="Warm Terracotta"></button>
              </div>
            </div>
            
            <div class="form-group">
              <div class="toggle-wrapper" style="padding: 8px 12px;">
                <div class="toggle-info">
                  <span style="font-size: 0.85rem;">Anxiety-Free Stealth Timer</span>
                  <small style="font-size: 0.65rem;">Hides the countdown clock</small>
                </div>
                <label class="switch">
                  <input type="checkbox" id="config-stealth" checked>
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            
            <button type="submit" class="btn btn-primary btn-full" style="font-size: 1rem; padding: 10px; margin-top: 4px;">
              Start Timed Session
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Presets selector logic
  const presetBtns = container.querySelectorAll('[data-preset]');
  const customInputs = container.querySelector('.id-custom-inputs');
  const questionsInput = container.querySelector('#config-questions') as HTMLInputElement;
  const timeInput = container.querySelector('#config-time') as HTMLInputElement;

  let activePreset = 'adv-pacing';

  // Helper to dynamically calculate and update pacing duration with buffer
  const autoUpdateTime = () => {
    if (activePreset !== 'custom') return;
    const questions = parseInt(questionsInput.value) || 0;
    if (questions <= 0) return;
    
    // Generous pacing multipliers for exam practice (with buffers)
    let multiplier = 5.0; // Mixed: 5 mins per question
    if (selectedDiff === 'advanced') {
      multiplier = 6.0; // Advanced: 6 mins per question
    } else if (selectedDiff === 'main') {
      multiplier = 3.5; // Main: 3.5 mins per question
    }
    
    const calculatedMinutes = Math.round(questions * multiplier);
    if (timeInput) {
      timeInput.value = calculatedMinutes.toString();
    }
  };

  // Bind input trigger for question count change
  if (questionsInput) {
    questionsInput.addEventListener('input', autoUpdateTime);
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      presetBtns.forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLButtonElement;
      target.classList.add('active');
      
      const preset = target.getAttribute('data-preset');
      activePreset = preset || 'custom';

      if (preset === 'adv-pacing') {
        customInputs?.classList.add('hidden');
        if (questionsInput) questionsInput.value = '15';
        if (timeInput) timeInput.value = '90';
      } else if (preset === 'main-pacing') {
        customInputs?.classList.add('hidden');
        if (questionsInput) questionsInput.value = '20';
        if (timeInput) timeInput.value = '60';
      } else if (preset === 'full-test') {
        customInputs?.classList.add('hidden');
        if (questionsInput) questionsInput.value = '75';
        if (timeInput) timeInput.value = '180';
      } else if (preset === 'custom') {
        customInputs?.classList.remove('hidden');
        autoUpdateTime(); // Update values immediately on Custom load
      }
    });
  });

  // Difficulty select logic
  const diffOptions = container.querySelectorAll('[data-diff]');
  let selectedDiff: Difficulty = 'advanced';

  diffOptions.forEach((option) => {
    option.addEventListener('click', (e) => {
      diffOptions.forEach(opt => opt.classList.remove('selected'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('selected');
      selectedDiff = (target.getAttribute('data-diff') as Difficulty) || 'advanced';
      autoUpdateTime(); // Recalculate time if difficulty changes in custom mode
    });
  });

  // Accent color selector logic
  const colorBtns = container.querySelectorAll('.color-dot-btn');
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      colorBtns.forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      const color = target.getAttribute('data-color') || 'blue';
      applyAccentColor(color);
    });
  });

  // Submit form
  const form = container.querySelector('#config-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const subjectInput = container.querySelector('#config-subject') as HTMLInputElement;
      const stealthInput = container.querySelector('#config-stealth') as HTMLInputElement;

      let finalQCount = 15;
      let finalDuration = 90;

      if (activePreset === 'adv-pacing') {
        finalQCount = 15;
        finalDuration = 90;
      } else if (activePreset === 'main-pacing') {
        finalQCount = 20;
        finalDuration = 60;
      } else if (activePreset === 'full-test') {
        finalQCount = 75;
        finalDuration = 180;
      } else {
        finalQCount = parseInt(questionsInput.value) || 15;
        finalDuration = parseInt(timeInput.value) || 90;
      }

      startNewSession({
        subject: subjectInput.value || 'JEE Practice',
        totalQuestions: finalQCount,
        durationMinutes: finalDuration,
        difficulty: selectedDiff,
        stealthMode: stealthInput.checked,
      });
    });
  }
}

// 2. RENDER PRACTICE SESSION VIEW
function renderPracticeView(container: HTMLElement) {
  const session = appState.activeSession;
  if (!session) return;

  container.innerHTML = `
    <div class="bento-grid">
      <!-- Card 1: Session Status & Stealth Timer -->
      <div class="bento-card session-info-card">
        <div>
          <div class="session-badge" id="card-subject-badge">${session.config.subject}</div>
          <h3 style="margin-top: 12px; margin-bottom: 4px;" id="card-difficulty-label">
            ${session.config.difficulty === 'advanced' ? 'JEE Advanced Pacing' : session.config.difficulty === 'main' ? 'JEE Main Pacing' : 'Mixed Level Pacing'}
          </h3>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; color: var(--text-muted);" id="card-progress-label">Question ${session.activeQuestionIndex + 1} of ${session.config.totalQuestions}</span>
            <span id="card-solved-count-badge" style="font-size: 0.85rem; font-weight: 700; color: var(--color-tick);">Solved: 0</span>
          </div>
          
          <div class="progress-bar-container mb-4">
            <div class="progress-segment tick" id="progress-tick-bar" style="width: 0%"></div>
            <div class="progress-segment circle" id="progress-circle-bar" style="width: 0%"></div>
            <div class="progress-segment cross" id="progress-cross-bar" style="width: 0%"></div>
          </div>
        </div>
        
        <div class="timer-box">
          <div class="timer-label">Time Remaining</div>
          <div class="timer-digits ${session.config.stealthMode ? 'stealth' : ''}" id="global-timer">--:--</div>
          
          ${session.config.stealthMode ? `
            <div class="stealth-indicator" id="stealth-status">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--color-primary); animation: pulse 1.5s infinite;"></span>
              Stealth mode active
            </div>
            <div class="stealth-hint" id="stealth-tip">Hover clock to reveal</div>
          ` : `
            <div class="stealth-indicator" id="stealth-status" style="color:var(--text-muted);">
              Visible Clock Mode
            </div>
          `}
        </div>
        
        <div class="timer-controls" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          <div style="display: flex; gap: 8px; width: 100%;">
            <button class="btn btn-secondary btn-sm" id="btn-pause-resume" style="flex: 1;">
              ${session.status === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button class="btn btn-primary btn-sm" id="btn-end-session" style="flex: 1;">End & Analyse</button>
          </div>
          <button class="btn btn-danger btn-sm btn-full" id="btn-quit-session" style="background-color: var(--color-cross-light); color: var(--color-cross-text); border: 1px solid var(--color-cross-border); font-size: 0.8rem; padding: 6px 12px;">
            Stop & New Test
          </button>
        </div>
      </div>

      <!-- Card 2: Active Question Solver Workspace -->
      <div class="bento-card col-span-2 workspace-card" id="active-question-panel">
        <!-- Inside populated by updateActiveQuestionPanelDOM() -->
      </div>

      <!-- Card 3: Question Navigator Grid -->
      <div class="bento-card navigator-card">
        <h3 style="margin-bottom: 6px;">Question Navigator</h3>
        <p style="font-size: 0.8rem; margin-bottom: 16px;">Click to navigate. Ticks and Circles guide your final review.</p>
        <div class="navigator-grid-scroll">
          <div class="navigator-grid" id="q-navigator-grid">
            <!-- Populated by updateNavigatorGridDOM() -->
          </div>
        </div>
      </div>

      <!-- Card 4: Strategy & Time Stats -->
      <div class="bento-card live-stats-card">
        <h3 style="margin-bottom: 12px;">Strategic Velocity</h3>
        <div class="live-stats-list">
          <div class="live-stat-item">
            <div class="stat-label-with-color">
              <span class="color-dot tick"></span>
              <span>Ticks (Easy)</span>
            </div>
            <div class="stat-value-block">
              <div class="stat-count" id="stat-count-tick">0</div>
              <div class="stat-time" id="stat-time-tick">0s</div>
            </div>
          </div>
          <div class="live-stat-item">
            <div class="stat-label-with-color">
              <span class="color-dot circle"></span>
              <span>Circles (Think)</span>
            </div>
            <div class="stat-value-block">
              <div class="stat-count" id="stat-count-circle">0</div>
              <div class="stat-time" id="stat-time-circle">0s</div>
            </div>
          </div>
          <div class="live-stat-item">
            <div class="stat-label-with-color">
              <span class="color-dot cross"></span>
              <span>Crosses (Skip)</span>
            </div>
            <div class="stat-value-block">
              <div class="stat-count" id="stat-count-cross">0</div>
              <div class="stat-time" id="stat-time-cross">0s</div>
            </div>
          </div>
          <div class="live-stat-item">
            <div class="stat-label-with-color">
              <span class="color-dot unvisited"></span>
              <span>Unvisited</span>
            </div>
            <div class="stat-value-block">
              <div class="stat-count" id="stat-count-unvisited">0</div>
              <div class="stat-time" id="stat-time-unvisited">0s</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // Bind timer controls
  const btnPauseResume = container.querySelector('#btn-pause-resume');
  const btnEndSession = container.querySelector('#btn-end-session');
  
  if (btnPauseResume) {
    btnPauseResume.addEventListener('click', () => {
      if (session.status === 'running') {
        pauseSession();
      } else {
        resumeSession();
      }
    });
  }

  if (btnEndSession) {
    btnEndSession.addEventListener('click', () => {
      showPauseModal(
        'Finish Practice Set?',
        'Are you sure you want to end this practice session? We will analyze your strategy, pacing distribution, and score diagnostic metrics.',
        () => finishSession(false), // onConfirm
        true // showDiscard option
      );
    });
  }

  const btnQuitSession = container.querySelector('#btn-quit-session');
  if (btnQuitSession) {
    btnQuitSession.addEventListener('click', () => {
      showPauseModal(
        'Quit Practice Session?',
        'Are you sure you want to stop this practice session and configure a new test? All current tags and pacing data will be discarded.',
        () => discardActiveSession()
      );
    });
  }

  // Populate dynamic sub-grids
  updateActiveQuestionPanelDOM();
  updateNavigatorGridDOM();

  // Trigger immediate timer sync
  updateLiveTimerDOM();
  updateLiveStatsDOM();
  updateLiveGuidanceDOM();

  // If running, hook up interval
  if (session.status === 'running') {
    startTimerLoop();
  } else {
    stopTimerLoop();
    // Pause state visual overlay
    showPauseModal(
      'Session Paused',
      'This practice session is paused. Ready to resume focus?',
      () => resumeSession()
    );
  }
}

// UPDATE ACTIVE QUESTION PANEL DOM
function updateActiveQuestionPanelDOM() {
  const panel = document.getElementById('active-question-panel');
  const session = appState.activeSession;
  if (!panel || !session) return;

  const currentQIndex = session.activeQuestionIndex;
  const currentQ = session.questions[currentQIndex];
  if (!currentQ) return;

  panel.innerHTML = `
    <div class="workspace-header">
      <h2 class="question-title" style="display: flex; align-items: center; gap: 10px;">
        Question ${currentQ.number}
        ${currentQ.tag !== 'unvisited' ? `<span class="breakdown-tag-badge ${currentQ.tag}">${currentQ.tag.toUpperCase()}</span>` : ''}
      </h2>
      <div class="question-nav-buttons">
        <button class="btn btn-secondary btn-sm" id="btn-prev-q" ${currentQIndex === 0 ? 'disabled' : ''}>← Prev</button>
        <button class="btn btn-secondary btn-sm" id="btn-next-q" ${currentQIndex === session.questions.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>
    </div>
    
    <div class="workspace-body">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; justify-content: center;">
        <div class="active-q-timer" id="active-q-timer" style="margin-bottom: 0;">Time on this question: 00:00</div>
        
        <div class="solve-status-toggle">
          <button class="solve-status-btn unsolved-btn ${!currentQ.solved ? 'active' : ''}" id="btn-status-unsolved">Unsolved</button>
          <button class="solve-status-btn solved-btn ${currentQ.solved ? 'active' : ''}" id="btn-status-solved">Solved</button>
        </div>
      </div>
      
      <p style="max-width: 480px; margin-bottom: 12px; font-size: 0.85rem; color: var(--text-muted);">
        Tag this question according to how you felt attempting it:
      </p>

      <div class="strategy-buttons-grid">
        <div class="strategy-btn strategy-btn-tick ${currentQ.tag === 'tick' ? 'active' : ''}" id="tag-btn-tick">
          <span class="icon">✓</span>
          <span class="label">Tick</span>
          <span class="desc">Easy / Speed-run<br>Solved fast</span>
        </div>
        <div class="strategy-btn strategy-btn-circle ${currentQ.tag === 'circle' ? 'active' : ''}" id="tag-btn-circle">
          <span class="icon">◯</span>
          <span class="label">Circle</span>
          <span class="desc">Calculative / Think<br>Requires processing</span>
        </div>
        <div class="strategy-btn strategy-btn-cross ${currentQ.tag === 'cross' ? 'active' : ''}" id="tag-btn-cross">
          <span class="icon">✗</span>
          <span class="label">Cross</span>
          <span class="desc">Tough / Trap<br>No idea. Skip!</span>
        </div>
      </div>
      
      <button class="clear-tag-btn" id="btn-clear-tag" style="visibility: ${currentQ.tag !== 'unvisited' ? 'visible' : 'hidden'};">
        Reset to Unvisited
      </button>
    </div>
  `;

  // Bind workspace listeners
  const btnPrev = panel.querySelector('#btn-prev-q');
  const btnNext = panel.querySelector('#btn-next-q');
  const btnClear = panel.querySelector('#btn-clear-tag');
  const btnUnsolved = panel.querySelector('#btn-status-unsolved');
  const btnSolved = panel.querySelector('#btn-status-solved');
  
  const tagTick = panel.querySelector('#tag-btn-tick');
  const tagCircle = panel.querySelector('#tag-btn-circle');
  const tagCross = panel.querySelector('#tag-btn-cross');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => selectQuestion(currentQIndex - 1));
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => selectQuestion(currentQIndex + 1));
  }
  if (btnClear) {
    btnClear.addEventListener('click', () => tagActiveQuestion('unvisited'));
  }
  if (btnUnsolved) {
    btnUnsolved.addEventListener('click', () => setSolvedStatus(false));
  }
  if (btnSolved) {
    btnSolved.addEventListener('click', () => setSolvedStatus(true));
  }

  if (tagTick) {
    tagTick.addEventListener('click', () => tagActiveQuestion('tick'));
  }
  if (tagCircle) {
    tagCircle.addEventListener('click', () => tagActiveQuestion('circle'));
  }
  if (tagCross) {
    tagCross.addEventListener('click', () => tagActiveQuestion('cross'));
  }

  // Update outer labels
  const progressLabel = document.getElementById('card-progress-label');
  if (progressLabel) {
    progressLabel.textContent = `Question ${currentQ.number} of ${session.config.totalQuestions}`;
  }
  const solvedBadge = document.getElementById('card-solved-count-badge');
  if (solvedBadge) {
    const solvedCount = session.questions.filter(q => q.solved).length;
    solvedBadge.textContent = `Solved: ${solvedCount}`;
  }
}

// UPDATE NAVIGATOR GRID DOM
function updateNavigatorGridDOM() {
  const gridContainer = document.getElementById('q-navigator-grid');
  const session = appState.activeSession;
  if (!gridContainer || !session) return;

  gridContainer.innerHTML = session.questions.map((q, idx) => {
    let tagClass = '';
    if (q.tag === 'tick') tagClass = 'tagged-tick';
    else if (q.tag === 'circle') tagClass = 'tagged-circle';
    else if (q.tag === 'cross') tagClass = 'tagged-cross';

    const isActive = session.activeQuestionIndex === idx ? 'active' : '';

    return `
      <button class="nav-q-btn ${tagClass} ${isActive}" data-q-idx="${idx}">
        ${q.number}
        ${q.solved ? '<span class="q-solved-badge">✓</span>' : ''}
      </button>
    `;
  }).join('');

  // Bind click listeners
  gridContainer.querySelectorAll('.nav-q-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-q-idx') || '0');
      selectQuestion(idx);
    });
  });
}

// 3. RENDER DIAGNOSTIC SUMMARY VIEW
function renderSummaryView(container: HTMLElement) {
  const session = appState.selectedSummarySession;
  if (!session) {
    container.innerHTML = `<div class="history-empty">No session selected for summary.</div>`;
    return;
  }

  // Calculate strategy diagnostic score
  // Ideal: cross average time is small (< 60s), unvisited is 0.
  let totalCrossTime = session.metrics.totalTimeCrosses;
  let crossCount = session.metrics.crossesCount;
  let avgCrossTime = crossCount > 0 ? totalCrossTime / crossCount : 0;

  let totalTickTime = session.metrics.totalTimeTicks;
  let tickCount = session.metrics.ticksCount;
  let avgTickTime = tickCount > 0 ? totalTickTime / tickCount : 0;

  let totalCircleTime = session.metrics.totalTimeCircles;
  let circleCount = session.metrics.circlesCount;
  let avgCircleTime = circleCount > 0 ? totalCircleTime / circleCount : 0;

  // Attempt strategy rating score
  // Deduct points for: spending too long on crosses (>60s), leaving unvisited questions.
  let baseScore = 100;
  let crossPenalty = 0;
  if (crossCount > 0 && avgCrossTime > 60) {
    // Penalty scales from 0 to 40 based on avg time spent on skipped questions
    crossPenalty = Math.min(40, Math.round((avgCrossTime - 60) / 4));
  }
  let unvisitedPenalty = session.metrics.unvisitedCount * 8; // -8 for each unvisited
  let score = Math.max(0, baseScore - crossPenalty - unvisitedPenalty);

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  // Generate diagnostics list items
  let diagnosticsHtml = '';

  if (session.metrics.unvisitedCount > 0) {
    diagnosticsHtml += `
      <div class="diagnostic-item danger">
        <div class="diagnostic-icon">⚠️</div>
        <div class="diagnostic-content">
          <h4>Paper Coverage Warning: ${session.metrics.unvisitedCount} Unvisited Questions</h4>
          <p>You failed to inspect the entire question set. This means you got caught in speed-breaker questions. In JEE, some very easy questions are placed at the end. You must skip faster to read the entire paper!</p>
        </div>
      </div>
    `;
  } else {
    diagnosticsHtml += `
      <div class="diagnostic-item success">
        <div class="diagnostic-icon">✓</div>
        <div class="diagnostic-content">
          <h4>Full Paper Inspection</h4>
          <p>Superb! You viewed and categorized every single question in the set. This ensures you didn't miss any easy high-scoring opportunities.</p>
        </div>
      </div>
    `;
  }

  if (crossCount > 0) {
    if (avgCrossTime > 90) {
      diagnosticsHtml += `
        <div class="diagnostic-item danger">
          <div class="diagnostic-icon">⏱️</div>
          <div class="diagnostic-content">
            <h4>Speed Breaker Penalty (Average cross skip time: ${formatSecs(avgCrossTime)})</h4>
            <p>You spent too long trying to solve questions that you ultimately Crossed out. On average, you wasted ${formatSecs(avgCrossTime)} before giving up. Aim to recognize unsolvable questions within 45-60 seconds!</p>
          </div>
        </div>
      `;
    } else if (avgCrossTime > 45) {
      diagnosticsHtml += `
        <div class="diagnostic-item warning">
          <div class="diagnostic-icon">⏱️</div>
          <div class="diagnostic-content">
            <h4>Moderate Skip Time (${formatSecs(avgCrossTime)})</h4>
            <p>Your skipping speed is acceptable, but there is room to improve. Deciding to skip in under 45 seconds will save you another 2-3 minutes overall.</p>
          </div>
        </div>
      `;
    } else {
      diagnosticsHtml += `
        <div class="diagnostic-item success">
          <div class="diagnostic-icon">⚡</div>
          <div class="diagnostic-content">
            <h4>Elite Skipping Skills (${formatSecs(avgCrossTime)} average skip time)</h4>
            <p>Phenomenal paper discipline! You recognized tough problems almost immediately and skipped them. This saved a total of ${formatSecs(totalCrossTime)} which you invested in Ticks and Circles.</p>
          </div>
        </div>
      `;
    }
  }

  // Ticks analysis
  if (tickCount > 0) {
    if (avgTickTime < 120) {
      diagnosticsHtml += `
        <div class="diagnostic-item success">
          <div class="diagnostic-icon">🚀</div>
          <div class="diagnostic-content">
            <h4>Tick Velocity: ${formatSecs(avgTickTime)} per question</h4>
            <p>Very fast! You cleaned up your easy questions with high velocity. This provides a massive confidence and mathematical pacing boost.</p>
          </div>
        </div>
      `;
    } else {
      diagnosticsHtml += `
        <div class="diagnostic-item warning">
          <div class="diagnostic-icon">📈</div>
          <div class="diagnostic-content">
            <h4>Slow Ticks (${formatSecs(avgTickTime)} average)</h4>
            <p>Your Tick questions are taking nearly 2 minutes. Try to build formula fluency so these "easy marks" take even less time.</p>
          </div>
        </div>
      `;
    }
  }

  // Circles analysis
  if (circleCount > 0) {
    diagnosticsHtml += `
      <div class="diagnostic-item warning">
        <div class="diagnostic-icon">◯</div>
        <div class="diagnostic-content">
          <h4>Circle Solving Pacing</h4>
          <p>You solved ${circleCount} Circle questions, taking an average of ${formatSecs(avgCircleTime)}. These represent your main points building zone. Make sure to double check calculations on these.</p>
        </div>
      </div>
    `;
  }

  // Horizontal bar widths for relative times in breakdown
  const maxQTime = Math.max(...session.questions.map(q => q.timeSpent), 1);

  container.innerHTML = `
    <div class="summary-layout">
      <!-- Left Column: Metrics & Actions -->
      <div class="summary-left-pane">
        <!-- Main Stats Card -->
        <div class="bento-card" style="padding: 16px; flex-shrink: 0;">
          <div style="text-align: center; margin-bottom: 12px;">
            <h3 style="margin-bottom: 2px; font-size: 1.1rem;">Attempt Strategy Diagnostic</h3>
            <p style="font-size: 0.75rem; margin-bottom: 0;">${session.config.subject} | ${session.date}</p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div class="metric-card" style="padding: 10px;">
              <div class="value" style="font-size: 1.5rem; color: ${score > 80 ? 'var(--color-tick)' : score > 50 ? 'var(--color-circle)' : 'var(--color-cross)'}">
                ${score}/100
              </div>
              <div class="label" style="font-size: 0.65rem;">Strategy Score</div>
            </div>
            <div class="metric-card" style="padding: 10px;">
              <div class="value" style="font-size: 1.5rem;">${formatSecs(session.elapsedSeconds)}</div>
              <div class="label" style="font-size: 0.65rem;">Duration</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="metric-card" style="padding: 10px;">
              <div class="value" style="font-size: 1.5rem; color: var(--color-tick);">
                ${session.metrics.solvedCount}/${session.config.totalQuestions}
              </div>
              <div class="label" style="font-size: 0.65rem;">Questions Solved</div>
            </div>
            <div class="metric-card" style="padding: 10px;">
              <div class="value" style="font-size: 1.25rem; line-height: 1.2;">
                <span style="color:var(--color-tick)">✓${tickCount}</span> 
                <span style="color:var(--color-circle)">◯${circleCount}</span> 
                <span style="color:var(--color-cross)">✗${crossCount}</span>
              </div>
              <div class="label" style="font-size: 0.65rem;">Tag Balance</div>
            </div>
          </div>
        </div>

        <!-- Time Allocation Card -->
        <div class="bento-card" style="padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0;">
          <h3 style="margin-bottom: 8px; font-size: 0.95rem;">Time Share Allocation</h3>
          <div class="progress-bar-container" style="height: 18px; border-radius: var(--radius-sm); margin-bottom: 12px; flex-shrink: 0;">
            <div class="progress-segment tick" style="width: ${(totalTickTime / Math.max(session.elapsedSeconds, 1)) * 100}%;"></div>
            <div class="progress-segment circle" style="width: ${(totalCircleTime / Math.max(session.elapsedSeconds, 1)) * 100}%;"></div>
            <div class="progress-segment cross" style="width: ${(totalCrossTime / Math.max(session.elapsedSeconds, 1)) * 100}%;"></div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: var(--text-muted);">
            <div class="flex justify-between">
              <span class="flex items-center gap-2"><span class="color-dot tick"></span> Ticks:</span>
              <strong>${formatSecs(totalTickTime)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="flex items-center gap-2"><span class="color-dot circle"></span> Circles:</span>
              <strong>${formatSecs(totalCircleTime)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="flex items-center gap-2"><span class="color-dot cross"></span> Crosses:</span>
              <strong>${formatSecs(totalCrossTime)}</strong>
            </div>
          </div>
        </div>

        <!-- Footer buttons -->
        <div class="flex gap-2" style="flex-shrink: 0;">
          <button class="btn btn-primary btn-sm btn-full" id="btn-done-summary" style="padding: 10px;">New Practice</button>
          <button class="btn btn-secondary btn-sm btn-full" id="btn-goto-history" style="padding: 10px;">History Log</button>
        </div>
      </div>

      <!-- Right Column: Audit details & breakdown list (Scrollable) -->
      <div class="summary-right-pane">
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; font-size: 1.1rem; flex-shrink: 0;">
          Attempt Strategy Audit
        </h3>
        <div class="diagnostics-box" style="padding: 0; border: none; margin-bottom: 16px; box-shadow: none;">
          ${diagnosticsHtml}
        </div>

        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; font-size: 1.1rem; flex-shrink: 0;">
          Question Timeline Breakdown
        </h3>
        <div class="breakdown-list">
          ${session.questions.map((q) => {
            const pct = (q.timeSpent / maxQTime) * 100;
            return `
              <div class="breakdown-row" style="padding: 8px 12px;">
                <div class="breakdown-q-num" style="width: 70px;">Q. ${q.number}</div>
                <div style="width: 180px; display: flex; gap: 4px; align-items: center;">
                  <span class="breakdown-tag-badge ${q.tag}" style="font-size:0.7rem; padding: 2px 6px;">${q.tag.toUpperCase()}</span>
                  <span class="breakdown-tag-badge ${q.solved ? 'tick' : 'unvisited'}" style="font-size:0.65rem; padding: 2px 6px; border: 1px solid ${q.solved ? 'var(--color-tick-border)' : 'var(--color-border)'};">
                    ${q.solved ? 'SOLVED' : 'UNSOLVED'}
                  </span>
                </div>
                <div class="breakdown-bar" style="margin: 0 12px;">
                  <div class="breakdown-bar-fill ${q.tag}" style="width: ${pct}%;"></div>
                </div>
                <div class="breakdown-time" style="font-size: 0.8rem; width: 60px; text-align: right;">
                  ${formatSecs(q.timeSpent)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Bind actions
  const btnDone = container.querySelector('#btn-done-summary');
  const btnHistory = container.querySelector('#btn-goto-history');

  if (btnDone) {
    btnDone.addEventListener('click', () => {
      appState.selectedSummarySession = null;
      showTab('config');
    });
  }

  if (btnHistory) {
    btnHistory.addEventListener('click', () => {
      appState.selectedSummarySession = null;
      showTab('history');
    });
  }
}

// 4. RENDER HISTORY VIEW
function renderHistoryView(container: HTMLElement) {
  if (appState.history.length === 0) {
    container.innerHTML = `
      <div class="summary-container" style="max-width: 650px;">
        <div class="bento-card text-center" style="padding: 48px 24px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📚</div>
          <h2>No Practice History Yet</h2>
          <p>Complete a timed session using the Tick-Circle-Cross system to see your attempt efficiency audits recorded here.</p>
          <button class="btn btn-primary" id="btn-history-start">Configure Session</button>
        </div>
      </div>
    `;
    
    const btnHistoryStart = container.querySelector('#btn-history-start');
    if (btnHistoryStart) {
      btnHistoryStart.addEventListener('click', () => showTab('config'));
    }
    return;
  }

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m} mins`;
  };

  const calculateSessionScore = (s: SavedSession) => {
    let totalCrossTime = s.metrics.totalTimeCrosses;
    let crossCount = s.metrics.crossesCount;
    let avgCrossTime = crossCount > 0 ? totalCrossTime / crossCount : 0;
    
    let baseScore = 100;
    let crossPenalty = 0;
    if (crossCount > 0 && avgCrossTime > 60) {
      crossPenalty = Math.min(40, Math.round((avgCrossTime - 60) / 4));
    }
    let unvisitedPenalty = s.metrics.unvisitedCount * 8;
    return Math.max(0, baseScore - crossPenalty - unvisitedPenalty);
  };

  container.innerHTML = `
    <div class="history-layout">
      <!-- Left Pane: Stats & Controls -->
      <div class="history-left-pane">
        <div class="bento-card" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h2 style="margin-bottom: 8px;">History Log</h2>
            <p style="font-size: 0.85rem;">Select any previous practice session on the right to review its strategy pacing audit and question timeline.</p>
            
            <div style="margin-top: 16px; padding: 16px; background-color: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 2.25rem; font-weight: 700; color: var(--color-primary);">${appState.history.length}</div>
              <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Total Sessions Done</div>
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 24px;">
            <button class="btn btn-primary btn-sm btn-full" id="btn-history-start">New Practice</button>
            <button class="btn btn-danger btn-sm btn-full" id="btn-clear-history">Clear All History</button>
          </div>
        </div>
      </div>

      <!-- Right Pane: List of Sessions -->
      <div class="history-right-pane">
        ${appState.history.map((session) => {
          const score = calculateSessionScore(session);
          return `
            <div class="history-item" data-session-id="${session.id}" style="cursor: pointer; padding: 16px;">
              <div class="history-meta">
                <div class="history-subject" style="font-size:1.05rem;">${session.config.subject}</div>
                <div class="history-date">${session.date} | Target: ${session.config.difficulty.toUpperCase()}</div>
              </div>
              <div class="history-details" style="gap: 12px;">
                <div class="history-stat">
                  <div class="history-stat-value" style="color: ${score > 80 ? 'var(--color-tick)' : score > 50 ? 'var(--color-circle)' : 'var(--color-cross)'}; font-size:1.05rem;">
                    ${score}/100
                  </div>
                  <div class="history-stat-label" style="font-size:0.65rem;">Strategy</div>
                </div>
                <div class="history-stat">
                  <div class="history-stat-value" style="font-size:1.05rem;">${session.config.totalQuestions}</div>
                  <div class="history-stat-label" style="font-size:0.65rem;">Ques</div>
                </div>
                <div class="history-stat">
                  <div class="history-stat-value" style="font-size:1.05rem;">${formatSecs(session.elapsedSeconds)}</div>
                  <div class="history-stat-label" style="font-size:0.65rem;">Time</div>
                </div>
                <div class="history-stat">
                  <div class="history-stat-value" style="font-size:1.05rem;">
                    <span style="color:var(--color-tick)">✓${session.metrics.ticksCount}</span>
                    <span style="color:var(--color-circle)">◯${session.metrics.circlesCount}</span>
                    <span style="color:var(--color-cross)">✗${session.metrics.crossesCount}</span>
                  </div>
                  <div class="history-stat-label" style="font-size:0.65rem;">Tags</div>
                </div>
                <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">View</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Bind session select click
  const historyItems = container.querySelectorAll('.history-item');
  historyItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      // Prevent trigger if clicking container buttons specifically (if any)
      const targetId = (e.currentTarget as HTMLElement).getAttribute('data-session-id');
      const selected = appState.history.find(h => h.id === targetId);
      if (selected) {
        appState.selectedSummarySession = selected;
        showTab('summary');
      }
    });
  });

  // Bind clear history
  const btnClear = container.querySelector('#btn-clear-history');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete all practice history? This cannot be undone.')) {
        appState.history = [];
        localStorage.removeItem('jee-timer-history');
        renderHistoryView(container);
      }
    });
  }
}

// -------------------------------------------------------------
// MODALS & DIALOGS
// -------------------------------------------------------------
function showPauseModal(title: string, message: string, onConfirm?: () => void, showDiscard = false) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="custom-modal">
      <div class="modal-content">
        <h3 style="margin-bottom: 12px; font-size: 1.3rem;">${title}</h3>
        <p style="margin-bottom: 24px; font-size: 0.95rem; color: var(--text-muted); line-height: 1.4;">
          ${message}
        </p>
        <div class="modal-actions">
          ${showDiscard ? `<button class="btn btn-danger btn-sm" id="modal-btn-discard" style="margin-right: auto;">Discard Test</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="modal-btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="modal-btn-confirm">Continue</button>
        </div>
      </div>
    </div>
  `;

  // Trigger DOM frame display with short timeout for transition
  const modal = container.querySelector('#custom-modal') as HTMLElement;
  setTimeout(() => {
    if (modal) modal.classList.add('open');
  }, 10);

  const btnConfirm = container.querySelector('#modal-btn-confirm');
  const btnCancel = container.querySelector('#modal-btn-cancel');
  const btnDiscard = container.querySelector('#modal-btn-discard');

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => {
        container.innerHTML = '';
      }, 250);
    }
  };

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      closeModal();
      if (onConfirm) onConfirm();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      closeModal();
      // If paused modal cancels, keep it paused but close overlay
    });
  }

  if (btnDiscard) {
    btnDiscard.addEventListener('click', () => {
      closeModal();
      if (confirm('Are you absolutely sure you want to discard this practice set? None of your logs will be saved.')) {
        discardActiveSession();
      }
    });
  }
}

function showHelpModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="help-modal">
      <div class="modal-content" style="max-width: 520px; text-align: left;">
        <h3 style="margin-bottom: 16px; font-size: 1.25rem; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
          📖 How to Use the Pacing Timer
        </h3>
        <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main); display: flex; flex-direction: column; gap: 12px; max-height: 380px; overflow-y: auto; padding-right: 6px;">
          <p>
            This timer is built on the **Tick-Circle-Cross paper-solving method** (popularized by <em>Amit Agarwal Sir, Allen</em>) to train you for efficient paper attempt strategy during mock tests and self-practice.
          </p>
          
          <div>
            <strong style="color: var(--color-tick);">✓ Ticks (Easy / Solved immediately):</strong>
            <p style="margin: 2px 0 0 0; color: var(--text-muted);">
              Questions you immediately recognize and can solve fast. Secure these marks in Pass 1. Marking a Tick automatically marks it Solved.
            </p>
          </div>
          
          <div>
            <strong style="color: var(--color-circle);">◯ Circles (Think / Solvable with effort):</strong>
            <p style="margin: 2px 0 0 0; color: var(--text-muted);">
              Questions you know how to solve, but require deep thought or calculation. Save them for Pass 2. Toggle the Solved switch when finished.
            </p>
          </div>
          
          <div>
            <strong style="color: var(--color-cross);">✗ Crosses (Tough / Speed-breakers):</strong>
            <p style="margin: 2px 0 0 0; color: var(--text-muted);">
              Trap questions or concepts you have no idea about. **Skip them in under 45 seconds** by tagging them Cross. This saves precious minutes.
            </p>
          </div>

          <div style="border-top: 1px dashed var(--color-border); padding-top: 8px;">
            <strong>📝 Quick Controls Guide:</strong>
            <ul style="margin: 4px 0 0 16px; padding: 0; color: var(--text-muted); list-style-type: disc;">
              <li>Work on your physical practice workbook or paper.</li>
              <li>Toggle <strong>Solved / Unsolved</strong> in the active workspace to log outcome.</li>
              <li>Hover over the timer clock to reveal the remaining time in <strong>Stealth Mode</strong>.</li>
              <li>End the session to view your <strong>Attempt Strategy Diagnostics</strong> and Strategy Score.</li>
            </ul>
          </div>
          
          <div style="font-size: 0.7rem; color: var(--text-muted); text-align: center; border-top: 1px solid var(--color-border); padding-top: 8px; margin-top: 4px;">
            Method Credit: Amit Agarwal Sir (Allen Career Institute)
          </div>
        </div>
        <div class="modal-actions" style="margin-top: 20px; justify-content: flex-end;">
          <button class="btn btn-primary btn-sm" id="help-btn-close" style="padding: 8px 16px;">Got it, Let's Practice</button>
        </div>
      </div>
    </div>
  `;

  const modal = container.querySelector('#help-modal') as HTMLElement;
  setTimeout(() => {
    if (modal) modal.classList.add('open');
  }, 10);

  const btnClose = container.querySelector('#help-btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
          container.innerHTML = '';
        }, 250);
      }
    });
  }
}

function showFeedbackModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="feedback-modal">
      <div class="modal-content" style="max-width: 420px; text-align: left;">
        <h3 style="margin-bottom: 12px; font-size: 1.2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
          💬 Send Feedback
        </h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.4;">
          Have a suggestion, bug report, or feature request? Send it straight to the creator!
        </p>
        
        <form id="feedback-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label for="feedback-name" style="font-size: 0.75rem;">Your Name</label>
            <input type="text" id="feedback-name" class="form-control" placeholder="e.g. Rahul, Priya" style="padding: 8px; font-size: 0.85rem;" required>
          </div>
          
          <div class="form-group" style="margin-bottom: 0;">
            <label for="feedback-email" style="font-size: 0.75rem;">Your Email Address (for replies)</label>
            <input type="email" id="feedback-email" class="form-control" placeholder="name@example.com" style="padding: 8px; font-size: 0.85rem;" required>
          </div>
          
          <div class="form-group" style="margin-bottom: 0;">
            <label for="feedback-msg" style="font-size: 0.75rem;">Message</label>
            <textarea id="feedback-msg" class="form-control" rows="4" placeholder="What can we improve?..." style="padding: 8px; font-size: 0.85rem; resize: vertical;" required></textarea>
          </div>
          
          <div id="feedback-status-msg" style="font-size: 0.8rem; display: none; margin-top: 4px;"></div>
          
          <div class="modal-actions" style="margin-top: 12px; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="feedback-btn-cancel" style="padding: 6px 12px;">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" id="feedback-btn-submit" style="padding: 6px 16px;">Send Message</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#feedback-modal') as HTMLElement;
  setTimeout(() => {
    if (modal) modal.classList.add('open');
  }, 10);

  const form = container.querySelector('#feedback-form') as HTMLFormElement;
  const btnCancel = container.querySelector('#feedback-btn-cancel');
  const btnSubmit = container.querySelector('#feedback-btn-submit') as HTMLButtonElement;
  const statusMsg = container.querySelector('#feedback-status-msg') as HTMLElement;

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => {
        container.innerHTML = '';
      }, 250);
    }
  };

  if (btnCancel) {
    btnCancel.addEventListener('click', closeModal);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nameInput = container.querySelector('#feedback-name') as HTMLInputElement;
      const emailInput = container.querySelector('#feedback-email') as HTMLInputElement;
      const msgInput = container.querySelector('#feedback-msg') as HTMLTextAreaElement;
      
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Sending...";
      statusMsg.style.display = 'none';

      // Submit via FormSubmit AJAX (100% free, zero backend setup)
      fetch("https://formsubmit.co/ajax/rsgokulanand@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: nameInput.value,
          email: emailInput.value,
          message: msgInput.value,
          _subject: "JEE Strategic Timer - Student Feedback"
        })
      })
      .then(response => {
        if (!response.ok) throw new Error("Network error");
        return response.json();
      })
      .then(() => {
        statusMsg.style.display = 'block';
        statusMsg.style.color = 'var(--color-tick-text)';
        statusMsg.textContent = "✓ Sent! Thank you for your feedback.";
        
        setTimeout(() => {
          closeModal();
        }, 1500);
      })
      .catch(() => {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Send Message";
        statusMsg.style.display = 'block';
        statusMsg.style.color = 'var(--color-cross-text)';
        statusMsg.textContent = "❌ Failed to send. Please check your internet connection.";
      });
    });
  }
}

function showSocialsModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="socials-modal">
      <div class="modal-content" style="max-width: 380px; text-align: center; padding: 24px;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-gradient-stop, #38bdf8)); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; margin: 0 auto 12px auto; box-shadow: var(--shadow-sm);">
          GA
        </div>
        
        <h3 style="margin-bottom: 4px; font-size: 1.25rem;">Gokul Anand</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">JEE Pacing System Creator</p>
        
        <div style="display: flex; flex-direction: column; gap: 8px; text-align: left; margin-bottom: 20px;">
          <a href="https://x.com/not_gallium" target="_blank" class="social-link-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); text-decoration: none; color: var(--text-main); font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X / Twitter
            </span>
            <span style="color: var(--color-primary); font-size: 0.8rem;">@not_gallium →</span>
          </a>
          
          <a href="https://instagram.com/not_gallium" target="_blank" class="social-link-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); text-decoration: none; color: var(--text-main); font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
              Instagram
            </span>
            <span style="color: var(--color-primary); font-size: 0.8rem;">@not_gallium →</span>
          </a>
          
          <a href="https://linkedin.com/in/gokulanand14" target="_blank" class="social-link-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); text-decoration: none; color: var(--text-main); font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              LinkedIn
            </span>
            <span style="color: var(--color-primary); font-size: 0.8rem;">gokulanand14 →</span>
          </a>
          
          <a href="https://youtube.com/@GAllium14" target="_blank" class="social-link-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); text-decoration: none; color: var(--text-main); font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube
            </span>
            <span style="color: var(--color-primary); font-size: 0.8rem;">GAllium14 →</span>
          </a>
        </div>
        
        <div class="modal-actions" style="justify-content: center; margin-top: 12px;">
          <button class="btn btn-secondary btn-sm" id="socials-btn-close" style="padding: 8px 24px;">Close</button>
        </div>
      </div>
    </div>
  `;

  const modal = container.querySelector('#socials-modal') as HTMLElement;
  setTimeout(() => {
    if (modal) modal.classList.add('open');
  }, 10);

  const btnClose = container.querySelector('#socials-btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
          container.innerHTML = '';
        }, 250);
      }
    });
  }
}

// -------------------------------------------------------------
// APP START
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
// Fallback in case DOMContentLoaded has already fired (Vite HMR)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
}
