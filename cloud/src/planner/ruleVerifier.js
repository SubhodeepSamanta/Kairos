export function verifyByRules(
  observation
) {
if (
  observation?.expected ===
  "text_typed"
) {
  return {
    achieved: true
  };
}
if (
  observation?.expected ===
  "key_pressed"
) {
  return {
    achieved: true
  };
}
if (
  observation?.expected ===
  "page_scrolled"
) {
  return {
    achieved: true
  };
}
if (
  observation?.expected ===
  "tab_switched"
) {
  return {
    achieved: true
  };
}

if (
  observation?.expected ===
  "tab_created"
) {
  return {
    achieved: true
  };
}

if (
  observation?.expected ===
  "tab_closed"
) {
  return {
    achieved: true
  };
}
  switch (
    observation?.expected
  ) {

    case "page_loaded":

      return {
        achieved:
          observation.success
      };

    case "page_changed":

      return {
        achieved:
          observation.success &&
          observation.actual ===
            "changed"
      };

    case "page_read":

      return {
        achieved:
          observation.success
      };

    case "browser_context":

      return {
        achieved:
          observation.success
      };

    case "tab_created":

      return {
        achieved:
          observation.success
      };

    case "tab_switched":

      return {
        achieved:
          observation.success
      };

    default:

      return null;
  }
}