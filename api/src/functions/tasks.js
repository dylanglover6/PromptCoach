const { app } = require("@azure/functions");
const { getAllTasks } = require("../lib/tasks");

app.http("tasks", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "tasks",
  handler: async () => {
    return { jsonBody: getAllTasks() };
  },
});
