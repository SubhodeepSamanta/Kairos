export function matchAuthForm(
  task,
  observation
) {

  if (
    task?.intent ===
      "authenticate" &&
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

export function matchMediaLoaded(
  task,
  observation
) {

  if (
    task?.intent ===
      "media" &&
    observation?.pageState?.url
      ?.includes("/watch")
  ) {

    return {
      achieved: true,
      reason:
        "media_loaded"
    };
  }

  return null;
}