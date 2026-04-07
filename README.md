# SLIIT Mid Practice Quiz (Local)

This is a simple local website for MSQ practice.

It now saves the latest loaded MCQ set and your quiz session in browser local storage, so you do not need to import every refresh.

## What this project does

- Loads questions from TXT format
- Builds adaptive rounds (up to 20 questions) based on performance
- Asks one question at a time
- Checks your answer and shows reasoning
- Renders multi-line Java/code snippets in the question area
- Tracks score and topic-wise performance
- Identifies weak topics and allows weak-topic practice

## Quiz behavior

- `TYPE: MCQ` questions are single-select.
- `TYPE: MSQ` questions are multi-select.
- After each round, click **Start Next Round** to get a fresh adaptive set.
- Each question has a timer and auto-moves on timeout.
- Round progress and timer bars are shown in Practice view.
- Keyboard shortcut: press **Space** to submit (after selecting), then **Space** again to move to the next question.
- Dashboard includes detailed counts (wrong, skipped, timed out, unseen) and a topic breakdown table.
- Dashboard subject selector scopes analytics and upcoming rounds to one subject or all subjects.

## Files

- `index.html` - app UI
- `style.css` - styling
- `app.js` - parsing + quiz logic + dashboard
- `mcq-data.txt` - sample question data file (you can replace with your own)
- `mcq-template.txt` - clean template for pasting your own GPT MCQs

## How to run

The app has three views:

- Dashboard: progress, analytics, and weak topics
- Practice: answer adaptive quiz rounds
- Load Question Data: paste/upload/import MCQ data

Option 1 (easiest):

1. Open `index.html` in a browser.
2. Open `mcq-data.txt`, copy all text, and paste into the text area.
3. Click **Load From Text**.

Option 2 (upload file):

1. Open `index.html` in a browser.
2. Click **Choose TXT File** and select your question file.
3. Click **Load From File**.

Option 3 (one-click project file import):

1. Run the app through a local web server.
2. Click **Load mcq-data.txt** to import the workspace file directly.

Option 4 (automatic project-file updates):

1. Run the app through a local web server.
2. The app auto-checks `mcq-data.txt` every few seconds and on tab focus.
3. If the file changed, question data is auto-synced.

## Local save behavior

- After loading questions, data is stored in browser local storage.
- On refresh/reopen in the same browser, the previous session is restored automatically.
- Dashboard progress/history is stored locally and restored after browser restart.
- **Reset Session** clears the local saved data.

Note: Automatic reading of `mcq-data.txt` requires serving the app over HTTP (local server). Direct `file:///` opening may block automatic file access in browsers.

## Required TXT format

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
