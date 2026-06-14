export function matchNavigation(
  intent,
  observation
) {

  const text = `
    ${observation?.after?.url || ""}
    ${observation?.pageState?.url || ""}
    ${observation?.pageState?.title || ""}
  `.toLowerCase();

  const terms =
    intent?.entities || [];

  const matches =
    terms.filter(term =>
      text.includes(term)
    );

  if (matches.length > 0) {

    return {
      achieved: true,
      reason:
        "navigation_match",
      matches
    };
  }

  return null;
}



export function matchLogin(
  intent,
  observation
) {

  if (
    intent?.type !==
    "authenticate"
  ) {
    return null;
  }

  const url = (
    observation?.pageState?.url ||
    observation?.after?.url ||
    ""
  ).toLowerCase();

  if (
    url.includes("login") ||
    url.includes("signin") ||
    url.includes("sign-in")
  ) {

    return {
      achieved: true,
      reason:
        "login_page_detected"
    };
  }

  return null;
}

export function matchVideo(
  intent,
  observation
) {

  if (
    intent?.type !==
    "media"
  ) {
    return null;
  }

  const url = (
    observation?.pageState?.url ||
    observation?.after?.url ||
    ""
  ).toLowerCase();

  if (
    url.includes("/watch")
  ) {

    return {
      achieved: true,
      reason:
        "video_detected"
    };
  }

  return null;
}

export function matchComments(
  intent,
  observation
) {

  const text = (
    observation?.pageState?.text ||
    ""
  ).toLowerCase();

  if (
    text.includes("comments")
  ) {

    return {
      achieved: true,
      reason:
        "comments_detected"
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