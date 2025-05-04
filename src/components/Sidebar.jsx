import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase"; // Import Firebase Authentication
import {
  BiHome,
  BiBookAlt,
  BiMessage,
  BiSolidReport,
  BiStats,
  BiTask,
  BiLogOut,
  BiUserCheck,
  BiCycling,
  BiTable,
} from "react-icons/bi";
import "../styles/Sidebar.css";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await auth.signOut(); // Sign out the user
      navigate("/login"); // Redirect to login page
    } catch (error) {
      console.error("Error signing out: ", error.message);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="sidebar">
      {/* Logo Section */}
      <div className="logo">
        <img
          src={import.meta.env.BASE_URL + "assets/ecoridelogo2.png"}
          alt="EcoRide Logo"
          style={{ width: "100%", maxWidth: "100px", height: "auto" }}
        />
      </div>

      {/* Menu List */}
      <div className="menu-list">
        <div
          className={`menu-item ${isActive("/dashboard") ? "active" : ""}`}
          onClick={() => navigate("/dashboard")}
        >
          <BiHome />
          <span>Dashboard</span>
        </div>

        <div
          className={`menu-item ${isActive("/stations") ? "active" : ""}`}
          onClick={() => navigate("/stations")}
        >
          <BiBookAlt />
          <span>Manage Stations</span>
        </div>

        <div
          className={`menu-item ${
            isActive("/user-management") ? "active" : ""
          }`}
          onClick={() => navigate("/user-management")}
        >
          <BiUserCheck />
          <span>Manage User</span>
        </div>

        <div
          className={`menu-item ${
            isActive("/admin-management") ? "active" : ""
          }`}
          onClick={() => navigate("/admin-management")}
        >
          <BiSolidReport />
          <span>Manage & Create Admin</span>
        </div>

        <div
          className={`menu-item ${
            isActive("/bike-management") ? "active" : ""
          }`}
          onClick={() => navigate("/bike-management")}
        >
          <BiCycling />
          <span>Manage Bikes</span>
        </div>

        <div
          className={`menu-item ${
            isActive("/rate-management") ? "active" : ""
          }`}
          onClick={() => navigate("/rate-management")}
        >
          <BiTask />
          <span>Rate Management</span>
        </div>

        <div
          className={`menu-item ${
            isActive("/system-analytics") ? "active" : ""
          }`}
          onClick={() => navigate("/system-analytics")}
        >
          <BiStats />
          <span>System Analytics</span>
        </div>

        <div
          className={`menu-item ${isActive("/ride-details") ? "active" : ""}`}
          onClick={() => navigate("/ride-details")}
        >
          <BiTable />
          <span>Ride Details</span>
        </div>

        {/* Logout Button */}
        <div className="menu-item logout" onClick={handleLogout}>
          <BiLogOut />
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
