import { Link } from "react-router-dom";

export default function LearnPage() {
  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px", textAlign: "left" }}>
      <h1>Learn</h1>
      <p>The Learn section is coming soon.</p>
      <Link to="/">Back to Rate my prompt</Link>
    </section>
  );
}
