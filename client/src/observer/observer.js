export async function observeAction(action, result) {

  if (result?.success) {
    return {
      success: true,
      expected: "success",
      actual: "success",
      action,
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: false,
    expected: "success",
    actual: "failed",
    reason: result?.reason || "unknown_error",
    action,
    timestamp: new Date().toISOString()
  };
}