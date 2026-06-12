export function detectPageEvents(
  before,
  after
) {

  const events = [];

  if (
    before?.url &&
    after?.url &&
    before.url !== after.url
  ) {

    events.push(
      "url_changed"
    );
  }

  if (
    before?.title &&
    after?.title &&
    before.title !== after.title
  ) {

    events.push(
      "title_changed"
    );
  }

  return events;
}