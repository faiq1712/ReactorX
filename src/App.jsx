import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import AdiabticEquilibriumCalculator from "./AdiabticEquilibriumCalculator";
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LandingPage from "./LandingPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/calculator" element={<AdiabticEquilibriumCalculator />} />
      </Routes>
    </Router>
  );
}

export default App;
