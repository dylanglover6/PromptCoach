const tasks = require("../../tasks.json");

// Centralizing task access here is the seam for the eventual Cosmos DB swap
// (per the spec) — only this file's internals change then, not the two
// endpoints that call it.

function getAllTasks() {
  return tasks
    .map(({ id, category, title, scenario, sequence, isCapstone }) => ({
      id,
      category,
      title,
      scenario,
      sequence,
      isCapstone,
    }))
    .sort((a, b) => a.sequence - b.sequence);
}

function getTaskById(id) {
  return tasks.find((task) => task.id === id) || null;
}

module.exports = { getAllTasks, getTaskById };
