const state = {

  goal: null,

  plan: null,

  observation: null,

  browser: null
};

export function setGoal(
  goal
) {
  state.goal = goal;
}

export function getGoal() {
  return state.goal;
}

export function setPlan(
  plan
) {
  state.plan = plan;
}

export function getPlan() {
  return state.plan;
}

export function setObservation(
  observation
) {
  state.observation =
    observation;
}

export function getObservation() {
  return state.observation;
}

export function setBrowserState(
  browser
) {
  state.browser =
    browser;
}

export function getBrowserState() {
  return state.browser;
}

export function getAgentState() {
  return state;
}