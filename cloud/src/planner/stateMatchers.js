export function matchNavigation(
  intent,
  observation
) {

  if (
    observation?.expected ===
      "page_loaded" &&
    observation?.success
  ) {

    return {
      achieved: true,
      reason:
        "page_loaded"
    };
  }

  return null;
}



export function matchFormFill(
  intent,
  observation
) {

  if (
    observation?.expected !==
    "text_typed"
  ) {
    return null;
  }

  return {
    achieved: true,
    reason:
      "form_filled"
  };
}

export function matchTabSwitch(
  intent,
  observation
) {

  if (
    observation?.expected !==
    "tab_switched"
  ) {
    return null;
  }

  return {
    achieved: true,
    reason:
      "tab_switched"
  };
}

export function matchReadPage(
  intent,
  observation
) {

  if (
    observation?.expected !==
    "page_read"
  ) {
    return null;
  }

  if (
    intent?.type ===
    "generic"
  ) {

    return {
      achieved: true,
      reason:
        "page_read"
    };
  }

  return null;
}

export function matchEvents(
  intent,
  observation
) {

  const events =
    observation?.events || [];

  if (
    intent?.type ===
      "authenticate" &&
    events.includes(
      "login_page_opened"
    )
  ) {

    return {
      achieved: true,
      reason:
        "login_page_opened"
    };
  }

  if (
    intent?.type ===
      "media" &&
    events.includes(
      "video_page_opened"
    )
  ) {

    return {
      achieved: true,
      reason:
        "video_page_opened"
    };
  }

  return null;
}