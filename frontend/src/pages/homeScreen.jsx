import React, {useState, useEffect} from 'react';
import Map, { Marker } from "react-map-gl/mapbox";
import { Meta } from 'react-router-dom';
// import * as turf from '@turf/turf';
// import taxiZones from './data/taxi_zones.geojson';


export default function HomeScreen() { 
    function getTaxiZoneFromPoint(lng, lat) {
        const point = turf.point([lng, lat]);
        for (const feature of taxiZones.features) {
          if (turf.booleanPointInPolygon(point, feature)) {
            return feature.properties.location_id;
          }
        }
        return null;
      }
    return (
        <>
            <div className="map">
                <Map
                mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
                initialViewState={{
                    longitude: -73.935242,
                    latitude: 40.730610,
                    zoom: 10,
                }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                style={{ width: "100%", height: "100%" }}
                maxBounds={[
                    [-74.25909, 40.477399], // SW
                    [-73.700181, 40.917576], // NE
                ]}
                onClick={(e) => {
                    const { lng, lat } = e.lngLat;
                    console.log(`Selected location: ${lng}, ${lat}`);
                }}
                >
                {/* Add marker or other layers here */}
                </Map>
            </div>
        </>
    )
}