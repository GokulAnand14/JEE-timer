# ⚡ JEE Strategic Pacing Timer

Preparing for the JEE (Joint Entrance Examination) isn't just about memorizing formulas—it's about mastering **paper attempt strategy**. 

This application is a sleek, bento-grid based practice companion designed to help JEE aspirants build the muscle memory of selective question prioritization, manage time anxiety, and avoid "speed-breaker" questions.

---

## 🎯 The Core Philosophy: The Tick-Circle-Cross System

In JEE, every question carries equal marks, but not equal difficulty. High scorers win by aggressively filtering questions. This app is built to train your instincts around three tags:

*   **Tick (✓) — "Solved & Easy":** Questions you immediately recognize and can solve in under 2 minutes. Secure these marks in Pass 1.
*   **Circle (◯) — "Think & Solve":** Questions where you know the concept, but they require calculation or deep thinking. Tag them and solve them in Pass 2.
*   **Cross (✗) — "Speed-Breakers":** Extremely lengthy, trap-like, or unknown concepts. **Crossing them out in under 45 seconds is a win**—it saves precious time to invest in Ticks and Circles.

---

## ✨ Features

*   **Compact Bento-Grid Dashboard:** Viewport-fitted for laptop screens. No page scrolling, no layout breaks—designed to feel like a native desktop workspace.
*   **Anxiety-Free Stealth Timer:** Hides the ticking countdown under a gentle blur (reveal on hover/tap) to stop you from panicking and help you focus on the problem at hand.
*   **Buffer Pacing Calculator:** Automatically calculates healthy time limits as you enter question count, ensuring practice session limits are realistic and constructive (e.g. 6 mins/Q for Advanced, 3.5 mins/Q for Main).
*   **Post-Session Diagnostics:** Audits your performance by scoring your attempt strategy. It alerts you if you fell into "speed-breaker traps" (spent too long on questions you eventually crossed out) or left sections unvisited.
*   **Revision History Log:** Persists all past attempts locally in your browser so you can monitor your progress and check if your skipping speed is improving.
*   **Distraction-Free Ocean Theme:** Stills the eyes with a calm Sky-Blue focusing color scheme, keeping your mind alert and relaxed.

---

## 🚀 Getting Started

This template is built using **Vite**, **TypeScript**, and **Vanilla CSS** with zero external heavy libraries for near-instant load times.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) or [Bun](https://bun.sh) installed.

### Setup and Running

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/GokulAnand14/JEE-timer.git
    cd JEE-timer
    ```

2.  **Install dependencies:**
    Using Bun:
    ```bash
    bun install
    ```
    Using NPM:
    ```bash
    npm install
    ```

3.  **Start the development server:**
    Using Bun:
    ```bash
    bun run dev
    ```
    Using NPM:
    ```bash
    npm run dev
    ```

4.  Open the local address (usually `http://localhost:5173`) in your browser.

---

## 📝 Practice Workflow

1.  **Configure:** Input your practice topic, enter custom question count, select your target difficulty (Main/Advanced), and keep **Stealth Timer** enabled.
2.  **Solve:** Work on your physical practice workbook. As you complete or skip each question, tag it as **Tick**, **Circle**, or **Cross** in the workspace panel.
3.  **Audit:** Finish the session and read the attempt strategy diagnostics to see where you wasted time and how effectively you scanned the paper.
