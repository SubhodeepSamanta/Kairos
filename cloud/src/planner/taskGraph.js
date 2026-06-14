import {
  createTask
}
from "../shared/schemas/task.js";

export function buildTaskGraph(
  intent
) {

  const tasks = [];

  tasks.push(
    createTask({
      intent:
        intent.type,

      target:
        intent.target,

      context: {
        entities:
          intent.entities,

        constraints:
          intent.constraints
      }
    })
  );

  return tasks;
}