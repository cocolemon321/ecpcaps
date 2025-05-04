import React from 'react';
import ContentHeader from './ContentHeader'; // Import the ContentHeader component
import Sidebar from './Sidebar'; // Import Sidebar
import Content from './Content'; // Import Content
import '../styles/Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <Sidebar /> {/* Sidebar Component */}
      <div className="dashboard-content">
        <ContentHeader /> {/* Call the ContentHeader Component here */}
        <Content /> {/* Call Content Component here */}

      </div>
    </div>
  );
};

export default Dashboard;
