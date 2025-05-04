import React from "react";
import Sidebar from "./Sidebar"; // Import Sidebar
import "../styles/Layout.css"; // Ensure styling consistency

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <Sidebar />
      <div className="content">{children}</div>
    </div>
  );
};

export default Layout;
