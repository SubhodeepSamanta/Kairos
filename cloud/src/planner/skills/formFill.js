export const formFillSkill = {
  name: "FormFillSkill",
  canHandle(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    return objective.includes("login") || objective.includes("sign in") || objective.includes("sign up") || objective.includes("fill") || objective.includes("submit");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    if (objective.includes("login") || objective.includes("sign in")) {
      const emailInput = (browserState.inputs || []).find(input => input.purpose === "login_email");
      const passwordInput = (browserState.inputs || []).find(input => input.purpose === "login_password");
      const submitBtn = (browserState.buttons || []).find(btn => btn.purpose === "login_button" || btn.purpose === "submit_button");

      if (emailInput && !emailInput.value) {
        actions.push({
          type: "type",
          params: {
            element: emailInput.id,
            text: "user@example.com"
          }
        });
      }
      if (passwordInput && !passwordInput.value) {
        actions.push({
          type: "type",
          params: {
            element: passwordInput.id,
            text: "password"
          }
        });
      }
      if (submitBtn) {
        actions.push({
          type: "click",
          params: {
            element: submitBtn.id
          }
        });
      }
      if (actions.length > 0) return actions;
    }
    return null;
  }
};
