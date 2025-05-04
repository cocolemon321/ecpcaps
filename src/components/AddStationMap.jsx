import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/AddStationMap.css";

mapboxgl.accessToken =
  "pk.eyJ1IjoiY29jb2xlbW9uMTIiLCJhIjoiY204YTBoMnZpMHplbzJzcTR3dDFmOXc4NiJ9.NqqEHSBe8cn9Gy9knbUqew";

const AddStationMap = ({ onSelectLocation, isSelectingLocation }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [120.9882053036898, 14.693467677226026],
      zoom: 12,
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e) => {
      if (!isSelectingLocation) return;

      if (marker.current) {
        marker.current.remove();
      }

      marker.current = new mapboxgl.Marker({
        draggable: true,
        color: "#FF0000",
        scale: 0.8, // Make the marker slightly smaller
      })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(map.current);

      marker.current.on("dragend", () => {
        const lngLat = marker.current.getLngLat();
        onSelectLocation([lngLat.lat, lngLat.lng]);
      });

      onSelectLocation([e.lngLat.lat, e.lngLat.lng]);
    };

    if (isSelectingLocation) {
      map.current.getCanvas().style.cursor = "crosshair";
      map.current.on("click", handleClick);
    } else {
      map.current.getCanvas().style.cursor = "";
      map.current.off("click", handleClick);
    }

    return () => {
      if (map.current) {
        map.current.off("click", handleClick);
        map.current.getCanvas().style.cursor = "";
      }
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
    };
  }, [isSelectingLocation, onSelectLocation]);

  return <div ref={mapContainer} className="add-station-map" />;
};

export default AddStationMap;
