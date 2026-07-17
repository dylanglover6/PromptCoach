// SWA injects this header on every request once a user is logged in via
// /.auth/login/<provider> — base64-encoded JSON, absent entirely when logged
// out. This is the only server-side source of identity; a client-supplied
// profileId must never be trusted for logged-in writes.
function getClientPrincipal(request) {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) return null;

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const principal = JSON.parse(decoded);
    return {
      userId: principal.userId,
      userDetails: principal.userDetails,
      identityProvider: principal.identityProvider,
      userRoles: principal.userRoles || [],
    };
  } catch {
    return null;
  }
}

module.exports = { getClientPrincipal };
