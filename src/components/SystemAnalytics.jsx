import React, { useState, useEffect } from "react";
import { getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  AreaChart,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ComposedChart,
} from "recharts";
import Layout from "./Layout";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear"; // Add this
import isBetween from "dayjs/plugin/isBetween"; // Add this import
import "../styles/SystemAnalytics.css"; // Add this line
import ContentHeader from "./ContentHeader"; // Add this import

// Add weekOfYear plugin
dayjs.extend(weekOfYear);
dayjs.extend(isBetween);
const HighlightedText = ({ text }) => {
  // Updated regex to not match numbers that are part of station names
  const regex = /(?<![A-Za-z])(?<!-)(?<!\/)\b(\d+\.?\d*)\b(?![A-Za-z])/g;
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="highlighted-number">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const AnalysisCard = ({ title, analysis }) => (
  <div className="analysis-card">
    <h3>{title}</h3>
    <p>
      <HighlightedText text={analysis} />
    </p>
  </div>
);

const SystemAnalytics = () => {
  const [stationRevenue, setStationRevenue] = useState([]);
  const [metricsHistory, setMetricsHistory] = useState({
    calories: [],
    distance: [],
    duration: [],
    carbonSaved: [],
  });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [popularStations, setPopularStations] = useState([]);
  const [timePeriod, setTimePeriod] = useState("monthly");
  const [allRides, setAllRides] = useState([]); // Add this state
  const [rideRatings, setRideRatings] = useState([]); // Add this state

  // Add time period filter options
  const timeFilters = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  // Add more colors for variety
  const COLORS = [
    "#009C8C",
    "#4CAF50",
    "#2196F3",
    "#FFA726",
    "#FF5722",
    "#9C27B0",
    "#673AB7",
    "#3F51B5",
    "#00BCD4",
    "#795548",
  ];

  // Replace the processStationData function with:
  const processStationData = (stations, rides, period) => {
    const now = dayjs();
    const stationRides = new Map();

    // Filter rides by time period
    const filteredRides = rides.filter((ride) => {
      const rideDate = dayjs(ride.rideEndedAt);
      switch (period) {
        case "daily":
          return rideDate.isSame(now, "day");
        case "weekly":
          return rideDate.isAfter(now.subtract(1, "week"));
        case "monthly":
          return rideDate.isAfter(now.subtract(1, "month"));
        default:
          return true;
      }
    });

    // Count rides per station
    filteredRides.forEach((ride) => {
      if (ride.startStation) {
        stationRides.set(
          ride.startStation,
          (stationRides.get(ride.startStation) || 0) + 1
        );
      }
    });

    // Map station data with ride counts
    return stations
      .map((station) => ({
        id: station.id,
        stationName: station.stationName,
        rides: stationRides.get(station.id) || 0,
      }))
      .sort((a, b) => b.rides - a.rides);
  };

  // Update the groupDataByPeriod function to include all metrics
  const groupDataByPeriod = (rides, period) => {
    const groupedData = new Map();
    const now = dayjs();

    // Determine date range based on period
    let startDate, endDate;
    switch (period) {
      case "daily":
        startDate = now.subtract(6, "day").startOf("day");
        endDate = now.endOf("day");
        break;
      case "weekly":
        startDate = now.subtract(11, "week").startOf("week");
        endDate = now.endOf("week");
        break;
      case "monthly":
        startDate = now.subtract(11, "month").startOf("month");
        endDate = now.endOf("month");
        break;
      default:
        const dates = rides.map((ride) => dayjs(ride.rideEndedAt));
        startDate = dayjs.min(dates);
        endDate = now;
    }

    // Create all period slots even if there's no data
    let current = startDate;
    while (current.isBefore(endDate)) {
      let key;
      switch (period) {
        case "daily":
          key = current.format("MMM DD");
          current = current.add(1, "day");
          break;
        case "weekly":
          key = `Week ${current.week()} - ${current.format("MMM")}`;
          current = current.add(1, "week");
          break;
        case "monthly":
          key = current.format("MMM YYYY");
          current = current.add(1, "month");
          break;
      }

      groupedData.set(key, {
        period: key,
        revenue: 0,
        calories: 0,
        distance: 0,
        duration: 0,
        carbonSaved: 0,
        rides: 0,
      });
    }

    // Fill in actual data
    rides.forEach((ride) => {
      const date = dayjs(ride.rideEndedAt);
      if (date.isBetween(startDate, endDate, null, "[]")) {
        let key;
        switch (period) {
          case "daily":
            key = date.format("MMM DD");
            break;
          case "weekly":
            key = `Week ${date.week()} - ${date.format("MMM")}`;
            break;
          case "monthly":
            key = date.format("MMM YYYY");
            break;
        }

        if (groupedData.has(key)) {
          const data = groupedData.get(key);
          data.revenue += Number(ride.amountPaid || 0);
          data.calories += Number(ride.caloriesBurned || 0);
          data.distance += Number(ride.distance || 0);
          data.duration += Number(ride.duration || 0) / 60; // Convert seconds to minutes here
          data.carbonSaved += Number(ride.carbonSaved || 0);
          data.rides += 1;
        }
      }
    });

    // Calculate averages and totals
    return Array.from(groupedData.values()).map((data) => ({
      ...data,
      avgCalories: data.rides > 0 ? data.calories / data.rides : 0,
      avgDistance: data.rides > 0 ? data.distance / data.rides : 0,
      avgDuration: data.rides > 0 ? data.duration / data.rides : 0,
      avgCarbonSaved: data.rides > 0 ? data.carbonSaved / data.rides : 0,
    }));
  };

  // Update the calculatePeriodTotal function
  const calculatePeriodTotal = (data, metric) => {
    return data.reduce((sum, period) => sum + (period[metric] || 0), 0);
  };

  // Update only the filterRidesByTime function - add this if it doesn't exist
  const filterRidesByTime = (rides, period) => {
    const now = dayjs();
    switch (period) {
      case "daily":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isSame(now, "day")
        );
      case "weekly":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isAfter(now.subtract(1, "week"))
        );
      case "monthly":
        return rides.filter((ride) =>
          dayjs(ride.rideEndedAt).isAfter(now.subtract(1, "month"))
        );
      default:
        return rides;
    }
  };

  // Update only the generateAnalysis function
  const generateAnalysis = (data, metric) => {
    if (!data || data.length === 0) return "No data available";

    const filteredRides = filterRidesByTime(allRides, timePeriod);
    const total = filteredRides.reduce((sum, ride) => {
      switch (metric) {
        case "revenue":
          return sum + (ride.amountPaid || 0);
        case "calories":
          return sum + (ride.caloriesBurned || 0);
        case "distance":
          return sum + (ride.distance || 0);
        case "duration":
          return sum + (ride.duration || 0) / 60; // Convert seconds to minutes
        case "carbonSaved":
          return sum + (ride.carbonSaved || 0);
        default:
          return sum;
      }
    }, 0);

    const rides = filteredRides.length;
    const timePhrase =
      timePeriod === "daily"
        ? "today"
        : timePeriod === "weekly"
        ? "this week"
        : "this month";

    switch (metric) {
      case "revenue":
        const averagePerRide = rides > 0 ? total / rides : 0;
        return `The EcoRide Parada system generated ₱${total.toFixed(
          2
        )} in revenue ${timePhrase}. 
                With ${rides} rides completed, residents spent an average of ₱${averagePerRide.toFixed(
          2
        )} per trip. 
                These funds support system maintenance and expansion, creating sustainable transportation
                infrastructure for Barangay Parada while providing an affordable alternative to motor vehicles.`;

      case "calories":
        const healthCostSavings = total * 0.26; // P0.26 per km health cost savings
        return `Barangay Parada residents burned ${total.toFixed(
          0
        )} calories through cycling ${timePhrase}, 
                equivalent to approximately ${Math.round(
                  total / 100
                )} healthy meals worth of energy. 
                This active transportation promotes community health and wellness, generating estimated healthcare 
                cost savings of ₱${healthCostSavings.toFixed(
                  2
                )} through preventative exercise. Regular cyclists in Parada 
                report improved cardiovascular health and reduced stress levels, creating a healthier community.`;

      case "distance":
        // One bike = 0.25 car units (Metro Manila standard)
        const carUnitEquivalent = 0.25;
        const carSpaceReduction = total * carUnitEquivalent;

        return `EcoRide users covered ${total.toFixed(
          2
        )} km by bike ${timePhrase}. 
                Based on Metro Manila traffic research, each bike takes up only 0.25 car units 
                of road space, representing approximately ${Math.round(
                  carSpaceReduction
                )} car-equivalent 
                trips removed from local roads. This efficient use of road space helps reduce 
                traffic congestion in Barangay Parada's busiest areas.`;

      case "duration":
        const hours = Math.floor(total / 60);
        const minutes = Math.floor(total % 60);
        const parkingTime = rides * 5;
        const trafficTime = total * 0.3;

        return `Barangay Parada cyclists spent ${hours} hours and ${minutes} minutes riding ${timePhrase}. 
                By choosing EcoRide over cars, residents collectively saved approximately ${Math.round(
                  parkingTime / 60 + trafficTime
                )} hours 
                on parking and traffic delays. This represents significant quality-of-life improvement for
                community members while reducing road congestion by an estimated ${Math.round(
                  rides * 0.8
                )} vehicles during 
                peak hours, improving mobility for all Parada residents.`;

      case "carbonSaved":
        const treesNeeded = (total / 21).toFixed(1);
        const carEquivalent = (total / 0.251).toFixed(1);
        const localAirQualityImprovement = (total * 0.05).toFixed(1);
        return `The EcoRide system prevented ${total.toFixed(
          2
        )} kg of CO2 emissions in Barangay Parada ${timePhrase}, 
                equivalent to the yearly CO2 absorption of ${treesNeeded} trees. This translates to approximately 
                ${carEquivalent} km of car travel removed from local roads and an estimated ${localAirQualityImprovement}% 
                improvement in local air quality. Every ride contributes to Parada's sustainability goals, helping 
                transform the barangay into a model for eco-friendly transportation in Metro Manila.`;

      default:
        return "No analysis available";
    }
  };

  // Add this function to process ratings data
  const processRatingsData = (ratings, period) => {
    const ratingsByPeriod = new Map();
    const now = dayjs();

    ratings.forEach((rating) => {
      const date = dayjs(rating.timestamp);
      let key;

      switch (period) {
        case "daily":
          key = date.format("MMM DD");
          break;
        case "weekly":
          key = `Week ${date.week()} - ${date.format("MMM")}`;
          break;
        case "monthly":
          key = date.format("MMM YYYY");
          break;
      }

      if (!ratingsByPeriod.has(key)) {
        ratingsByPeriod.set(key, {
          period: key,
          averageRating: rating.rating,
          totalRatings: 1,
        });
      } else {
        const existing = ratingsByPeriod.get(key);
        existing.averageRating =
          (existing.averageRating * existing.totalRatings + rating.rating) /
          (existing.totalRatings + 1);
        existing.totalRatings += 1;
      }
    });

    return Array.from(ratingsByPeriod.values());
  };

  // Update the fetchAnalytics function:
  const fetchAnalytics = async () => {
    try {
      // Fetch rides
      const rideHistoryRef = collection(db, "ride_history");
      const ridesSnap = await getDocs(rideHistoryRef);
      const rides = ridesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        rideEndedAt: doc.data().rideEndedAt?.toDate
          ? doc.data().rideEndedAt.toDate()
          : new Date(doc.data().rideEndedAt.seconds * 1000),
      }));

      setAllRides(rides);

      // Fetch stations
      const stationsRef = collection(db, "stations");
      const stationsSnap = await getDocs(stationsRef);
      const stations = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        stationName: doc.data().stationName,
      }));

      // Process station data with the new function
      const processedStations = processStationData(stations, rides, timePeriod);
      setPopularStations(processedStations);

      // Process data for different time periods using all rides
      const monthlyData = groupDataByPeriod(rides, "monthly");
      const weeklyData = groupDataByPeriod(rides, "weekly");
      const dailyData = groupDataByPeriod(rides, "daily");

      setMonthlyStats({
        monthly: monthlyData,
        weekly: weeklyData,
        daily: dailyData,
      });

      // Update station statistics - count all rides
      const stationRevenueMap = new Map();
      stations.forEach((station) => {
        stationRevenueMap.set(station.id, {
          stationName: station.stationName,
          revenue: 0,
          rides: 0,
        });
      });

      rides.forEach((ride) => {
        if (ride.startStation) {
          const stationData = stationRevenueMap.get(ride.startStation);
          if (stationData) {
            stationData.revenue += Number(ride.amountPaid);
            stationData.rides += 1;
          }
        }
      });

      const stationRevenueArray = Array.from(stationRevenueMap.values()).sort(
        (a, b) => b.revenue - a.revenue
      );

      setStationRevenue(stationRevenueArray);

      // Fetch ride ratings
      const ratingsRef = collection(db, "ride_ratings");
      const ratingsSnap = await getDocs(ratingsRef);
      const ratings = ratingsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate
          ? doc.data().timestamp.toDate()
          : new Date(doc.data().timestamp.seconds * 1000),
      }));
      setRideRatings(ratings);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timePeriod]);

  // Update the getFilteredData function
  const getFilteredData = (data, period) => {
    return data[period] || [];
  };

  // Update the summary card calculation logic
  const calculatePeriodAverage = (data, metric) => {
    const total = calculatePeriodTotal(data, metric);
    switch (timePeriod) {
      case "daily":
        return total / 1; // Daily average is just the daily value
      case "weekly":
        return total / 7; // Weekly total divided by 7 days
      case "monthly":
        return total / 30; // Monthly total divided by 30 days
      default:
        return 0;
    }
  };

  return (
    <Layout>
      <ContentHeader /> {/* Add this line */}
      <div className="analytics-container">
        <div className="analytics-header">
          <h1>System Analytics</h1>
          <div className="time-filter">
            {timeFilters.map((filter) => (
              <button
                key={filter.value}
                className={`filter-btn ${
                  timePeriod === filter.value ? "active" : ""
                }`}
                onClick={() => setTimePeriod(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="charts-grid">
          {/* Revenue Trend */}
          <div className="chart-section full-width">
            <h2>Revenue Trend</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <AreaChart
                  data={getFilteredData(monthlyStats, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 90 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#009C8C" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#009C8C"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(value) => `₱${value.toFixed(0)}`}
                    label={{
                      value: "Revenue (₱)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      dy: 50,
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [`₱${value.toFixed(2)}`, "Revenue"]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{
                      paddingTop: "20px",
                      marginBottom: "10px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#009C8C"
                    fill="url(#revenueGradient)"
                    name="Revenue"
                    dot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Revenue Analysis"
                analysis={generateAnalysis(
                  getFilteredData(monthlyStats, timePeriod),
                  "revenue"
                )}
              />
            </div>
          </div>

          {/* Revenue by Station */}
          <div className="chart-section full-width">
            <h2>Revenue by Station</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={stationRevenue.filter((station) => station.revenue > 0)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 120 }} // Increased bottom margin
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="stationName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tickFormatter={(value) => `₱${value.toFixed(2)}`} />
                  <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} />
                  <Bar dataKey="revenue">
                    {stationRevenue
                      .filter((station) => station.revenue > 0)
                      .map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Station Revenue Analysis"
                analysis={`The top earning station is ${
                  stationRevenue[0]?.stationName || "N/A"
                } with ₱${stationRevenue[0]?.revenue.toFixed(
                  2
                )} in revenue. There are ${
                  stationRevenue.filter((s) => s.revenue > 0).length
                } stations generating revenue, with a total system revenue of ₱${stationRevenue
                  .reduce((sum, station) => sum + station.revenue, 0)
                  .toFixed(2)}.`}
              />
            </div>
          </div>

          {/* Calories Chart */}
          <div className="chart-section full-width">
            <h2>Average Calories Burned</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <AreaChart
                  data={getFilteredData(monthlyStats, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <defs>
                    <linearGradient
                      id="caloriesGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#FF5722" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#FF5722"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="calories"
                    stroke="#FF5722"
                    fill="url(#caloriesGradient)"
                    name="Calories Burned"
                    dot={{ fill: "#FF5722" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Health Impact Analysis"
                analysis={generateAnalysis(
                  getFilteredData(monthlyStats, timePeriod),
                  "calories"
                )}
              />
            </div>
          </div>

          {/* Distance Chart */}
          <div className="chart-section full-width">
            <h2>Average Distance Covered</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <AreaChart
                  data={getFilteredData(monthlyStats, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <defs>
                    <linearGradient
                      id="distanceGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#2196F3" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#2196F3"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="distance"
                    stroke="#2196F3"
                    fill="url(#distanceGradient)"
                    name="Distance (km)"
                    dot={{ fill: "#2196F3" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Distance Analysis"
                analysis={generateAnalysis(
                  getFilteredData(monthlyStats, timePeriod),
                  "distance"
                )}
              />
            </div>
          </div>

          {/* Duration Chart */}
          <div className="chart-section full-width">
            <h2>Average Ride Duration</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <AreaChart
                  data={getFilteredData(monthlyStats, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <defs>
                    <linearGradient
                      id="durationGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#9C27B0" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#9C27B0"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value.toFixed(0)} minutes`,
                      "Duration",
                    ]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="duration"
                    stroke="#9C27B0"
                    fill="url(#durationGradient)"
                    name="Duration (minutes)"
                    dot={{ fill: "#9C27B0" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Duration Analysis"
                analysis={generateAnalysis(
                  getFilteredData(monthlyStats, timePeriod),
                  "duration"
                )}
              />
            </div>
          </div>

          {/* CO2 Saved Chart */}
          <div className="chart-section full-width">
            <h2>Average CO2 Saved</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <AreaChart
                  data={getFilteredData(monthlyStats, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <defs>
                    <linearGradient
                      id="co2Gradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#4CAF50"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="carbonSaved"
                    stroke="#4CAF50"
                    fill="url(#co2Gradient)"
                    name="CO2 Saved (kg)"
                    dot={{ fill: "#4CAF50" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="Environmental Impact Analysis"
                analysis={generateAnalysis(
                  getFilteredData(monthlyStats, timePeriod),
                  "carbonSaved"
                )}
              />
            </div>
          </div>

          {/* User Ride Ratings */}
          <div className="chart-section full-width">
            <h2>User Ride Ratings</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart
                  data={processRatingsData(rideRatings, timePeriod)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    label={{
                      value: "Average Rating",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "averageRating"
                        ? `${value.toFixed(2)} stars`
                        : value,
                      name === "averageRating"
                        ? "Average Rating"
                        : "Total Ratings",
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="totalRatings"
                    fill="#82ca9d"
                    name="Total Ratings"
                    opacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageRating"
                    stroke="#ff7300"
                    name="Average Rating"
                    strokeWidth={2}
                    dot={{ fill: "#ff7300" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <AnalysisCard
                title="User Satisfaction Analysis"
                analysis={(() => {
                  const currentRatings = processRatingsData(
                    rideRatings,
                    timePeriod
                  );
                  if (currentRatings.length === 0)
                    return "No ratings data available for this period.";

                  const totalRatings = currentRatings.reduce(
                    (sum, period) => sum + period.totalRatings,
                    0
                  );
                  const averageRating =
                    currentRatings.reduce(
                      (sum, period) =>
                        sum + period.averageRating * period.totalRatings,
                      0
                    ) / totalRatings;

                  const timePhrase =
                    timePeriod === "daily"
                      ? "today"
                      : timePeriod === "weekly"
                      ? "this week"
                      : "this month";

                  return `Users submitted ${totalRatings} ride ratings ${timePhrase}, with an average satisfaction score of ${averageRating.toFixed(
                    2
                  )} out of 5 stars. ${
                    averageRating >= 4.5
                      ? "Users are highly satisfied with the service."
                      : averageRating >= 4.0
                      ? "Users are generally satisfied with the service."
                      : averageRating >= 3.5
                      ? "Users find the service acceptable but there's room for improvement."
                      : "User satisfaction needs attention and improvement measures should be considered."
                  }`;
                })()}
              />
            </div>
          </div>

          {/* Popular Stations */}
          <div className="chart-section full-width">
            <h2>Most Popular Stations ({timePeriod})</h2>
            <div className="chart-with-analysis">
              <ResponsiveContainer width="100%" height={600}>
                <PieChart>
                  <Pie
                    data={processStationData(
                      popularStations,
                      allRides,
                      timePeriod
                    )
                      .filter((station) => station.rides > 0)
                      .slice(0, 5)}
                    dataKey="rides"
                    nameKey="stationName"
                    cx="50%"
                    cy="50%"
                    outerRadius={180}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {processStationData(popularStations, allRides, timePeriod)
                      .filter((station) => station.rides > 0)
                      .slice(0, 5)
                      .map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} rides`, name]}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              <AnalysisCard
                title={`Station Usage Analysis (${timePeriod})`}
                analysis={`For this ${timePeriod} period, the top stations account for ${processStationData(
                  popularStations,
                  allRides,
                  timePeriod
                )
                  .filter((s) => s.rides > 0)
                  .slice(0, 5)
                  .reduce(
                    (sum, station) => sum + station.rides,
                    0
                  )} rides out of ${allRides.length} total system rides. ${
                  processStationData(popularStations, allRides, timePeriod)[0]
                    ?.stationName || "N/A"
                } is currently the most active station with ${
                  processStationData(popularStations, allRides, timePeriod)[0]
                    ?.rides || 0
                } rides in this period.`}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SystemAnalytics;
