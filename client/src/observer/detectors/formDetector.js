export function detectFormEvents(
  pageState
) {

  const events = [];

  const inputs =
    pageState?.inputs || [];

  const labels =
    inputs
      .map(
        input =>
          (
            input.text || ""
          ).toLowerCase()
      );

  const hasEmail =
    labels.some(
      text =>
        text.includes(
          "email"
        ) ||
        text.includes(
          "login"
        )
    );

  const hasPassword =
    labels.some(
      text =>
        text.includes(
          "password"
        )
    );

  if (
    hasEmail &&
    hasPassword
  ) {

    events.push(
      "login_form_detected"
    );
  }

  const hasSearch =
    labels.some(
      text =>
        text.includes(
          "search"
        )
    );

  if (
    hasSearch
  ) {

    events.push(
      "search_form_detected"
    );
  }

  return events;
}