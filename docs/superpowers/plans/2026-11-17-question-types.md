# New Question Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add True/False and AI partial-credit Short Answer questions throughout Examio.
**Architecture:** Persist both types in existing quiz/session JSON. A focused grading module owns assessment state and a server worker persists retryable jobs outside database locks. Existing result and export code consumes normalized question assessments.
**Tech Stack:** Node, Express, PostgreSQL, Socket.IO, OpenAI Responses, vanilla browser JavaScript.
**Spec:** ../specs/2026-11-17-question-types-design.md

## Global Constraints
Preserve existing quizzes; short answers bounded at 2,000 characters; never zero a provider failure; partial points rounded to two decimals; professor override retains original assessment; all delivery modes and exports supported.

## Review Focus
- Malicious student instructions must remain untrusted answer data.
- Concurrent/replayed worker runs must not overwrite professor overrides.
- Timer and professor-ended sessions must persist unanswered/pending grades.
- Student capabilities must not reveal keys before configured feedback.
- Provider outages/restarts must retain pending scores, never silently zero them.

### Task 1: Model and assessment state
Files: exam.js, delivery.js, grading.js, test/question-types.test.js.
Interfaces: grading.assessment(question,answer,student) returns {points,status,pending,explanation}; grading.prepare(session) creates persisted jobs; grading.override(session,studentId,questionId,ownerId,points,reason) records override.
- [ ] Write and run failing tests for validation, score bounds, pending totals, feedback privacy, overrides, and expiry.
- [ ] Implement types, grading state, aggregation and answer validation.
- [ ] Run model/delivery tests and commit.

### Task 2: Durable grading and API
Files: short-answer-ai.js, grading-worker.js, server.js, store.js, test/short-answer-grading.test.js.
Interfaces: createShortAnswerGrader(options)(question,answer) returns {points,explanation}; createGradingWorker({store,grade,broadcast}).process(sessionId), .tick(), .close().
- [ ] Write and run failing tests for malicious answers, finite score validation, deduplication, retries/restart, owner-only override, end/time submissions.
- [ ] Implement structured AI response, persisted job claims/leases, retry backoff, worker startup/tick and authenticated overrides.
- [ ] Run focused server tests and commit.

### Task 3: Authoring, student experience, results and exports
Files: public/professor.js, public/student.js, public/professor.css, public/student.css, public/result-analysis.js, public/ko.js, export.js, results-pdf.js, quiz-pdf.js, generation.js, answer-key.js.
Interfaces: new quiz types truefalse and short; short stores modelAnswer and gradingGuidance; results expose earnedPoints/maxPoints/pending/explanation/AI original/override to professor only.
- [ ] Write and run failing tests for fractional statistics and pending exports; browser-test authoring, feedback and override.
- [ ] Add editor types, multiline student answers, pending/partial feedback, private review controls, correct weighted averages and export labels.
- [ ] Verify all existing tests, three delivery flows, timer/end, privacy, PDF/Excel, and commit.

### Task 4: Review and publish
- [ ] Run one independent whole-change review, resolve material findings with regression tests.
- [ ] Fetch/reconcile shared release branch, publish Public only, verify deployment and live assets.
