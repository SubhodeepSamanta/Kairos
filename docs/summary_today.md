# Summary of Fixes - 2026-06-17

## Problems Found
1. **Empty Query Bug (Lazy-Match)**:
   - Regex patterns in skills (`youtube.js`, `google.js`, `wikipedia.js`, `reddit.js`, `yahoo.js`, `linkedin.js`, `instagram.js`, `amazon.js`, `github.js`) used lazy matching `(.*?)` with optional quotes `(['"]?)`.
   - On unquoted inputs (e.g. `search github for react`), the regex captured empty string `""` because matching 0 characters satisfied the lazy match.
   - Resulted in empty search queries, bypassing the Skill Router or causing partial execution (typing empty string).

2. **GitHub Page Interaction**:
   - GitHub home has `search_button` instead of standard `search_input`.
   - Router did not click the search button first, or failed to input/submit query correctly when command palette opened.

## Fixes Implemented
1. **Robust Query Extraction**:
   - Replaced lazy-match regexes in ALL platform skills with a robust string replace cleaning method.
   - Strips common command verbs, platform names, and quotes reliably without empty lazy matching.
2. **GitHub Command Palette Flow**:
   - Updated `githubSkill.js` to click the search trigger if `search_input` is not present, then type and press `Enter` on next turn when modal is open.
3. **Enhanced Log Tracing**:
   - Added `[ROUTER]`, `[CAPABILITY GRAPH]`, and `[SKILL CHECK]` logging.
