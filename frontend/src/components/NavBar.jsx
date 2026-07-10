import { NavLink } from "react-router-dom";
import "./NavBar.css";

export default function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
        Rate my prompt
      </NavLink>
      <NavLink to="/learn" className={({ isActive }) => (isActive ? "active" : "")}>
        Learn
      </NavLink>
      <NavLink to="/practice" className={({ isActive }) => (isActive ? "active" : "")}>
        Practice
      </NavLink>
    </nav>
  );
}
