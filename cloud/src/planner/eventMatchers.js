export function matchUrlChanged(
  intent,
  observation
) {

  if (
    observation?.events?.includes(
      "url_changed"
    )
  ) {

    return {
      achieved: true,
      reason:
        "url_changed"
    };
  }

  return null;
}

export function matchSearchForm(
  intent,
  observation
) {

  if (
    intent?.type ===
      "search" &&
    observation?.events?.includes(
      "form_detected"
    )
  ) {

    return {
      achieved: true,
      reason:
        "search_form_detected"
    };
  }

  return null;
}

export function matchNewElements(
  intent,
  observation
) {

  const events =
    observation?.events || [];

  if (
    events.includes(
      "buttons_detected"
    ) ||
    events.includes(
      "links_detected"
    ) ||
    events.includes(
      "form_detected"
    )
  ) {

    return {
      achieved: true,
      reason:
        "elements_detected"
    };
  }

  return null;
}