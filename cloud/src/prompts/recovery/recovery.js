export const recoveryPrompt = `Failure Recovery Rules:
- If the last action did not change the page state (URL/Title/HTML content remain identical):
  - Do not repeat it.
  - Choose a different action.
- If multiple actions have failed:
  - Inspect the page again.
  - Reconsider assumptions.`;
