import { useEffect, useState } from "react";

// /.auth/me is provided by Static Web Apps itself (no backend code needed) —
// returns { clientPrincipal: null } when logged out, or the principal object
// when logged in.
export default function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/.auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.clientPrincipal))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { loading, user };
}
