import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { auth } from "../firebase"; // Import auth for current user
import Layout from "./Layout";
import "../styles/RateManagement.css";
import { FaEdit, FaHistory } from "react-icons/fa";
import dayjs from "dayjs";

// Simple mapping from doc IDs to friendly names
const docIdToDisplayName = {
  RegularBicycle: "Regular Bicycle",
  ElectricBicycle: "Electric Bicycle",
};

const RateManagement = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [rateHistory, setRateHistory] = useState([]);
  const [stationRevenue, setStationRevenue] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [timePeriod, setTimePeriod] = useState("daily");
  const [stats, setStats] = useState({
    daily: { revenue: 0, rides: 0 },
    weekly: { revenue: 0, rides: 0 },
    monthly: { revenue: 0, rides: 0 },
    total: { revenue: 0, rides: 0 },
    all: { revenue: 0, rides: 0 }, // Add this line
  });
  const [sortConfig, setSortConfig] = useState({
    key: "revenue",
    direction: "desc",
  });

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };

  useEffect(() => {
    fetchRates();
    fetchRateHistory();
    fetchStationRevenue();
  }, []);

  useEffect(() => {
    fetchStationRevenue();
  }, [timePeriod]);

  const fetchRates = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "rentalRates"));
      const fetchedRates = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id, // e.g., "RegularBicycle" or "ElectricBicycle"
        ...docSnap.data(), // { pricePerMinute: number }
      }));
      setRates(fetchedRates);
    } catch (error) {
      console.error("Error fetching rental rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRateHistory = async () => {
    try {
      const historyRef = collection(db, "rateHistory");
      const q = query(historyRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRateHistory(history);
    } catch (error) {
      console.error("Error fetching rate history:", error);
    }
  };

  const fetchStationRevenue = async () => {
    try {
      // Get all stations first
      const stationsRef = collection(db, "stations");
      const stationsSnap = await getDocs(stationsRef);
      const stationMap = new Map();

      // Initialize stations with zero values
      stationsSnap.forEach((station) => {
        const stationData = station.data();
        stationMap.set(station.id, {
          id: station.id,
          stationName: stationData.stationName,
          revenue: 0,
          rides: 0, // Simplified to track total rides
        });
      });

      // Get all rides from ride_history
      const ridesRef = collection(db, "ride_history");
      const ridesSnap = await getDocs(ridesRef);
      const totalRides = ridesSnap.docs.length;

      const now = dayjs();
      const periodStats = {
        daily: { revenue: 0, rides: 0 },
        weekly: { revenue: 0, rides: 0 },
        monthly: { revenue: 0, rides: 0 },
        total: { revenue: 0, rides: 0 },
      };

      // Process all rides
      ridesSnap.docs.forEach((doc) => {
        const ride = doc.data();
        const rideDate = dayjs(ride.rideEndedAt.toDate());
        const amount = Number(ride.amountPaid || 0);

        // Only process rides for the selected time period
        const shouldInclude =
          timePeriod === "all"
            ? true
            : timePeriod === "daily"
            ? rideDate.isSame(now, "day")
            : timePeriod === "weekly"
            ? rideDate.isAfter(now.subtract(1, "week"))
            : timePeriod === "monthly"
            ? rideDate.isAfter(now.subtract(1, "month"))
            : true;

        if (shouldInclude && ride.startStation) {
          const stationData = stationMap.get(ride.startStation);
          if (stationData) {
            stationData.rides += 1;
            stationData.revenue += amount;
          }
        }

        // Update total stats
        periodStats.total.rides += 1;
        periodStats.total.revenue += amount;

        // Update period-specific stats
        if (rideDate.isSame(now, "day")) {
          periodStats.daily.rides += 1;
          periodStats.daily.revenue += amount;
        }
        if (rideDate.isAfter(now.subtract(1, "week"))) {
          periodStats.weekly.rides += 1;
          periodStats.weekly.revenue += amount;
        }
        if (rideDate.isAfter(now.subtract(1, "month"))) {
          periodStats.monthly.rides += 1;
          periodStats.monthly.revenue += amount;
        }
      });

      setStats({
        daily: periodStats.daily,
        weekly: periodStats.weekly,
        monthly: periodStats.monthly,
        total: periodStats.total,
        all: periodStats.total, // Add this line - 'all' shows the same as total
      });

      // Convert to array and sort by revenue
      const stationRevenueArray = Array.from(stationMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((station) => ({
          ...station,
          totalSystemRides: totalRides,
        }));

      setStationRevenue(stationRevenueArray);
    } catch (error) {
      console.error("Error fetching station revenue:", error);
    }
  };

  const openEditModal = (rate) => {
    setEditingRate(rate);
    setNewPrice(rate.pricePerMinute?.toString() || "");
  };

  const closeEditModal = () => {
    setEditingRate(null);
    setNewPrice("");
  };

  const handleUpdateRate = async () => {
    if (!editingRate) return;
    const price = parseFloat(newPrice);

    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid number greater than 0 for the price.");
      return;
    }

    try {
      // Get current user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No user is signed in");
      }

      // Fetch user's name from Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const updatedByName = userDocSnap.exists()
        ? userDocSnap.data().name
        : "Unknown User";

      // Update rate
      const rateRef = doc(db, "rentalRates", editingRate.id);
      await updateDoc(rateRef, { pricePerMinute: price });

      // Add to rate history with actual user name
      await addDoc(collection(db, "rateHistory"), {
        bikeType: editingRate.id,
        oldPrice: editingRate.pricePerMinute,
        newPrice: price,
        timestamp: new Date(),
        updatedBy: updatedByName, // Use the fetched name
      });

      // Update local states
      const updatedRates = rates.map((rate) =>
        rate.id === editingRate.id ? { ...rate, pricePerMinute: price } : rate
      );
      setRates(updatedRates);
      await fetchRateHistory(); // Refresh history

      closeEditModal();
    } catch (error) {
      console.error("Error updating rate:", error);
      alert("Failed to update the rate. See console for details.");
    }
  };

  return (
    <Layout>
      <div className="rate-management-container">
        <h2>Rental Rate Management</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="table-container">
              <table className="rate-table">
                <thead>
                  <tr>
                    <th>Bike Type</th>
                    <th>Price Per Minute (₱)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length > 0 ? (
                    rates.map((rate) => {
                      // Use the mapping, or fall back to the raw doc ID
                      const friendlyName =
                        docIdToDisplayName[rate.id] || rate.id;

                      return (
                        <tr key={rate.id}>
                          <td>{friendlyName}</td>
                          <td>{rate.pricePerMinute?.toFixed(2)}</td>
                          <td>
                            <button
                              className="edit-btn"
                              onClick={() => openEditModal(rate)}
                            >
                              <FaEdit /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center" }}>
                        No rental rates available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Station Revenue Section */}
        <div className="revenue-section">
          <h3>Station Revenue</h3>
          <div className="controls">
            <div className="time-filter">
              <button
                className={`filter-btn ${timePeriod === "all" ? "active" : ""}`}
                onClick={() => setTimePeriod("all")}
              >
                All Time
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "daily" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("daily")}
              >
                Today
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "weekly" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("weekly")}
              >
                This Week
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "monthly" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("monthly")}
              >
                This Month
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="revenue-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("stationName")}>
                    Station Name{" "}
                    {sortConfig.key === "stationName" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("revenue")}>
                    Total Revenue (₱){" "}
                    {sortConfig.key === "revenue" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("rides")}>
                    Total Rides{" "}
                    {sortConfig.key === "rides" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stationRevenue
                  .sort((a, b) => {
                    if (sortConfig.key === "stationName") {
                      return sortConfig.direction === "asc"
                        ? a.stationName.localeCompare(b.stationName)
                        : b.stationName.localeCompare(a.stationName);
                    }
                    return sortConfig.direction === "asc"
                      ? a[sortConfig.key] - b[sortConfig.key]
                      : b[sortConfig.key] - a[sortConfig.key];
                  })
                  .map((station) => (
                    <tr key={station.id}>
                      <td>{station.stationName}</td>
                      <td>{station.revenue.toFixed(2)}</td>
                      <td>{station.rides}</td>
                    </tr>
                  ))}
                <tr className="total-row">
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>₱{stats[timePeriod].revenue.toFixed(2)}</strong>
                  </td>
                  <td>
                    <strong>{stats[timePeriod].rides}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Rate History Section */}
        <div className="history-section">
          <div className="history-header">
            <h3>Rate History</h3>
            <button
              className="history-toggle-btn"
              onClick={() => setShowHistory(!showHistory)}
            >
              <FaHistory /> {showHistory ? "Hide History" : "Show History"}
            </button>
          </div>

          {showHistory && (
            <div className="table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bike Type</th>
                    <th>Old Price (₱)</th>
                    <th>New Price (₱)</th>
                    <th>Updated By</th>
                  </tr>
                </thead>
                <tbody>
                  {rateHistory.map((history) => (
                    <tr key={history.id}>
                      <td>
                        {dayjs(history.timestamp.toDate()).format(
                          "MMM D, YYYY HH:mm"
                        )}
                      </td>
                      <td>
                        {docIdToDisplayName[history.bikeType] ||
                          history.bikeType}
                      </td>
                      <td>{history.oldPrice?.toFixed(2)}</td>
                      <td>{history.newPrice.toFixed(2)}</td>
                      <td>{history.updatedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRate && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Edit Rental Rate</h3>
              {/* Show the friendly name again in the modal */}
              <p>
                Bike Type:{" "}
                <strong>
                  {docIdToDisplayName[editingRate.id] || editingRate.id}
                </strong>
              </p>

              <label>Price Per Minute (₱):</label>
              <input
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />

              <div className="modal-buttons">
                <button className="save-btn" onClick={handleUpdateRate}>
                  Save
                </button>
                <button className="cancel-btn" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default RateManagement;
