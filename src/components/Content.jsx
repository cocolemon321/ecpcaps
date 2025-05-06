import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import "../styles/Content.css";
import { FaMapMarkedAlt } from "react-icons/fa";

// Import dayjs + plugin
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

// Use the same mapboxgl token as AddStationMap
mapboxgl.accessToken =
  "pk.eyJ1IjoiY29jb2xlbW9uMTIiLCJhIjoiY204YTBoMnZpMHplbzJzcTR3dDFmOXc4NiJ9.NqqEHSBe8cn9Gy9knbUqew";

const Content = () => {
  const [userName, setUserName] = useState("");
  const [totalBikes, setTotalBikes] = useState(0);
  const [totalRidesToday, setTotalRidesToday] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [trackedLocations, setTrackedLocations] = useState({});
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [todaysMetrics, setTodaysMetrics] = useState({
    totalDistance: 0,
    totalDuration: 0,
    totalCalories: 0,
    totalCarbon: 0,
    totalRevenue: 0, // Add this field
  });
  const [revenueData, setRevenueData] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
  });
  const [hourlyRevenue, setHourlyRevenue] = useState(Array(24).fill(0));
  const [activeAdminsCount, setActiveAdminsCount] = useState(0);
  const [activeUserMarkers, setActiveUserMarkers] = useState({});

  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const markersRef = useRef({});

  // Helper function to parse a custom timestamp string:
  const parseCustomTimestamp = (timestamp) => {
    let replaced = timestamp.replace("UTC+", "+").replace("UTC-", "-");
    replaced = replaced.replace(/([+\-]\d{1,2})$/, "$1:00");
    return dayjs(replaced, "D MMMM YYYY [at] HH:mm:ss Z");
  };

  // Helper to parse timestamp regardless of its type
  const getDayjsDate = (timestamp) => {
    if (typeof timestamp === "string") {
      return parseCustomTimestamp(timestamp);
    } else if (timestamp && typeof timestamp.toDate === "function") {
      return dayjs(timestamp.toDate());
    } else {
      return dayjs(timestamp);
    }
  };

  const fetchTotalBikes = async () => {
    try {
      const bikesSnapshot = await getDocs(collection(db, "bikes"));
      setTotalBikes(bikesSnapshot.size);
    } catch (error) {
      console.error("Error fetching total bikes:", error);
    }
  };

  // Fetch total rides that occurred "today"
  const fetchTotalRidesToday = async () => {
    try {
      const today = dayjs().startOf("day");

      // Query ride_history collection for today's completed rides
      const rideHistoryRef = collection(db, "ride_history");
      const ridesSnapshot = await getDocs(rideHistoryRef);

      let rideCount = 0;

      ridesSnapshot.forEach((doc) => {
        const rideData = doc.data();
        const rideEndedAt = rideData.rideEndedAt;

        if (rideEndedAt) {
          const endDate = getDayjsDate(rideEndedAt);
          if (endDate.isSame(today, "day")) {
            rideCount++;
          }
        }
      });

      console.log("Today's total rides:", rideCount); // Debug log
      setTotalRidesToday(rideCount);
    } catch (error) {
      console.error("Error fetching total rides today:", error);
    }
  };

  const fetchTodaysMetrics = async () => {
    try {
      const today = dayjs().startOf("day");
      const rideHistoryRef = collection(db, "ride_history");
      const ridesSnapshot = await getDocs(rideHistoryRef);

      let metrics = {
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        totalCarbon: 0,
        totalRevenue: 0,
      };

      ridesSnapshot.forEach((doc) => {
        const rideData = doc.data();
        if (rideData.rideEndedAt) {
          const endDate = getDayjsDate(rideData.rideEndedAt);
          if (endDate.isSame(today, "day")) {
            metrics.totalDistance += rideData.currentMetrics?.distance || 0;
            metrics.totalDuration += rideData.currentMetrics?.duration || 0;
            metrics.totalCalories += rideData.currentMetrics?.calories || 0;
            metrics.totalCarbon += rideData.carbonSaved || 0;
            metrics.totalRevenue += rideData.amountPaid || 0;
          }
        }
      });

      setTodaysMetrics({
        totalDistance: metrics.totalDistance || 0,
        totalDuration: metrics.totalDuration || 0,
        totalCalories: metrics.totalCalories || 0,
        totalCarbon: metrics.totalCarbon || 0,
        totalRevenue: metrics.totalRevenue || 0,
      });
    } catch (error) {
      console.error("Error fetching today's metrics:", error);
    }
  };

  const fetchRevenue = async () => {
    try {
      const approvedUsersSnapshot = await getDocs(
        collection(db, "approved_users")
      );
      let todayTotal = 0;
      let weeklyTotal = 0;
      let monthlyTotal = 0;

      const today = dayjs().startOf("day");
      const weekStart = dayjs().startOf("week");
      const monthStart = dayjs().startOf("month");

      for (const userDoc of approvedUsersSnapshot.docs) {
        const rideHistoryRef = collection(
          db,
          "approved_users",
          userDoc.id,
          "rideHistory"
        );
        const rideHistorySnapshot = await getDocs(rideHistoryRef);

        for (const rideDoc of rideHistorySnapshot.docs) {
          const rideData = rideDoc.data();
          const rideDate = getDayjsDate(rideData.rideStartedAt);
          const amount = rideData.amountPaid || 0;

          if (rideDate.isSame(today, "day")) {
            todayTotal += amount;
          }
          if (rideDate.isAfter(weekStart)) {
            weeklyTotal += amount;
          }
          if (rideDate.isAfter(monthStart)) {
            monthlyTotal += amount;
          }
        }
      }

      setRevenueData({
        today: todayTotal,
        weekly: weeklyTotal,
        monthly: monthlyTotal,
      });
    } catch (error) {
      console.error("Error fetching revenue:", error);
    }
  };

  const fetchHourlyRevenue = async () => {
    try {
      const today = dayjs().startOf("day");
      const rideHistoryRef = collection(db, "ride_history");

      const unsubscribe = onSnapshot(rideHistoryRef, (snapshot) => {
        // Initialize array with 24 zeros (one for each hour)
        let hourlyData = Array(24).fill(0);

        snapshot.forEach((doc) => {
          const rideData = doc.data();
          if (rideData.rideEndedAt && rideData.amountPaid) {
            const endDate = getDayjsDate(rideData.rideEndedAt);

            // Check if ride ended today
            if (endDate.isSame(today, "day")) {
              const hour = endDate.hour();
              hourlyData[hour] += Number(rideData.amountPaid || 0);
            }
          }
        });

        console.log("Hourly revenue data:", hourlyData); // Debug log
        setHourlyRevenue(hourlyData);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching hourly revenue:", error);
    }
  };

  // Update the fetchActiveRides function
  const fetchActiveRides = () => {
    try {
      const activeRidesRef = collection(db, "activeRides");
      const q = query(activeRidesRef, where("rideStatus", "==", "started"));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const rides = [];

        for (const docSnapshot of snapshot.docs) {
          const rideData = docSnapshot.data();
          console.log("Ride data:", rideData); // Debug ride data

          try {
            // Get user data
            const userRef = doc(db, "approved_users", rideData.userId);
            const userSnapshot = await getDoc(userRef);
            const userData = userSnapshot.exists() ? userSnapshot.data() : {};
            console.log("User data:", userData); // Debug user data

            // Get bike data
            const bikeRef = doc(db, "bikes", rideData.bikeId);
            const bikeDoc = await getDoc(bikeRef);
            const bikeData = bikeDoc.exists() ? bikeDoc.data() : {};
            console.log("Bike data:", bikeData); // Debug bike data

            // Get station data using startStation from ride data
            let stationName = "Unknown Station";
            if (rideData.startStation) {
              // Changed from bikeData.stationAssigned
              console.log(
                "Attempting to fetch station with ID:",
                rideData.startStation
              ); // Debug station ID
              const stationRef = doc(db, "stations", rideData.startStation);
              const stationDoc = await getDoc(stationRef);
              console.log("Station doc exists:", stationDoc.exists()); // Debug station doc
              if (stationDoc.exists()) {
                const stationData = stationDoc.data();
                console.log("Station data:", stationData); // Debug station data
                stationName =
                  stationData.stationName ||
                  stationData.name ||
                  "Unknown Station";
              }
            }

            const rideInfo = {
              rideId: docSnapshot.id,
              userName:
                userData.name ||
                `${userData.first_name || ""} ${userData.surname || ""}`.trim(),
              startTime: rideData.startTime,
              bikeName: bikeData.bikeName || "Unknown Bike",
              stationName: stationName,
            };
            console.log("Pushing ride info:", rideInfo); // Debug final ride info
            rides.push(rideInfo);
          } catch (docError) {
            console.error("Error fetching related documents:", docError);
            console.error("Error details:", {
              rideId: docSnapshot.id,
              userId: rideData.userId,
              bikeId: rideData.bikeId,
              startStation: rideData.startStation,
            });
          }
        }

        console.log("Final active rides array:", rides); // Debug final array
        setActiveRides(rides);
      });

      return unsubscribe; // Make sure we return the unsubscribe function
    } catch (error) {
      console.error("Error in fetchActiveRides:", error);
      return () => {}; // Return empty function if error occurs
    }
  };

  const fetchActiveAdmins = () => {
    try {
      const adminsRef = collection(db, "admins");

      return onSnapshot(adminsRef, (snapshot) => {
        const activeCount = snapshot.docs.reduce((count, doc) => {
          const adminData = doc.data();
          if (adminData.status === "Active" && adminData.stationAssignedTo) {
            return count + 1;
          }
          return count;
        }, 0);

        setActiveAdminsCount(activeCount);
      });
    } catch (error) {
      console.error("Error fetching active admins:", error);
      return () => {};
    }
  };

  useEffect(() => {
    fetchTotalBikes();
    fetchTotalRidesToday();
    fetchTodaysMetrics();
    fetchHourlyRevenue();
    fetchRevenue();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const name = userData?.name || "Super Admin";
            setUserName(name);
          } else {
            setUserName("Super Admin");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserName("Super Admin");
        }
      } else {
        setUserName("Unknown User");
      }
    });

    return () => unsubscribe();
  }, []);

  // Update the map initialization useEffect
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [120.9882053036898, 14.693467677226026],
        zoom: 12,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Set up real-time tracking
      const activeRidesRef = collection(db, "activeRides");
      const unsubscribe = onSnapshot(
        query(activeRidesRef, where("rideStatus", "==", "started")),
        (snapshot) => {
          if (!map.current) return;
          // ... rest of the code ...
        }
      );

      return () => {
        unsubscribe();
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, [mapContainer.current]);

  // Replace the useEffect for real-time tracking
  useEffect(() => {
    if (!map.current) return;

    const activeRidesRef = collection(db, "activeRides");
    const q = query(activeRidesRef, where("rideStatus", "==", "started"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        snapshot.docChanges().forEach(async (change) => {
          const rideData = change.doc.data();
          const rideId = change.doc.id;

          if (
            (change.type === "added" || change.type === "modified") &&
            rideData.locationData
          ) {
            const { latitude, longitude } = rideData.locationData;

            // Get user details
            const userRef = doc(db, "approved_users", rideData.userId);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : {};
            const userName = `${userData.first_name || ""} ${
              userData.surname || ""
            }`.trim();

            // Get bike details
            const bikeRef = doc(db, "bikes", rideData.bikeId);
            const bikeSnap = await getDoc(bikeRef);
            const bikeData = bikeSnap.exists() ? bikeSnap.data() : {};
            const bikeName = bikeData.bikeName || "Unknown Bike";

            if (!markersRef.current[rideId]) {
              // Create marker element
              const el = document.createElement("div");
              el.className = "user-location-marker";

              // Create simple popup with actual name and bike name
              const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                anchor: "top",
                offset: [0, -10],
              }).setHTML(`
                <div class="simple-popup">
                  <p><strong>${userName}</strong></p>
                  <p>Bike: ${bikeName}</p>
                </div>
              `);

              // Create and add marker with popup
              markersRef.current[rideId] = new mapboxgl.Marker({
                element: el,
                anchor: "center",
              })
                .setLngLat([longitude, latitude])
                .setPopup(popup)
                .addTo(map.current);
            } else {
              // Update marker position and popup content
              markersRef.current[rideId]
                .setLngLat([longitude, latitude])
                .getPopup().setHTML(`
                  <div class="simple-popup">
                    <p><strong>${userName}</strong></p>
                    <p>Bike: ${bikeName}</p>
                  </div>
                `);
            }
          }

          if (change.type === "removed") {
            if (markersRef.current[rideId]) {
              markersRef.current[rideId].remove();
              delete markersRef.current[rideId];
            }
          }
        });
      } catch (error) {
        console.error("Error updating markers:", error);
      }
    });

    return () => {
      unsubscribe();
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const activeRidesRef = collection(db, "activeRides");
    const q = query(activeRidesRef, where("rideStatus", "==", "started"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveUsersCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = fetchActiveRides();
    } catch (error) {
      console.error("Error setting up active rides listener:", error);
    }

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribeAdmins = fetchActiveAdmins();

    return () => {
      if (typeof unsubscribeAdmins === "function") {
        unsubscribeAdmins();
      }
    };
  }, []);

  // Remove duplicate useEffect for hourly revenue and combine into one
  useEffect(() => {
    const today = dayjs().startOf("day");
    const rideHistoryRef = collection(db, "ride_history");
    let unsubscribeListener = null;

    try {
      unsubscribeListener = onSnapshot(rideHistoryRef, (snapshot) => {
        // Initialize metrics and hourly data
        let metrics = {
          totalDistance: 0,
          totalDuration: 0,
          totalCalories: 0,
          totalCarbon: 0,
          totalRevenue: 0,
        };
        let hourlyData = Array(24).fill(0);
        let todayRides = 0;

        snapshot.forEach((doc) => {
          const rideData = doc.data();
          if (rideData.rideEndedAt) {
            const endDate = getDayjsDate(rideData.rideEndedAt);

            if (endDate.isSame(today, "day")) {
              // Update metrics
              metrics.totalDistance += Number(rideData.distance || 0);
              metrics.totalDuration += Number(rideData.duration || 0);
              metrics.totalCalories += Number(rideData.caloriesBurned || 0);
              metrics.totalCarbon += Number(rideData.carbonSaved || 0);
              metrics.totalRevenue += Number(rideData.amountPaid || 0);

              // Update hourly revenue
              const hour = endDate.hour();
              hourlyData[hour] += Number(rideData.amountPaid || 0);

              // Increment today's rides count
              todayRides++;
            }
          }
        });

        // Update all states at once
        setTodaysMetrics(metrics);
        setHourlyRevenue(hourlyData);
        setTotalRidesToday(todayRides);
      });
    } catch (error) {
      console.error("Error setting up ride history listener:", error);
    }

    return () => {
      if (typeof unsubscribeListener === "function") {
        unsubscribeListener();
      }
    };
  }, []);

  // Update the data array order
  const data = [
    { name: "Bikes Available", value: totalBikes },
    { name: "Active Users", value: activeUsersCount },
    { name: "Active Admins", value: activeAdminsCount },
    {
      name: "Today's Revenue",
      value: Number(todaysMetrics?.totalRevenue || 0),
    },
    { name: "Rides Today", value: totalRidesToday },
  ];

  return (
    <div className="content-container">
      <div className="content-header">
        <h1 className="content-header__title">Hello {userName}!</h1>
        <p className="content-header__subtitle">
          Keeping the wheels turning for a greener future.
        </p>
      </div>

      <div className="stats-section">
        {data.map((stat, index) => (
          <div key={index} className="stat-card">
            <h3 className="stat-card__title">{stat.name}</h3>
            <p className="stat-card__value">
              {stat.name === "Today's Revenue"
                ? Number(stat.value).toFixed(2)
                : typeof stat.value === "undefined"
                ? "0"
                : stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="tracking-section">
        <div className="active-rides-table">
          <h3 className="section-title">Active Rides</h3>
          <table>
            <thead>
              <tr>
                <th>Rider Name</th>
                <th>Start Time</th>
                <th>Bike Name</th>
                <th>Station</th>
              </tr>
            </thead>
            <tbody>
              {activeRides.slice(0, 5).map((ride) => (
                <tr key={ride.rideId}>
                  <td>{ride.userName}</td>
                  <td>{getDayjsDate(ride.startTime).format("HH:mm:ss")}</td>
                  <td>{ride.bikeName}</td>
                  <td>{ride.stationName}</td>
                </tr>
              ))}
              {activeRides.length === 0 && (
                <tr>
                  <td colSpan="4" className="no-rides">
                    No active rides at the moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="map-container">
          <div className="map-section-header">
            <h2 className="map-title">
              <FaMapMarkedAlt /> Live User Activity Map
            </h2>
            <p className="map-subtitle">
              Track real-time locations of active riders across the system
            </p>
          </div>
          <div ref={mapContainer} className="ride-tracking-map" />
        </div>
      </div>

      <div className="charts-grid">
        <div className="charts-row">
          <div className="chart-container">
            <h3 className="chart-title">Today's Ride Metrics</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: "Distance",
                    value: parseFloat(todaysMetrics.totalDistance || 0),
                    unit: "km",
                  },
                  {
                    name: "Duration",
                    value: parseFloat((todaysMetrics.totalDuration || 0) / 60), // Convert seconds to minutes
                    unit: "min",
                  },
                  {
                    name: "Calories",
                    value: parseFloat(todaysMetrics.totalCalories || 0),
                    unit: "cal",
                  },
                  {
                    name: "CO2 Saved",
                    value: parseFloat(todaysMetrics.totalCarbon || 0),
                    unit: "kg",
                  },
                ]}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(value) => value.toFixed(2)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    if (props && props.payload) {
                      return [
                        `${value.toFixed(2)} ${props.payload.unit}`,
                        name,
                      ];
                    }
                    return [value, name];
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="value"
                  fill="#009C8C" // Using the same color as System Overview
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value, entry) => {
                      if (entry && entry.payload) {
                        return `${value.toFixed(2)} ${entry.payload.unit}`;
                      }
                      return value.toFixed(2);
                    }}
                    style={{ fontSize: "11px" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3 className="chart-title">System Overview</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#009C8C" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="revenue-section">
          <h3 className="chart-title">Today's Hourly Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={hourlyRevenue.map((value, index) => ({
                hour: `${String(index).padStart(2, "0")}:00`,
                value: value,
              }))}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={2} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `₱${value.toFixed(2)}`}
              />
              <Tooltip
                formatter={(value) => [
                  `₱${Number(value).toFixed(2)}`,
                  "Revenue",
                ]}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4CAF50"
                strokeWidth={2}
                dot={{ fill: "#4CAF50" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Content;
