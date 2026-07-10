import { LESSONS } from "./lessons";
import "./LearnPage.css";

function LessonCard({ lesson }) {
  return (
    <div className="lesson-card">
      <h3>{lesson.label}</h3>
      <div className="lesson-pair">
        <div>
          <span className="lesson-tag lesson-tag-bad">Bad</span>
          <pre>{lesson.badPrompt}</pre>
        </div>
        <div>
          <span className="lesson-tag lesson-tag-good">Good</span>
          <pre>{lesson.goodPrompt}</pre>
        </div>
      </div>
      <p>{lesson.why}</p>
    </div>
  );
}

export default function LearnPage() {
  const dimensions = LESSONS.filter((l) => l.kind === "dimension");
  const modifiers = LESSONS.filter((l) => l.kind === "modifier");

  return (
    <section className="learn-page">
      <h1>Learn</h1>
      <p className="learn-intro">
        Every prompt is rated on 5 core dimensions, plus 2 modifiers that apply when
        relevant. Here's what each one looks for, with a bad/good example.
      </p>

      <h2>Core scored dimensions</h2>
      <div className="lesson-list">
        {dimensions.map((lesson) => (
          <LessonCard lesson={lesson} key={lesson.id} />
        ))}
      </div>

      <h2>Modifiers</h2>
      <div className="lesson-list">
        {modifiers.map((lesson) => (
          <LessonCard lesson={lesson} key={lesson.id} />
        ))}
      </div>
    </section>
  );
}
