import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { LiveFeedPage } from './pages/LiveFeedPage';
import { TrendsPage } from './pages/TrendsPage';
import { AttendancePage } from './pages/AttendancePage';
import { IntelligencePage } from './pages/IntelligencePage';
import { MobileDashboard, MobileRooms } from './pages/MobilePages';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import wsService from './services/websocketService';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Layout Component
const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  
  useEffect(() => {
    loadAlertCount();
    const interval = setInterval(loadAlertCount, 30000);
    
    // Connect WebSocket
    wsService.connect(BACKEND_URL);
    
    // Listen for WebSocket events
    wsService.on('connected', () => {
      setWsConnected(true);
      toast.success('Real-time updates connected');
    });
    
    wsService.on('disconnected', () => {
      setWsConnected(false);
    });
    
    wsService.on('new_analysis', (data) => {
      toast.info(`New analysis: ${data.room_name} - ${data.cleanliness_score}%`);
      loadAlertCount();
    });
    
    wsService.on('anomaly', (data) => {
      toast.error(`Anomaly detected in ${data.room_name}: ${data.message}`, {
        duration: 10000
      });
      loadAlertCount();
    });
    
    return () => {
      clearInterval(interval);
      wsService.disconnect();
    };
  }, []);
  
  const loadAlertCount = async () => {
    try {
      const response = await axios.get(`${API}/alerts?resolved=false`);
      setAlertCount(response.data.length);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/analyze', label: 'Analyze', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/live', label: 'Live Feed', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { path: '/attendance', label: 'Attendance', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { path: '/trends', label: 'Trends', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { path: '/intelligence', label: 'AI Intelligence', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { path: '/history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/alerts', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', badge: alertCount > 0 },
    { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ...(isAdmin() ? [{ path: '/users', label: 'User Management', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', adminOnly: true }] : [])
  ];
  
  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-r border-border relative">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Classroom Vision
            </h1>
            {wsConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Real-time connected" />
            )}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Monitoring System</p>
        </div>
        
        <nav className="px-4 space-y-2 pb-20">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 relative ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="font-medium">{item.label}</span>
              {item.badge && alertCount > 0 && (
                <span className="absolute right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono-data">
                  {alertCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        
        {/* User Info & Theme Toggle */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {/* User Info */}
          <div className="p-3 bg-accent/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
            data-testid="theme-toggle"
          >
            {theme === 'light' ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className="font-medium">Dark Mode</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-medium">Light Mode</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-red-500/10 text-red-500 transition-colors duration-200"
            data-testid="logout-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ type, value }) => {
  const getColor = () => {
    if (type === 'cleanliness') {
      if (value >= 80) return 'bg-green-500';
      if (value >= 60) return 'bg-amber-500';
      return 'bg-red-500';
    }
    if (type === 'lighting') {
      const colors = {
        'Excellent': 'bg-green-500',
        'Good': 'bg-green-500',
        'Fair': 'bg-amber-500',
        'Poor': 'bg-red-500'
      };
      return colors[value] || 'bg-gray-500';
    }
    return 'bg-blue-500';
  };
  
  return <div className={`h-2 w-2 rounded-full ${getColor()}`} />;
};

// Viewfinder Image Component
const ViewfinderImage = ({ src, alt, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <img src={src} alt={alt} className="w-full h-full object-cover rounded-sm" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
        <path d="M 5 15 L 5 5 L 15 5" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-white" />
        <path d="M 85 5 L 95 5 L 95 15" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-white" />
        <path d="M 15 95 L 5 95 L 5 85" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-white" />
        <path d="M 95 85 L 95 95 L 85 95" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-white" />
      </svg>
    </div>
  );
};

// Dashboard Page
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      const [statsRes, analysesRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/analyses?limit=5`)
      ]);
      setStats(statsRes.data);
      setRecentAnalyses(analysesRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExport = async (format) => {
    try {
      const response = await axios.get(`${API}/export/${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `classroom_report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Overview Dashboard</h1>
          <p className="text-muted-foreground mt-2">Real-time classroom monitoring and analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            data-testid="export-csv-button"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors duration-200 text-sm font-medium"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            data-testid="export-pdf-button"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 text-sm font-medium shadow-sm"
          >
            Export PDF
          </button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Total Analyses</p>
              <p className="text-3xl font-mono-data font-bold mt-2">{stats?.total_analyses || 0}</p>
            </div>
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Avg Occupancy</p>
              <p className="text-3xl font-mono-data font-bold mt-2">{stats?.avg_occupancy || 0}</p>
            </div>
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Avg Cleanliness</p>
              <p className="text-3xl font-mono-data font-bold mt-2">{stats?.avg_cleanliness || 0}%</p>
            </div>
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-md border border-border shadow-sm border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Need Maintenance</p>
              <p className="text-3xl font-mono-data font-bold mt-2">{stats?.rooms_need_maintenance || 0}</p>
            </div>
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-md border border-border shadow-sm border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Active Alerts</p>
              <p className="text-3xl font-mono-data font-bold mt-2">{stats?.active_alerts || 0}</p>
            </div>
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Recent Analyses */}
      <div className="bg-card p-6 rounded-md border border-border shadow-sm">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Recent Analyses</h2>
        
        {recentAnalyses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>No analyses yet. Start by analyzing a classroom image.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Room</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Occupancy</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Cleanliness</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Lighting</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((analysis) => (
                  <tr key={analysis.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="py-4 font-medium">{analysis.room_name}</td>
                    <td className="py-4 font-mono-data">{analysis.occupancy_count}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge type="cleanliness" value={analysis.cleanliness_score} />
                        <span className="font-mono-data">{analysis.cleanliness_score}%</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge type="lighting" value={analysis.lighting_condition} />
                        <span>{analysis.lighting_condition}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {new Date(analysis.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Analyze Page
const AnalyzePage = () => {
  const [roomName, setRoomName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    const newPreviews = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push({ file, preview: reader.result });
        if (newPreviews.length === files.length) {
          setPreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  
  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 || (!batchMode && !roomName)) {
      toast.error('Please select an image and enter a room name');
      return;
    }
    
    setAnalyzing(true);
    setResults(null);
    
    try {
      if (batchMode) {
        const analyses = await Promise.all(
          previews.map(async ({ file, preview }, index) => {
            const base64String = preview.split(',')[1];
            return {
              room_name: `Room ${index + 1}`,
              image_base64: base64String
            };
          })
        );
        
        const response = await axios.post(`${API}/analyze/batch`, { analyses });
        setResults(response.data);
        toast.success(`Batch analysis completed: ${response.data.successful}/${response.data.total} successful`);
      } else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result.split(',')[1];
          
          const response = await axios.post(`${API}/analyze`, {
            room_name: roomName,
            image_base64: base64String
          });
          
          setResults({ single: response.data });
          toast.success('Analysis completed successfully!');
        };
        reader.readAsDataURL(selectedFiles[0]);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };
  
  return (
    <div className="p-8" data-testid="analyze-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Analyze Classroom</h1>
        <p className="text-muted-foreground mt-2">Upload image(s) for AI-powered analysis</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Upload Image</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Batch Analysis Mode</span>
              </label>
            </div>
            
            {!batchMode && (
              <div>
                <label className="block text-sm font-medium mb-2">Room Name</label>
                <input
                  type="text"
                  data-testid="room-name-input"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Room 301"
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Classroom Image{batchMode ? 's' : ''}
              </label>
              <input
                type="file"
                data-testid="image-upload-input"
                accept="image/jpeg,image/png,image/webp"
                multiple={batchMode}
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            
            {previews.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Preview ({previews.length} image{previews.length > 1 ? 's' : ''}):</p>
                <div className="grid grid-cols-2 gap-2">
                  {previews.slice(0, 4).map((item, index) => (
                    <ViewfinderImage key={index} src={item.preview} alt={`Preview ${index + 1}`} className="w-full h-32" />
                  ))}
                </div>
                {previews.length > 4 && <p className="text-sm text-muted-foreground mt-2">+{previews.length - 4} more</p>}
              </div>
            )}
            
            <button
              data-testid="analyze-button"
              onClick={handleAnalyze}
              disabled={analyzing || selectedFiles.length === 0 || (!batchMode && !roomName)}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
            >
              {analyzing ? 'Analyzing...' : batchMode ? 'Analyze Batch' : 'Analyze Image'}
            </button>
          </div>
        </div>
        
        {/* Results Section */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Analysis Results</h2>
          
          {!results && !analyzing && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>Results will appear here</p>
              </div>
            </div>
          )}
          
          {analyzing && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-muted-foreground">Analyzing classroom{batchMode ? 's' : ''}...</p>
              </div>
            </div>
          )}
          
          {results?.single && (
            <div className="space-y-6" data-testid="analysis-results">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Occupancy</p>
                  <p className="text-3xl font-mono-data font-bold" data-testid="result-occupancy">{results.single.occupancy_count}</p>
                </div>
                
                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Cleanliness</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge type="cleanliness" value={results.single.cleanliness_score} />
                    <p className="text-3xl font-mono-data font-bold" data-testid="result-cleanliness">{results.single.cleanliness_score}%</p>
                  </div>
                </div>
                
                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Lighting</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge type="lighting" value={results.single.lighting_condition} />
                    <p className="text-2xl font-bold" data-testid="result-lighting">{results.single.lighting_condition}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-background p-4 rounded-md border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Observations</p>
                <p className="text-sm leading-relaxed" data-testid="result-observations">{results.single.raw_analysis}</p>
              </div>
            </div>
          )}
          
          {results?.results && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-bold">Total: {results.total}</span>
                <span className="text-green-600">✓ Success: {results.successful}</span>
                <span className="text-red-600">✗ Failed: {results.total - results.successful}</span>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-3">
                {results.results.map((result, index) => (
                  <div key={index} className={`p-4 rounded-md border ${result.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    {result.success ? (
                      <div>
                        <p className="font-bold text-sm mb-2">{result.analysis.room_name}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>Occupancy: <span className="font-mono-data font-bold">{result.analysis.occupancy_count}</span></div>
                          <div>Cleanliness: <span className="font-mono-data font-bold">{result.analysis.cleanliness_score}%</span></div>
                          <div>Lighting: <span className="font-bold">{result.analysis.lighting_condition}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-sm text-red-600">{result.room_name} - Failed</p>
                        <p className="text-xs text-red-500">{result.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// History Page (continued in next message due to length)

// History Page
const HistoryPage = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API}/analyses`);
      setAnalyses(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8" data-testid="history-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Analysis History</h1>
        <p className="text-muted-foreground mt-2">View all classroom analyses</p>
      </div>
      
      <div className="bg-card p-6 rounded-md border border-border shadow-sm">
        {analyses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No analysis history available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Room</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Occupancy</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Cleanliness</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Lighting</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Observations</th>
                  <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="py-4 font-medium">{analysis.room_name}</td>
                    <td className="py-4 font-mono-data">{analysis.occupancy_count}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge type="cleanliness" value={analysis.cleanliness_score} />
                        <span className="font-mono-data">{analysis.cleanliness_score}%</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge type="lighting" value={analysis.lighting_condition} />
                        <span>{analysis.lighting_condition}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm max-w-xs truncate">{analysis.raw_analysis}</td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {new Date(analysis.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Alerts Page
const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unresolved');
  
  useEffect(() => {
    loadAlerts();
  }, [filter]);
  
  const loadAlerts = async () => {
    try {
      const resolved = filter === 'all' ? null : filter === 'resolved';
      const url = resolved === null ? `${API}/alerts` : `${API}/alerts?resolved=${resolved}`;
      const response = await axios.get(url);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };
  
  const resolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      loadAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading alerts...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8" data-testid="alerts-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Alerts</h1>
          <p className="text-muted-foreground mt-2">Manage classroom maintenance alerts</p>
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>
      
      {alerts.length === 0 ? (
        <div className="bg-card p-12 rounded-md border border-border shadow-sm text-center text-muted-foreground">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No {filter === 'unresolved' ? 'unresolved ' : ''}alerts</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const severityColors = {
              high: 'border-l-red-500 bg-red-50',
              medium: 'border-l-amber-500 bg-amber-50',
              low: 'border-l-blue-500 bg-blue-50'
            };
            
            return (
              <div
                key={alert.id}
                className={`bg-card p-6 rounded-md border border-border shadow-sm border-l-4 ${severityColors[alert.severity] || ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>{alert.room_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${
                        alert.severity === 'high' ? 'bg-red-200 text-red-800' : 
                        alert.severity === 'medium' ? 'bg-amber-200 text-amber-800' : 
                        'bg-blue-200 text-blue-800'
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.resolved && (
                        <span className="text-xs px-2 py-1 rounded-full font-bold uppercase bg-green-200 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm mb-2">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  {!alert.resolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200 text-sm font-medium"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    cleanliness_threshold: 60,
    alert_emails: '',
    monitoring_enabled: false,
    report_schedule: 'disabled',
    report_time: '09:00'
  });
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
      setFormData(response.data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };
  
  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/settings`, formData);
      toast.success('Settings saved successfully');
      loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Settings</h1>
        <p className="text-muted-foreground mt-2">Configure monitoring and alert preferences</p>
      </div>
      
      <div className="max-w-2xl">
        <div className="bg-card p-6 rounded-md border border-border shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Alert Thresholds</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Cleanliness Threshold (%)
                <span className="text-muted-foreground ml-2 text-xs">Alert when below this value</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.cleanliness_threshold}
                onChange={(e) => setFormData({...formData, cleanliness_threshold: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Email Notifications</h3>
            
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> To enable email alerts, you need to configure your Resend API key. 
                Add your API key to <code className="bg-blue-100 px-1 py-0.5 rounded">/app/backend/.env</code> as <code className="bg-blue-100 px-1 py-0.5 rounded">RESEND_API_KEY=your_key_here</code>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Alert Email Recipients
                <span className="text-muted-foreground ml-2 text-xs">Comma-separated email addresses</span>
              </label>
              <input
                type="text"
                value={formData.alert_emails}
                onChange={(e) => setFormData({...formData, alert_emails: e.target.value})}
                placeholder="admin@example.com, manager@example.com"
                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Monitoring</h3>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.monitoring_enabled}
                onChange={(e) => setFormData({...formData, monitoring_enabled: e.target.checked})}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium">Enable Scheduled Monitoring</span>
                <p className="text-sm text-muted-foreground">Automatically send email alerts for maintenance issues</p>
              </div>
            </label>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Scheduled Reports</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Report Schedule</label>
                <select
                  value={formData.report_schedule || 'disabled'}
                  onChange={(e) => setFormData({...formData, report_schedule: e.target.value})}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="disabled">Disabled</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Mondays)</option>
                </select>
              </div>
              
              {formData.report_schedule !== 'disabled' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Report Time</label>
                  <input
                    type="time"
                    value={formData.report_time || '09:00'}
                    onChange={(e) => setFormData({...formData, report_time: e.target.value})}
                    className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Reports will be sent to configured email recipients
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        
        <div className="mt-6 bg-amber-50 border border-amber-200 p-4 rounded-md">
          <h4 className="font-bold text-amber-800 mb-2">Getting Started with Email Alerts</h4>
          <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
            <li>Sign up for a free account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a></li>
            <li>Create an API key from your Resend dashboard</li>
            <li>Add the API key to your backend .env file</li>
            <li>Restart the backend server</li>
            <li>Configure email recipients above and save</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

// User Management Page (Admin Only)
const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API}/auth/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"?`)) return;
    
    try {
      await axios.delete(`${API}/auth/users/${userId}`);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API}/auth/users/${userId}/role?role=${newRole}`);
      toast.success('Role updated successfully');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="user-management-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          User Management
        </h1>
        <p className="text-muted-foreground mt-2">Manage system users and their permissions</p>
      </div>

      <div className="bg-card p-6 rounded-md border border-border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 text-xs uppercase tracking-widest font-bold">Name</th>
              <th className="pb-3 text-xs uppercase tracking-widest font-bold">Email</th>
              <th className="pb-3 text-xs uppercase tracking-widest font-bold">Role</th>
              <th className="pb-3 text-xs uppercase tracking-widest font-bold">Created</th>
              <th className="pb-3 text-xs uppercase tracking-widest font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                <td className="py-4 font-medium">{user.name}</td>
                <td className="py-4 text-muted-foreground">{user.email}</td>
                <td className="py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="px-2 py-1 border border-input rounded text-sm bg-background"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-4 text-sm text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="py-4">
                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No users found</p>
        )}
      </div>
    </div>
  );
};

// Main App
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              
              {/* Protected Routes */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/analyze" element={<AnalyzePage />} />
                      <Route path="/live" element={<LiveFeedPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route path="/trends" element={<TrendsPage />} />
                      <Route path="/intelligence" element={<IntelligencePage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/mobile" element={<MobileDashboard />} />
                      <Route path="/mobile/rooms" element={<MobileRooms />} />
                      <Route path="/users" element={
                        <ProtectedRoute requireAdmin>
                          <UserManagementPage />
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </DashboardLayout>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
