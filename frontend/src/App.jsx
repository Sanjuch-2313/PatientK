import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import Login from "./pages/Login";
import PatientSuccess from "./pages/PatientSuccess";

import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import FamilyDashboard from "./pages/FamilyDashboard";
import SharedMonitoring from "./pages/SharedMonitoring";
import NurseDashboard from "./pages/NurseDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/patient-success"
          element={<PatientSuccess />}
        />

        <Route
          path="/patient-dashboard"
          element={<PatientDashboard />}
        />

        <Route
          path="/doctor-dashboard"
          element={<DoctorDashboard />}
        />

        <Route
          path="/family-dashboard"
          element={<FamilyDashboard />}
        />

        <Route
          path="/monitor/:patientId"
          element={<SharedMonitoring />}
        />

        <Route path="/nurse-dashboard" element={<NurseDashboard />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
