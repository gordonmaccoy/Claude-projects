# Exam Monitor (MVP)

A minimal classroom tool with two parts:

1. A **student calculator** page (mobile-first, opened via QR code).
2. A **professor dashboard** that shows, in real time, whether each student's
   calculator page is currently visible.

Students show as **GREEN** when the calculator tab is visible and sending a
heartbeat, and **RED** when the tab is hidden, backgrounded, closed, or
disconnected.

## Run locally

```bash
cd exam-monitor
npm install
npm start
```

Then open:

- Professor: http://localhost:3100/professor.html
- Student (manual): http://localhost:3100/student.html?session=XXXXXX

Click **Start New Session** on the professor page. Scan the QR code with a
phone, or share the join URL. The student enters their name and lands on the
calculator; they appear on the dashboard immediately.

### Letting phones join over Wi-Fi

To scan the QR code from a phone on the same network, run the server on your
laptop and access it via its LAN IP (e.g. `http://192.168.1.42:3100/professor.html`).
The generated QR code uses whatever origin the professor page was loaded from,
so load the professor page via the LAN IP as well, not `localhost`.

## Calculator

Basic 4-function calculator with parentheses and nested parentheses. Supports
standard order of operations. Keyboard input works on desktop for quick
testing (digits, `+ - * /`, `( )`, `.`, `Enter`/`=`, `Backspace`, `Esc`/`C`).

Evaluation is done with `Function(...)` after the expression is whitelisted to
digits, `+ - * /`, `.`, `(`, `)`, and whitespace. No identifiers or property
access can pass the whitelist.

## What this does and does not do

**What it does:**
- Detects when the calculator **tab** becomes hidden, backgrounded, minimized,
  closed, or disconnected, via `visibilitychange`, `pagehide`, and a 3-second
  heartbeat.
- Updates the professor dashboard in real time via Socket.IO.

**What it does not do:**
- It does **not** detect which app or website the student switched to.
- It is **not** a lockdown browser or anti-cheating system.
- It does not record the student's activity, camera, microphone, or screen.
- A student with browser DevTools open can easily stop or spoof the heartbeat.
  Treat this purely as a visibility monitor.

## Architecture

- `server.js` — Express + Socket.IO. In-memory `Map` of sessions. A 2-second
  interval checks heartbeat staleness (`>10s`) and the 60-second disconnect
  grace window.
- `public/professor.*` — dashboard UI, QR rendering, student list.
- `public/student.*` — join form and calculator, visibility and heartbeat
  wiring.

Single active session per professor socket. Restarting the server drops all
state. That is acceptable for MVP; not for production.

## Future expansion (not built)

The code is structured so these could be added later without a rewrite:
- Multiple choice questions
- Timed exams
- Answer submission
- Persistent storage
