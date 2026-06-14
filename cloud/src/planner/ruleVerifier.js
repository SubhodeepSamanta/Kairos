export function verifyByRules(
  observation
) {

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

    default:

      return null;
  }
}