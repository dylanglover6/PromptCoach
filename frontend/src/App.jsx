import { Routes, Route } from "react-router-dom";
import RatePrompt from "./features/rate/RatePrompt";
import LearnPage from "./features/learn/LearnPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RatePrompt />} />
      <Route path="/learn" element={<LearnPage />} />
    </Routes>
  );
}

export default App;
