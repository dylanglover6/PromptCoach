import { NavLink } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./NavBar.css";

export default function NavBar() {
  const { loading, user } = useAuth();

  return (
    <nav className="nav-bar">
      <div className="nav-bar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Rate my prompt
        </NavLink>
        <NavLink to="/learn" className={({ isActive }) => (isActive ? "active" : "")}>
          Learn
        </NavLink>
        <NavLink to="/practice" className={({ isActive }) => (isActive ? "active" : "")}>
          Practice
        </NavLink>
      </div>
      <div className="nav-bar-auth">
        {!loading && user && (
          <>
            <span className="nav-bar-user">{user.userDetails || `Logged in via ${user.identityProvider}`}</span>
            <a href="/.auth/logout?post_logout_redirect_uri=/">Log out</a>
          </>
        )}
        {!loading && !user && <a href="/.auth/login/github?post_login_redirect_uri=/">Log in with GitHub</a>}
      </div>
    </nav>
  );
}
