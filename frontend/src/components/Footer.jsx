import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <a href="https://dylanglover.com" target="_blank" rel="noopener noreferrer">
        Dylan Glover
      </a>
      <span> — {new Date().getFullYear()}</span>
    </footer>
  );
}
