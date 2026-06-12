export function verifyByRules(
  observation
) {
const immediateSuccess = [

  "text_typed",

  "key_pressed",

  "page_scrolled",

  "tab_switched",

  "tab_created",

  "tab_closed"
];

if (
  immediateSuccess.includes(
    observation?.expected
  )
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