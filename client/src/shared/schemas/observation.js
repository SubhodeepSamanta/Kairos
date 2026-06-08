export function createObservation({
  success = false,
  expected = "",
  actual = ""
}) {
  return {
    success,
    expected,
    actual,
    timestamp: new Date().toISOString()
  };
}