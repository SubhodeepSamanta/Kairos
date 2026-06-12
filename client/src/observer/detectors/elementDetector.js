export function detectElementEvents(
  beforeState,
  afterState
) {

  const events = [];

  const beforeInputs =
    beforeState?.inputs?.length || 0;

  const afterInputs =
    afterState?.inputs?.length || 0;

  const beforeButtons =
    beforeState?.buttons?.length || 0;

  const afterButtons =
    afterState?.buttons?.length || 0;

  const beforeLinks =
    beforeState?.links?.length || 0;

  const afterLinks =
    afterState?.links?.length || 0;

  if (afterInputs > beforeInputs) {
    events.push("new_inputs");
  }

  if (afterButtons > beforeButtons) {
    events.push("new_buttons");
  }

  if (afterLinks > beforeLinks) {
    events.push("new_links");
  }

  if (afterInputs < beforeInputs) {
    events.push("removed_inputs");
  }

  if (afterButtons < beforeButtons) {
    events.push("removed_buttons");
  }

  if (afterLinks < beforeLinks) {
    events.push("removed_links");
  }

  return events;
}