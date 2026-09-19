import { BrowserRouter, Routes, Route } from "react-router-dom";
import JoinPage from "./pages/JoinPage";
import AuthPage from "./pages/AuthPage";
import CreatePollPage from "./pages/CreatePollPage";
import PollPage from "./pages/PollPage";
import Header from "./components/Header";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/create" element={<CreatePollPage />} />
        <Route path="/p/:code" element={<PollPage />} />
      </Routes>
    </BrowserRouter>
  );
}