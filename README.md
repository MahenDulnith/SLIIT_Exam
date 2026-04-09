# SLIIT Mid Practice Quiz (Local)

This is a simple local website for MSQ practice.

It reads questions directly from `mcq-data.txt` and saves your quiz session in browser local storage.

Current release: Version 1.2

## What this project does

- Loads questions directly from `mcq-data.txt`
- Builds adaptive rounds (up to 20 questions) based on performance
- Asks one question at a time
- Checks your answer and shows reasoning
- Renders multi-line Java/code snippets in the question area
- Tracks score and topic-wise performance
- Identifies weak topics and allows weak-topic practice
- Supports blocking invalid or unwanted questions directly from Practice
- Includes start overlay, review-mistakes mode, and end-of-round summary modal
- Includes motivation cues (daily streak, session target, coverage ring)

## Quiz behavior

- `TYPE: MCQ` questions are single-select.
- `TYPE: MSQ` questions are multi-select.
- After each round, click **Start Next Round** to get a fresh adaptive set.
- Each question has a timer and auto-moves on timeout.
- Round progress and timer bars are shown in Practice view.
- Keyboard shortcut: press **Space** to submit (after selecting), then **Space** again to move to the next question.
- Dashboard includes detailed counts (wrong, skipped, timed out, unseen) and a topic breakdown table.
- Dashboard subject selector scopes analytics and upcoming rounds to one subject or all subjects.
- Practice opens with a start overlay: Resume Session, Start New Round, Practice Weak Topics, Review Mistakes.
- Practice includes a **Block Question** button to exclude bad tutorial/ambiguous questions.
- Feedback is two-step: quick result first, expandable explanation next.
- Practice HUD is sticky and shows subject, current streak, target progress, and completion ring.
- On mobile, action buttons stay reachable using a sticky bottom action bar.
- Accessibility: keyboard focus rings, `aria-live` feedback/timer cues.

## New v1.2 modes

- **Review Mistakes**: builds a round from recent wrong/skipped/timed-out questions.
- **Round Summary Modal**: shows answered, correct, accuracy, timed out, and weak-topic hits.
- **Blocked Questions List**: shown on Dashboard with unblock, export, and clear actions.

## Files

- `index.html` - app UI
- `style.css` - styling
- `app.js` - parsing + quiz logic + dashboard
- `mcq-data.txt` - sample question data file (you can replace with your own)
- `mcq-template.txt` - optional template for creating new question blocks

## How to run

The app has two views:

- Dashboard: progress, analytics, and weak topics
- Practice: answer adaptive quiz rounds

How data updates work:

1. Run the app through a local web server.
2. The app auto-checks `mcq-data.txt` every few seconds and on tab focus.
3. If the file changed, question data is auto-synced.
4. You can also click **Reload mcq-data.txt** from the Dashboard.

## Local save behavior

- After loading from `mcq-data.txt`, data is stored in browser local storage.
- On refresh/reopen in the same browser, the previous session is restored automatically.
- Dashboard progress/history is stored locally and restored after browser restart.
- Blocked questions are stored in a separate local key and are preserved across session resets.
- You can download blocked questions as `blocked-questions.txt` for manual review and cleanup.
- **Reset Session** clears the local saved data.

Note: Automatic reading of `mcq-data.txt` requires serving the app over HTTP (local server). Direct `file:///` opening may block automatic file access in browsers.

## Required TXT format (for mcq-data.txt)

Each question must be wrapped with:

- `QUESTION_START`
- `QUESTION_END`

Required fields per block:

- `ID`
- `MODULE`
- `TOPIC`
- `QUESTION`
- `OPTION_A` ... (`OPTION_B` at least)
- `ANSWER` (letters separated by commas for MSQ, e.g., `A,C`)
- `REASONING`

You can also add optional fields:

- `SUBTOPIC`
- `DIFFICULTY`
- `TYPE`

Use `mcq-data.txt` as your template.

If you want a clean starting point, use `mcq-template.txt`.
