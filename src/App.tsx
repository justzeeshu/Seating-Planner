import { BrowserRouter, Routes, Route } from "react-router-dom";
import Register from "./components/register";
import Allworking from "./components/allworking";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/app" element={<Allworking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
