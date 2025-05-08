import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom"; // Changed this line
import { auth } from "./firebase";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import UserManagement from "./components/UserManagement";
import BikeManagement from "./components/BikeManagement";
import StationManagement from "./components/StationManagement";
import AdminManagement from "./components/AdminManagement";
import RateManagement from "./components/RateManagement";
import SystemAnalytics from "./components/SystemAnalytics";
import RideDetails from "./components/RideDetails"; // Add this import
import CoverageArea from "./components/CoverageArea"; // Add this import
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    auth.onAuthStateChanged((authUser) => {
      setUser(authUser);
    });
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Dashboard />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Login />} />
          <Route
            path="/user-management"
            element={user ? <UserManagement /> : <Login />}
          />
          <Route
            path="/bike-management"
            element={user ? <BikeManagement /> : <Login />}
          />
          <Route
            path="/stations"
            element={user ? <StationManagement /> : <Login />}
          />
          <Route
            path="/admin-management"
            element={user ? <AdminManagement /> : <Login />}
          />
          <Route
            path="/rate-management"
            element={user ? <RateManagement /> : <Login />}
          />
          <Route
            path="/system-analytics"
            element={user ? <SystemAnalytics /> : <Login />}
          />
          <Route
            path="/ride-details"
            element={user ? <RideDetails /> : <Login />}
          />
          <Route
            path="/coverage-area"
            element={user ? <CoverageArea /> : <Login />}
          />
          <Route path="/" element={!user ? <Login /> : <Dashboard />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
