export function matchNavigation() {
  return null;
}



export function matchFormFill() {
  return null;
}

export function matchTabSwitch() {
  return null;
}

export function matchReadPage() {
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