import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import RatePrompt from "./features/rate/RatePrompt";
import LearnPage from "./features/learn/LearnPage";
import PracticePage from "./features/practice/PracticePage";

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<RatePrompt />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/practice" element={<PracticePage />} />
      </Routes>
    </>
  );
}

export default App;
