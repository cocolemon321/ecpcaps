import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  DrawingManager,
  Polygon,
  Circle,
} from "@react-google-maps/api";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Sidebar from "./Sidebar";
import Header from "./ContentHeader";
import "../styles/CoverageArea.css";

const containerStyle = {
  width: "100%",
  height: "500px",
};

// Updated coordinates for Parada
const center = {
  lat: 14.69583930582976,
  lng: 120.98925961701622,
};

const libraries = ["drawing"];

const CoverageArea = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawingMode, setDrawingMode] = useState("circle");
  const [coverageAreas, setCoverageAreas] = useState([]);
  const [map, setMap] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(null); // For editing
  const overlaysRef = useRef([]); // Track overlays

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyCIaoxdmh-5kDnUuVyyCyimR_HwVgQWJYk",
    libraries: libraries,
  });

  // Load coverage areas from Firestore on mount
  useEffect(() => {
    const loadCoverageAreas = async () => {
      try {
        const coverageDoc = await getDoc(
          doc(db, "system_settings", "coverage_area")
        );
        if (coverageDoc.exists()) {
          const data = coverageDoc.data();
          if (data.geometries) {
            setCoverageAreas(data.geometries);
            setHistory([data.geometries]);
            setHistoryIndex(0);
          }
        }
      } catch (err) {
        console.error("Error loading coverage areas:", err);
        setError("Failed to load coverage areas. Please try again.");
      }
    };
    loadCoverageAreas();
  }, []);

  const onLoad = useCallback((map) => {
    setMap(map);
    setIsLoading(false);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Remove overlays from map
  const removeAllOverlays = () => {
    overlaysRef.current.forEach((overlay) => {
      if (overlay && typeof overlay.setMap === "function") {
        overlay.setMap(null);
      }
    });
    overlaysRef.current = [];
  };

  // Drawing complete handler
  const handleDrawingComplete = (e) => {
    let geometry;
    overlaysRef.current.push(e);
    if (drawingMode === "circle") {
      const circle = e;
      if (!circle || typeof circle.getCenter !== "function") {
        console.error("Invalid circle object:", e);
        return;
      }
      const center = circle.getCenter();
      geometry = {
        type: "circle",
        center: {
          lat: center.lat(),
          lng: center.lng(),
        },
        radius: circle.getRadius(),
      };
    } else {
      const polygon = e;
      if (!polygon || typeof polygon.getPath !== "function") {
        console.error("Invalid polygon object:", e);
        return;
      }
      const path = polygon.getPath().getArray();
      geometry = {
        type: "polygon",
        coordinates: path.map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        })),
      };
    }
    if (geometry) {
      const newAreas = [...coverageAreas, geometry];
      setCoverageAreas(newAreas);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newAreas);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  // Select a shape for editing
  const handleShapeClick = (index) => {
    setSelectedIndex(index);
  };

  // When editing is done (for circle or polygon)
  const handleEditComplete = (type, overlay, index) => {
    let updatedGeometry;
    if (type === "circle") {
      const center = overlay.getCenter();
      updatedGeometry = {
        type: "circle",
        center: {
          lat: center.lat(),
          lng: center.lng(),
        },
        radius: overlay.getRadius(),
      };
    } else {
      const path = overlay.getPath().getArray();
      updatedGeometry = {
        type: "polygon",
        coordinates: path.map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        })),
      };
    }
    const updatedAreas = coverageAreas.map((area, i) =>
      i === index ? updatedGeometry : area
    );
    setCoverageAreas(updatedAreas);
    setSelectedIndex(null);
  };

  // Undo/Redo/Clear logic
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCoverageAreas(history[newIndex]);
      setSelectedIndex(null);
      removeAllOverlays();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCoverageAreas(history[newIndex]);
      setSelectedIndex(null);
      removeAllOverlays();
    }
  };

  const handleClear = () => {
    setCoverageAreas([]);
    removeAllOverlays();
    setSelectedIndex(null);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Save to Firestore
  const handleSave = async () => {
    try {
      setIsSaving(true);
      await setDoc(doc(db, "system_settings", "coverage_area"), {
        geometries: coverageAreas,
        updatedAt: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      console.error("Error saving coverage areas:", err);
      setError("Failed to save coverage areas. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDrawingMode = () => {
    setDrawingMode(drawingMode === "circle" ? "polygon" : "circle");
    setSelectedIndex(null);
  };

  if (!isLoaded) {
    return <div className="loading">Loading map...</div>;
  }

  return (
    <>
      <Sidebar />
      <div className="coverage-area-content">
        <div className="coverage-area-container">
          <div className="coverage-area-header">
            <h1>Coverage Area Management</h1>
            <p>Define the allowed registration areas for your system</p>
          </div>

          <div className="map-controls">
            <button
              className={`draw-mode-btn ${
                drawingMode === "circle" ? "active" : ""
              }`}
              onClick={toggleDrawingMode}
            >
              {drawingMode === "circle"
                ? "Switch to Polygon"
                : "Switch to Circle"}
            </button>
            <button
              className="action-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              Undo
            </button>
            <button
              className="action-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              Redo
            </button>
            <button
              className="action-btn"
              onClick={handleClear}
              disabled={coverageAreas.length === 0}
            >
              Clear
            </button>
            <button
              className="action-btn save"
              onClick={handleSave}
              disabled={isSaving || coverageAreas.length === 0}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="map-container">
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              <DrawingManager
                drawingMode={drawingMode === "circle" ? "circle" : "polygon"}
                options={{
                  drawingControl: false,
                  circleOptions: {
                    fillColor: "#009C8C",
                    fillOpacity: 0.3,
                    strokeColor: "#009C8C",
                    strokeWeight: 2,
                    clickable: true,
                    editable: false,
                    zIndex: 1,
                  },
                  polygonOptions: {
                    fillColor: "#009C8C",
                    fillOpacity: 0.3,
                    strokeColor: "#009C8C",
                    strokeWeight: 2,
                    clickable: true,
                    editable: false,
                    zIndex: 1,
                  },
                }}
                onCircleComplete={handleDrawingComplete}
                onPolygonComplete={handleDrawingComplete}
              />

              {coverageAreas.map((area, index) =>
                area.type === "circle" ? (
                  <Circle
                    key={`circle-${index}`}
                    center={area.center}
                    radius={area.radius}
                    options={{
                      fillColor: "#009C8C",
                      fillOpacity: 0.3,
                      strokeColor: "#009C8C",
                      strokeWeight: 2,
                      editable: selectedIndex === index,
                      clickable: true,
                    }}
                    onClick={() => handleShapeClick(index)}
                    onDragEnd={(e) => {
                      if (selectedIndex === index) {
                        handleEditComplete("circle", e.overlay, index);
                      }
                    }}
                  />
                ) : (
                  <Polygon
                    key={`polygon-${index}`}
                    paths={area.coordinates}
                    options={{
                      fillColor: "#009C8C",
                      fillOpacity: 0.3,
                      strokeColor: "#009C8C",
                      strokeWeight: 2,
                      editable: selectedIndex === index,
                      clickable: true,
                    }}
                    onClick={() => handleShapeClick(index)}
                    onMouseUp={(e) => {
                      if (selectedIndex === index) {
                        handleEditComplete("polygon", e.overlay, index);
                      }
                    }}
                  />
                )
              )}
            </GoogleMap>
          </div>

          <div className="instructions">
            <h3>How to use:</h3>
            <ol>
              <li>
                Click the button above to switch between Circle and Polygon
                drawing modes
              </li>
              <li>
                Draw your coverage areas on the map (you can draw multiple
                areas)
              </li>
              <li>Click "Save Areas" when you're done</li>
              <li>Use "Clear All" to remove all areas and start over</li>
              <li>
                Click a shape to select and edit it, then save your changes
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoverageArea;
