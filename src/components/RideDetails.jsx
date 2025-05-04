import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "./Layout";
import dayjs from "dayjs";
import "../styles/RideDetails.css";
import ContentHeader from "./ContentHeader"; // Add this import

const RideDetails = () => {
  const [rides, setRides] = useState([]);
  const [bikes, setBikes] = useState({});
  const [users, setUsers] = useState({});
  const [stations, setStations] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("all"); // 'all', 'today', 'week', 'month'
  const [sortConfig, setSortConfig] = useState({
    key: "rideEndedAt",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Update the stats state to include new metrics
  const [stats, setStats] = useState({
    totalRides: 0,
    totalRevenue: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalCalories: 0,
    totalCarbonSaved: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch bikes data
      const bikesRef = collection(db, "bikes");
      const bikesSnapshot = await getDocs(bikesRef);
      const bikesData = {};
      bikesSnapshot.docs.forEach((doc) => {
        bikesData[doc.id] = doc.data();
      });
      setBikes(bikesData);

      // Fetch users data
      const usersRef = collection(db, "approved_users");
      const usersSnapshot = await getDocs(usersRef);
      const usersData = {};
      usersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        usersData[doc.id] = `${userData.first_name} ${userData.surname}`;
      });
      setUsers(usersData);

      // Fetch stations data
      const stationsRef = collection(db, "stations");
      const stationsSnapshot = await getDocs(stationsRef);
      const stationsData = {};
      stationsSnapshot.docs.forEach((doc) => {
        stationsData[doc.id] = doc.data().stationName;
      });
      setStations(stationsData);

      // Fetch rides data
      const rideHistoryRef = collection(db, "ride_history");
      const ridesSnapshot = await getDocs(rideHistoryRef);

      const rideData = ridesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        rideEndedAt:
          doc.data().rideEndedAt?.toDate() ||
          new Date(doc.data().rideEndedAt.seconds * 1000),
      }));

      setRides(rideData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const filterRidesByTime = (rides) => {
    const now = dayjs();
    switch (timeFilter) {
      case "today":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isSame(now, "day")
        );
      case "week":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isAfter(now.subtract(1, "week"))
        );
      case "month":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isAfter(now.subtract(1, "month"))
        );
      default:
        return rides;
    }
  };

  // Update the stats calculation in useEffect
  useEffect(() => {
    const filteredRides = filterRidesByTime(rides);
    const newStats = filteredRides.reduce(
      (acc, ride) => ({
        totalRides: acc.totalRides + 1,
        totalRevenue: acc.totalRevenue + (ride.amountPaid || 0),
        totalDistance: acc.totalDistance + (ride.distance || 0),
        totalDuration: acc.totalDuration + (ride.duration || 0),
        totalCalories: acc.totalCalories + (ride.caloriesBurned || 0),
        totalCarbonSaved: acc.totalCarbonSaved + (ride.carbonSaved || 0),
      }),
      {
        totalRides: 0,
        totalRevenue: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        totalCarbonSaved: 0,
      }
    );
    setStats(newStats);
  }, [rides, timeFilter]);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };

  const sortedAndFilteredRides = React.useMemo(() => {
    // First filter by time
    const timeFiltered = filterRidesByTime(rides);

    // Then sort
    return [...timeFiltered].sort((a, b) => {
      if (sortConfig.key === "rideEndedAt") {
        return sortConfig.direction === "asc"
          ? a[sortConfig.key] - b[sortConfig.key]
          : b[sortConfig.key] - a[sortConfig.key];
      }
      return sortConfig.direction === "asc"
        ? a[sortConfig.key] > b[sortConfig.key]
          ? 1
          : -1
        : a[sortConfig.key] < b[sortConfig.key]
        ? 1
        : -1;
    });
  }, [rides, timeFilter, sortConfig]);

  const paginatedRides = sortedAndFilteredRides.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(sortedAndFilteredRides.length / rowsPerPage);

  return (
    <Layout>
      <ContentHeader /> {/* Add this line */}
      <div className="ride-details-container">
        <h1>Ride Details</h1>
        <div className="controls">
          <div className="time-filter">
            <button
              className={`filter-btn ${timeFilter === "all" ? "active" : ""}`}
              onClick={() => setTimeFilter("all")}
            >
              All Time
            </button>
            <button
              className={`filter-btn ${timeFilter === "today" ? "active" : ""}`}
              onClick={() => setTimeFilter("today")}
            >
              Today
            </button>
            <button
              className={`filter-btn ${timeFilter === "week" ? "active" : ""}`}
              onClick={() => setTimeFilter("week")}
            >
              This Week
            </button>
            <button
              className={`filter-btn ${timeFilter === "month" ? "active" : ""}`}
              onClick={() => setTimeFilter("month")}
            >
              This Month
            </button>
          </div>
        </div>
        {/* Update the stats grid in the JSX */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Rides</h3>
            <p>{stats.totalRides}</p>
          </div>
          <div className="stat-card">
            <h3>Total Revenue</h3>
            <p>₱{stats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p>{stats.totalDistance.toFixed(2)} km</p>
          </div>
          <div className="stat-card">
            <h3>Total Duration</h3>
            <p>{Math.round(stats.totalDuration / 60)} min</p>
          </div>
          <div className="stat-card">
            <h3>Calories Burned</h3>
            <p>{Math.round(stats.totalCalories)} cal</p>
          </div>
          <div className="stat-card">
            <h3>CO2 Saved</h3>
            <p>{stats.totalCarbonSaved.toFixed(2)} kg</p>
          </div>
        </div>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort("rideEndedAt")}>
                      Date{" "}
                      {sortConfig.key === "rideEndedAt" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("userId")}>
                      User{" "}
                      {sortConfig.key === "userId" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("bikeId")}>
                      Bike{" "}
                      {sortConfig.key === "bikeId" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("duration")}>
                      Duration{" "}
                      {sortConfig.key === "duration" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("distance")}>
                      Distance{" "}
                      {sortConfig.key === "distance" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("caloriesBurned")}>
                      Calories{" "}
                      {sortConfig.key === "caloriesBurned" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("carbonSaved")}>
                      CO2 Saved{" "}
                      {sortConfig.key === "carbonSaved" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th onClick={() => handleSort("amountPaid")}>
                      Amount{" "}
                      {sortConfig.key === "amountPaid" &&
                        (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th>Start Station</th>
                    <th>End Station</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRides.map((ride) => (
                    <tr key={ride.id}>
                      <td>
                        {dayjs(ride.rideEndedAt).format("MMM D, YYYY HH:mm")}
                      </td>
                      <td>{users[ride.userId] || "Unknown User"}</td>
                      <td>{bikes[ride.bikeId]?.bikeName || "Unknown Bike"}</td>
                      <td>{Math.round(ride.duration / 60)} min</td>
                      <td>{ride.distance?.toFixed(2) || 0} km</td>
                      <td>{Math.round(ride.caloriesBurned) || 0} cal</td>
                      <td>{ride.carbonSaved?.toFixed(2) || 0} kg</td>
                      <td>₱{ride.amountPaid?.toFixed(2) || 0}</td>
                      <td>
                        {stations[ride.startStation] || "Unknown Station"}
                      </td>
                      <td>{stations[ride.endStation] || "Unknown Station"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default RideDetails;
