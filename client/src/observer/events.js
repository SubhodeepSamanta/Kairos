export function detectEvents(
  result
) {

  const events = [];

  const before =
    result.before || {};

  const after =
    result.after || {};

  const page =
    result.pageState || {};

  if (
    before.url &&
    after.url &&
    before.url !== after.url
  ) {

    events.push(
      "url_changed"
    );
  }

  if (
    before.title &&
    after.title &&
    before.title !== after.title
  ) {

    events.push(
      "content_changed"
    );
  }

  if (
    page.inputs?.length > 0
  ) {

    events.push(
      "form_detected"
    );
  }

  if (
    page.inputs?.some(
      input =>
        (
          input.text || ""
        )
          .toLowerCase()
          .includes(
            "password"
          )
    )
  ) {

    events.push(
      "auth_form_detected"
    );
  }

  if (
    page.links?.length > 0
  ) {

    events.push(
      "links_detected"
    );
  }

  if (
    page.buttons?.length > 0
  ) {

    events.push(
      "buttons_detected"
    );
  }

  if (
    page.text &&
    page.text.length > 0
  ) {

    events.push(
      "content_loaded"
    );
  }
if (
  result.text &&
  result.action?.type === "type"
) {

  events.push(
    "text_entered"
  );
}
if (
  result.key === "Enter"
) {

  events.push(
    "enter_pressed"
  );
}

if (
  result.key === "Escape"
) {

  events.push(
    "escape_pressed"
  );
}

if (
  result.key === "Tab"
) {

  events.push(
    "tab_pressed"
  );
}
if (
  result.direction
) {

  events.push(
    "page_scrolled"
  );
}
if (
  result.operation ===
  "new_tab"
) {

  events.push(
    "tab_created"
  );
}

if (
  result.operation ===
  "close_tab"
) {

  events.push(
    "tab_closed"
  );
}

if (
  result.operation ===
  "switch_tab"
) {

  events.push(
    "tab_switched"
  );
}
  return events;
}