export function normalizeAction(action) {
  if (!action || typeof action !== "object") return action;
  const { params, ...rest } = action;
  return params && typeof params === "object" ? { ...rest, ...params } : action;
}

export function judge(decision, expect) {
  const action = normalizeAction(decision?.action || decision);
  const type = action && typeof action.type === "string" ? action.type : null;
  if (!type) return { pass: false, type: null, why: "no valid action in the reply" };

  if (expect.only && !expect.only.includes(type)) {
    return { pass: false, type, why: `chose ${type}, wanted one of ${expect.only.join(" / ")}` };
  }
  if (expect.not && expect.not.includes(type)) {
    return { pass: false, type, why: `chose ${type}, which is exactly what it must not do` };
  }

  if (expect.paramIn) {
    for (const [key, allowed] of Object.entries(expect.paramIn)) {
      const value = action[key];
      if (!allowed.map(String).includes(String(value))) {
        return { pass: false, type, why: `${key}=${value} is not one of ${allowed.join(" / ")}` };
      }
    }
  }

  if (expect.answerContains) {
    const answer = String(action.answer || "");
    const missing = expect.answerContains.filter(bit => !answer.toLowerCase().includes(String(bit).toLowerCase()));
    if (missing.length) {
      return { pass: false, type, why: `answer left out ${missing.join(", ")}: "${answer.slice(0, 120)}"` };
    }
  }

  return { pass: true, type, why: "" };
}
