const { app } = require("@azure/functions");
const { getClientPrincipal } = require("../lib/auth");

// Smoke-test endpoint proving getClientPrincipal works server-side — same
// role /api/health played for the scaffold. Nothing else reads this yet;
// step 6 builds real logged-in behavior on top of this identity source.
app.http("whoami", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "whoami",
  handler: async (request) => {
    const principal = getClientPrincipal(request);
    return {
      jsonBody: {
        profileId: principal ? principal.userId : null,
        loggedIn: principal !== null,
      },
    };
  },
});
