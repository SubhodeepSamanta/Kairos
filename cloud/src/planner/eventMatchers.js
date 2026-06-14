export function matchAuthForm(
  intent,
  observation
) {

  if (
    intent?.type ===
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
  intent,
  observation
) {

  if (
    intent?.type ===
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