export function matchAuthForm(
  task,
  observation
) {
  const objective = task?.objective?.toLowerCase() || "";
  const isAuth = objective.includes("login") || objective.includes("log in") || objective.includes("sign in") || task?.intent === "authenticate";

  if (
    isAuth &&
    observation?.events?.includes(
      "auth_form_detected"
    )
  ) {
    return {
      achieved: true,
      reason:
        "auth_form_detected"
    };
  }

  return null;
}
