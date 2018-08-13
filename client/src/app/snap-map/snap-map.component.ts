import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { FarmersMarket } from '../../../../server/src/dataProviders/farmers-market';

import * as L from 'leaflet';
import * as esri from 'esri-leaflet';
import { throttle } from 'lodash';

type RetailerProperties = {
  ADDRESS: string;
  ADDRESS2: string;
  CITY: string;
  County: string;
  OBJECTID: number;
  STATE: string;
  STORE_NAME: string;
  ZIP5: number;
  latitude: number;
  longitude: number;
  zip4: string;
};

const markerOptions: L.MarkerOptions = {
  icon: L.icon({
    iconSize: [25, 41],
    iconAnchor: [12, 10],
    iconUrl: 'assets/marker-icon.png',
    shadowUrl: 'assets/marker-shadow.png'
  })
};

@Component({
  selector: 'app-snap-map',
  templateUrl: './snap-map.component.html',
  styleUrls: ['./snap-map.component.scss']
})
export class SnapMapComponent {
  options: L.MapOptions = {
    layers: [
      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '...' })
    ],
    zoom: 14,
    center: L.latLng(38.957189, -77.352262)
  };

  retailerMarkers: L.LayerGroup;
  marketsMarkers: L.LayerGroup;

  constructor(private http: HttpClient) { }

  onMapReady(map: L.Map) {
    // Layer to keep track of markers for easy removal
    this.retailerMarkers = L.layerGroup().addTo(map);
    this.marketsMarkers = L.layerGroup().addTo(map);

    // Attempt to user the browsers geolocation to set the map location
    if (navigator && navigator.geolocation && navigator.geolocation.getCurrentPosition) {
      navigator.geolocation.getCurrentPosition(position => {
        map.setView({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }, 15);
      });
    }

    // Update pins when the map view changes
    const boundUpdatePins = this.updatePins.bind(this, map);
    const throttledUpdatePins = throttle(boundUpdatePins, 1000, { leading: false });
    map.on('move', throttledUpdatePins);
  }

  async updatePins(map: L.Map) {
    const bounds = map.getBounds();

    esri.query({
      url: 'http://localhost:3000/ArcGIS/rest/services/retailer/MapServer/0'
    }).within(bounds).run((_, geoJson: GeoJSON.FeatureCollection<GeoJSON.Point, RetailerProperties>) => {
      this.retailerMarkers.clearLayers();
      for (const feature of geoJson.features) {
        const coordinates: [number, number] = [feature.properties.latitude, feature.properties.longitude];
        const marker = L.marker(coordinates, markerOptions)
          .addTo(this.retailerMarkers)
          .bindPopup(`
            <strong>${feature.properties.STORE_NAME}</strong><br />
            <br />
            <strong>Address</strong><br />
            ${feature.properties.ADDRESS}<br />
            ${feature.properties.ADDRESS2 ? (feature.properties.ADDRESS2 + '<br />') : ''}
            ${feature.properties.CITY}, ${feature.properties.STATE} ${feature.properties.ZIP5}
          `);
      }
      console.log(geoJson);
    });

    const farmersMarkets = await this.http.get<FarmersMarket[]>(`http://localhost:3000/farmersmarkets?north=${bounds.getNorth()}&south=${bounds.getSouth()}&west=${bounds.getWest()}&east=${bounds.getEast()}`).toPromise();
    console.log(farmersMarkets);
    this.marketsMarkers.clearLayers();
    for (const market of farmersMarkets) {
      const coordinates: [number, number] = [market.y, market.x];
      const marker = L.marker(coordinates, markerOptions)
          .addTo(this.marketsMarkers)
          .bindPopup(`
            <strong>${market.MarketName}</strong><br />
            <br />
            <strong>Address</strong><br />
            ${market.street}<br />
            ${market.city}, ${market.State} ${market.zip}
          `);
    }
  }
}
