import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MobileDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await axios.get(`${API}/mobile/dashboard`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <h1 className="text-2xl font-bold mb-1">Classroom Vision</h1>
        <p className="text-sm opacity-90">Real-time monitoring</p>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card p-4 rounded-lg shadow-md">
          <p className="text-xs text-muted-foreground mb-1">Total Analyses</p>
          <p className="text-3xl font-bold">{stats.total_analyses || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-md">
          <p className="text-xs text-muted-foreground mb-1">Avg Cleanliness</p>
          <p className="text-3xl font-bold">{stats.avg_cleanliness || 0}%</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-md">
          <p className="text-xs text-muted-foreground mb-1">Active Alerts</p>
          <p className="text-3xl font-bold text-red-500">{stats.active_alerts || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-md">
          <p className="text-xs text-muted-foreground mb-1">Need Attention</p>
          <p className="text-3xl font-bold text-amber-500">{stats.needs_attention || 0}</p>
        </div>
      </div>

      {/* Recent Alerts */}
      {data?.recent_alerts && data.recent_alerts.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-bold mb-3">Active Alerts</h2>
          <div className="space-y-3">
            {data.recent_alerts.map((alert, index) => (
              <div key={index} className="bg-card p-4 rounded-lg border-l-4 border-l-red-500 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold">{alert.room_name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${
                    alert.severity === 'high' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalies */}
      {data?.recent_anomalies && data.recent_anomalies.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-bold mb-3">Recent Anomalies</h2>
          <div className="space-y-3">
            {data.recent_anomalies.map((anomaly, index) => (
              <div key={index} className="bg-card p-4 rounded-lg border-l-4 border-l-amber-500 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold">{anomaly.room_name}</h3>
                  <span className="text-xs text-muted-foreground capitalize">{anomaly.alert_type}</span>
                </div>
                <p className="text-sm text-muted-foreground">{anomaly.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/mobile/rooms" className="bg-primary text-primary-foreground p-4 rounded-lg text-center shadow-md">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-medium">View Rooms</span>
          </Link>
          <Link to="/analyze" className="bg-secondary text-secondary-foreground p-4 rounded-lg text-center shadow-md">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Analyze</span>
          </Link>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Link to="/mobile" className="flex flex-col items-center p-2 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link to="/mobile/rooms" className="flex flex-col items-center p-2 text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs mt-1">Rooms</span>
          </Link>
          <Link to="/alerts" className="flex flex-col items-center p-2 text-muted-foreground relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {stats.active_alerts > 0 && (
              <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {stats.active_alerts}
              </span>
            )}
            <span className="text-xs mt-1">Alerts</span>
          </Link>
          <Link to="/" className="flex flex-col items-center p-2 text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-xs mt-1">More</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export const MobileRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await axios.get(`${API}/mobile/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 pb-8 flex items-center gap-4">
        <Link to="/mobile" className="text-primary-foreground">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Classroom Status</h1>
          <p className="text-sm opacity-90">{rooms.length} rooms monitored</p>
        </div>
      </div>

      {/* Rooms List */}
      <div className="px-4 -mt-4">
        {rooms.map((room, index) => {
          const statusColors = {
            good: 'border-l-green-500 bg-green-50',
            warning: 'border-l-amber-500 bg-amber-50',
            critical: 'border-l-red-500 bg-red-50'
          };

          return (
            <div key={index} className={`bg-card p-4 rounded-lg border-l-4 shadow-sm mb-4 ${statusColors[room.status]}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold">{room.room_name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${
                  room.status === 'good' ? 'bg-green-200 text-green-800' :
                  room.status === 'warning' ? 'bg-amber-200 text-amber-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {room.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cleanliness</p>
                  <p className="text-xl font-mono-data font-bold">{room.cleanliness}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Occupancy</p>
                  <p className="text-xl font-mono-data font-bold">{room.occupancy}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lighting</p>
                  <p className="text-sm font-bold">{room.lighting}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Last checked: {new Date(room.last_checked).toLocaleTimeString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
