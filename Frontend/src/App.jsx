import { BrowserRouter, Routes, Route } from "react-router-dom";
import JoinPage from "./pages/JoinPage";
import AuthPage from "./pages/AuthPage";
import CreatePollPage from "./pages/CreatePollPage";
import PollPage from "./pages/PollPage";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/create" element={<CreatePollPage />} />
        <Route path="/p/:code" element={<PollPage />} />
      </Routes>
    </BrowserRouter>
  );
}