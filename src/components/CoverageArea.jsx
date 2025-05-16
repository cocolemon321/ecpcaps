import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  DrawingManager,
  Polygon,
  Circle,
} from "@react-google-maps/api";
import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import Sidebar from "./Sidebar";
import Header from "./ContentHeader";
import "../styles/CoverageArea.css";
import { logAdminAction } from "../utils/logAdminAction";

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
  const [coverageName, setCoverageName] = useState("");
  const [savedCoverages, setSavedCoverages] = useState([]);
  const [selectedCoverage, setSelectedCoverage] = useState(null);
  const [map, setMap] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const overlaysRef = useRef([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showCoverageDropdown, setShowCoverageDropdown] = useState(false);
  const [prevCoverage, setPrevCoverage] = useState(null);
  const [pendingCoverage, setPendingCoverage] = useState(null);
  const [pendingCoverageName, setPendingCoverageName] = useState(null);
  const [showPendingSave, setShowPendingSave] = useState(false);
  const [prevCoverageSnapshot, setPrevCoverageSnapshot] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyCIaoxdmh-5kDnUuVyyCyimR_HwVgQWJYk",
    libraries: libraries,
  });

  // Load coverage areas from Firestore on mount (real-time)
  useEffect(() => {
    const docRef = doc(db, "system_settings", "coverage_area");
    const unsubscribe = onSnapshot(docRef, (coverageDoc) => {
      if (coverageDoc.exists()) {
        const data = coverageDoc.data();
        if (data.savedCoverages) {
          setSavedCoverages(data.savedCoverages);
          // Auto-select the most recent or first coverage area if none selected
          if (!selectedCoverage && data.savedCoverages.length > 0) {
            const last = data.savedCoverages[data.savedCoverages.length - 1];
            setSelectedCoverage(last.name);
            setCoverageAreas(last.geometries);
            setCoverageName(last.name);
            setHistory([last.geometries]);
            setHistoryIndex(0);
          }
        }
        if (
          data.geometries &&
          (!data.savedCoverages || data.savedCoverages.length === 0)
        ) {
          setCoverageAreas(data.geometries);
          setHistory([data.geometries]);
          setHistoryIndex(0);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Mark unsaved changes when coverageAreas or coverageName changes in edit/create mode
  useEffect(() => {
    if (isEditing || isCreating) {
      setUnsavedChanges(true);
    }
  }, [coverageAreas, coverageName]);

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

  // Safety net: remove overlays if coverageAreas becomes empty
  useEffect(() => {
    if (coverageAreas.length === 0) {
      removeAllOverlays();
    }
  }, [coverageAreas]);

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
      removeAllOverlays();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCoverageAreas(history[newIndex]);
      setSelectedIndex(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      removeAllOverlays();
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCoverageAreas(history[newIndex]);
      setSelectedIndex(null);
    }
  };

  const handleClear = () => {
    removeAllOverlays();
    setCoverageAreas([]);
    setSelectedIndex(null);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Save to Firestore
  const handleSave = async () => {
    if (!coverageName.trim()) {
      setError("Please enter a name for the coverage area");
      return;
    }
    try {
      setIsSaving(true);
      const newCoverage = {
        name: coverageName,
        geometries: coverageAreas,
        updatedAt: new Date().toISOString(),
      };
      const updatedCoverages = savedCoverages.filter(
        (c) => c.name !== coverageName
      );
      updatedCoverages.push(newCoverage);
      await setDoc(doc(db, "system_settings", "coverage_area"), {
        savedCoverages: updatedCoverages,
        geometries: coverageAreas,
        updatedAt: new Date().toISOString(),
      });
      setSavedCoverages(updatedCoverages);
      setSelectedCoverage(coverageName);
      setIsEditing(false);
      setIsCreating(false);
      setUnsavedChanges(false);
      setSuccessMessage("Coverage area saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      setError(null);
      await logAdminAction({
        adminId: "current_admin_id",
        adminName: "Current Admin",
        actionType: "UPDATE_COVERAGE_AREA",
        details: `Updated coverage area "${coverageName}" (${coverageAreas.length} geometries)`,
        targetCollection: "system_settings",
        targetId: "coverage_area",
      });
    } catch (err) {
      console.error("Error saving coverage areas:", err);
      setError("Failed to save coverage areas. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Modified handleLoadCoverage for pending selection
  const handleLoadCoverage = (coverageName) => {
    if ((isEditing || isCreating) && unsavedChanges) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to load another coverage area? Unsaved changes will be lost."
        )
      ) {
        return;
      }
      setIsEditing(false);
      setIsCreating(false);
      setUnsavedChanges(false);
    }
    removeAllOverlays();
    const coverage = savedCoverages.find((c) => c.name === coverageName);
    if (coverage) {
      setPrevCoverageSnapshot({
        name: selectedCoverage,
        geometries: coverageAreas,
        history: [...history],
        historyIndex,
      });
      setPendingCoverage(coverage.geometries);
      setPendingCoverageName(coverageName);
      setShowPendingSave(true);
    }
  };

  // Save pending coverage as active
  const handleSavePendingCoverage = async () => {
    if (!pendingCoverageName) return;
    try {
      setIsSaving(true);
      await setDoc(doc(db, "system_settings", "coverage_area"), {
        savedCoverages: savedCoverages,
        geometries: pendingCoverage,
        updatedAt: new Date().toISOString(),
      });
      setCoverageAreas(pendingCoverage);
      setSelectedCoverage(pendingCoverageName);
      setCoverageName(pendingCoverageName);
      setHistory([pendingCoverage]);
      setHistoryIndex(0);
      setShowPendingSave(false);
      setPendingCoverage(null);
      setPendingCoverageName(null);
      setPrevCoverageSnapshot(null);
      setSuccessMessage("Coverage area changed successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError("Failed to change coverage area. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel pending coverage change
  const handleCancelPendingCoverage = () => {
    if (prevCoverageSnapshot) {
      setCoverageAreas(prevCoverageSnapshot.geometries);
      setSelectedCoverage(prevCoverageSnapshot.name);
      setCoverageName(prevCoverageSnapshot.name);
      setHistory(prevCoverageSnapshot.history);
      setHistoryIndex(prevCoverageSnapshot.historyIndex);
    }
    setShowPendingSave(false);
    setPendingCoverage(null);
    setPendingCoverageName(null);
    setPrevCoverageSnapshot(null);
  };

  const toggleDrawingMode = () => {
    setDrawingMode(drawingMode === "circle" ? "polygon" : "circle");
    setSelectedIndex(null);
  };

  // Edit and New Coverage logic
  const handleEditCoverage = () => {
    if (selectedCoverage) {
      setIsEditing(true);
      setIsCreating(false);
      setUnsavedChanges(false);
    }
  };
  const handleNewCoverage = () => {
    setPrevCoverage({
      name: coverageName,
      geometries: coverageAreas,
      selected: selectedCoverage,
      history: [...history],
      historyIndex,
    });
    setCoverageAreas([]);
    setCoverageName("");
    setSelectedCoverage(null);
    setIsEditing(false);
    setIsCreating(true);
    setUnsavedChanges(false);
    setHistory([[]]);
    setHistoryIndex(0);
    removeAllOverlays();
  };
  const handleCancelNew = () => {
    if (prevCoverage) {
      setCoverageAreas(prevCoverage.geometries);
      setCoverageName(prevCoverage.name);
      setSelectedCoverage(prevCoverage.selected);
      setHistory(prevCoverage.history);
      setHistoryIndex(prevCoverage.historyIndex);
    }
    setIsCreating(false);
    setUnsavedChanges(false);
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

          {/* Warning for pending coverage change */}
          {showPendingSave && (
            <div
              className="warning-message"
              style={{
                marginBottom: "1rem",
                color: "#b85c00",
                background: "#fffbe6",
                padding: "1rem",
                borderRadius: "6px",
                border: "1px solid #ffe58f",
              }}
            >
              <b>Warning:</b> Changing the coverage area will immediately affect
              allowed login locations. Are you sure you want to proceed?
            </div>
          )}

          <div
            className="coverage-controls"
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            {!isCreating && (
              <>
                <span>
                  Current coverage area:{" "}
                  <b>{selectedCoverage || "No coverage area selected"}</b>
                </span>
                <button
                  className="action-btn"
                  onClick={() => setShowCoverageDropdown((v) => !v)}
                  disabled={isEditing || isCreating}
                >
                  Change Coverage Area
                </button>
                {showCoverageDropdown && (
                  <div className="coverage-select">
                    <select
                      value={selectedCoverage || ""}
                      onChange={(e) => {
                        handleLoadCoverage(e.target.value);
                        setShowCoverageDropdown(false);
                      }}
                      className="coverage-select-dropdown"
                      disabled={isEditing || isCreating}
                    >
                      <option value="">Select a coverage area</option>
                      {savedCoverages.map((coverage) => (
                        <option key={coverage.name} value={coverage.name}>
                          {coverage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  className="action-btn"
                  onClick={handleEditCoverage}
                  disabled={!selectedCoverage || isEditing || isCreating}
                >
                  Edit
                </button>
                <button
                  className="action-btn"
                  onClick={handleNewCoverage}
                  disabled={isEditing || isCreating}
                >
                  New Coverage
                </button>
              </>
            )}
            {(isEditing || isCreating) && (
              <>
                <div className="coverage-name-input">
                  <input
                    type="text"
                    value={coverageName}
                    onChange={(e) => setCoverageName(e.target.value)}
                    placeholder="Enter coverage area name"
                    className="coverage-name-field"
                    disabled={!(isEditing || isCreating)}
                  />
                </div>
                <button
                  className="action-btn save"
                  onClick={handleSave}
                  disabled={isSaving || coverageAreas.length === 0}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="action-btn"
                  onClick={
                    isCreating ? handleCancelNew : () => setIsEditing(false)
                  }
                >
                  Cancel
                </button>
              </>
            )}
            {showPendingSave && (
              <>
                <button
                  className="action-btn save"
                  onClick={handleSavePendingCoverage}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="action-btn"
                  onClick={handleCancelPendingCoverage}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {(isEditing || isCreating) && (
            <div className="map-controls">
              <button
                className={`draw-mode-btn ${
                  drawingMode === "circle" ? "active" : ""
                }`}
                onClick={toggleDrawingMode}
                disabled={!(isEditing || isCreating)}
              >
                {drawingMode === "circle"
                  ? "Switch to Polygon"
                  : "Switch to Circle"}
              </button>
              <button
                className="action-btn"
                onClick={handleUndo}
                disabled={historyIndex <= 0 || !(isEditing || isCreating)}
              >
                Undo
              </button>
              <button
                className="action-btn"
                onClick={handleRedo}
                disabled={
                  historyIndex >= history.length - 1 ||
                  !(isEditing || isCreating)
                }
              >
                Redo
              </button>
              <button
                className="action-btn"
                onClick={handleClear}
                disabled={
                  coverageAreas.length === 0 || !(isEditing || isCreating)
                }
              >
                Clear
              </button>
            </div>
          )}

          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}
          {error && <div className="error-message">{error}</div>}

          <div className="map-container">
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              {/* DrawingManager and editing only if not previewing pending */}
              {!showPendingSave && (
                <DrawingManager
                  drawingMode={
                    isEditing || isCreating
                      ? drawingMode === "circle"
                        ? "circle"
                        : "polygon"
                      : null
                  }
                  options={{
                    drawingControl: false,
                    circleOptions: {
                      fillColor: "#009C8C",
                      fillOpacity: 0.3,
                      strokeColor: "#009C8C",
                      strokeWeight: 2,
                      clickable: isEditing || isCreating,
                      editable: false,
                      zIndex: 1,
                    },
                    polygonOptions: {
                      fillColor: "#009C8C",
                      fillOpacity: 0.3,
                      strokeColor: "#009C8C",
                      strokeWeight: 2,
                      clickable: isEditing || isCreating,
                      editable: false,
                      zIndex: 1,
                    },
                  }}
                  onCircleComplete={
                    isEditing || isCreating ? handleDrawingComplete : undefined
                  }
                  onPolygonComplete={
                    isEditing || isCreating ? handleDrawingComplete : undefined
                  }
                />
              )}

              {(showPendingSave ? pendingCoverage : coverageAreas).map(
                (area, index) =>
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
                        editable:
                          (isEditing || isCreating) &&
                          selectedIndex === index &&
                          !showPendingSave,
                        clickable: isEditing || isCreating,
                      }}
                      onClick={
                        isEditing || isCreating
                          ? () => handleShapeClick(index)
                          : undefined
                      }
                      onDragEnd={
                        isEditing || isCreating
                          ? (e) => {
                              if (selectedIndex === index) {
                                handleEditComplete("circle", e.overlay, index);
                              }
                            }
                          : undefined
                      }
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
                        editable:
                          (isEditing || isCreating) &&
                          selectedIndex === index &&
                          !showPendingSave,
                        clickable: isEditing || isCreating,
                      }}
                      onClick={
                        isEditing || isCreating
                          ? () => handleShapeClick(index)
                          : undefined
                      }
                      onMouseUp={
                        isEditing || isCreating
                          ? (e) => {
                              if (selectedIndex === index) {
                                handleEditComplete("polygon", e.overlay, index);
                              }
                            }
                          : undefined
                      }
                    />
                  )
              )}
            </GoogleMap>
          </div>

          <div className="instructions">
            <h3>How to use:</h3>
            <ol>
              <li>
                Select a coverage area from the dropdown and click <b>Edit</b>{" "}
                to modify it, or click <b>New Coverage</b> to create a new one.
              </li>
              <li>
                When editing or creating, you can draw shapes on the map and
                enter a name.
              </li>
              <li>
                Click <b>Save</b> to save your changes.
              </li>
              <li>
                Use <b>Clear</b> to remove all shapes from the current coverage
                area you are editing/creating.
              </li>
              <li>
                Switch between Circle and Polygon drawing modes as needed.
              </li>
              <li>Undo/Redo are available while editing or creating.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoverageArea;
