import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

export const LiveFeedPage = () => {
  const [isActive, setIsActive] = useState(false);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraId, setCameraId] = useState('default');
  const [analysisInterval, setAnalysisInterval] = useState(10); // seconds
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);
        toast.success('Camera started');
        
        // Start periodic analysis
        intervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, analysisInterval * 1000);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsActive(false);
    setResult(null);
    toast.info('Camera stopped');
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;
    
    setAnalyzing(true);
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      const response = await axios.post(`${API}/video/analyze`, {
        frame_base64: base64Image,
        camera_id: cameraId
      });
      
      setResult(response.data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="p-8" data-testid="live-feed-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Live Video Feed
        </h1>
        <p className="text-muted-foreground mt-2">Real-time classroom monitoring with AI analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Video Feed */}
        <div className="lg:col-span-2 bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Camera Feed</h2>
          
          <div className="relative bg-black rounded-md overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p>Camera not active</p>
                </div>
              </div>
            )}
            
            {analyzing && (
              <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                Analyzing...
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Camera ID</label>
                <input
                  type="text"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  disabled={isActive}
                  placeholder="e.g., Room 301 Camera"
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Analysis Interval (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={analysisInterval}
                  onChange={(e) => setAnalysisInterval(parseInt(e.target.value))}
                  disabled={isActive}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-4">
              {!isActive ? (
                <button
                  onClick={startCamera}
                  data-testid="start-camera-button"
                  className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors duration-200 shadow-sm"
                >
                  Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={stopCamera}
                    className="flex-1 bg-destructive text-destructive-foreground px-6 py-3 rounded-md font-medium hover:bg-destructive/90 transition-colors duration-200 shadow-sm"
                  >
                    Stop Camera
                  </button>
                  <button
                    onClick={captureAndAnalyze}
                    disabled={analyzing}
                    className="flex-1 bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/80 transition-colors duration-200 disabled:opacity-50"
                  >
                    Analyze Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Results */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Real-Time Analysis
          </h2>

          {!result ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>Start camera to see live analysis</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Occupancy
                  </p>
                  <p className="text-4xl font-mono-data font-bold">{result.occupancy_count}</p>
                </div>

                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Cleanliness
                  </p>
                  <div className="flex items-center gap-3">
                    <StatusBadge type="cleanliness" value={result.cleanliness_score} />
                    <p className="text-4xl font-mono-data font-bold">{result.cleanliness_score}%</p>
                  </div>
                </div>

                <div className="bg-background p-4 rounded-md border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Lighting
                  </p>
                  <div className="flex items-center gap-3">
                    <StatusBadge type="lighting" value={result.lighting_condition} />
                    <p className="text-2xl font-bold">{result.lighting_condition}</p>
                  </div>
                </div>
              </div>

              <div className="bg-background p-4 rounded-md border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Observations
                </p>
                <p className="text-sm leading-relaxed">{result.raw_analysis}</p>
              </div>

              {result.detected_faces > 0 && (
                <div className="bg-background p-4 rounded-md border border-border border-l-4 border-l-green-500">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Attendance
                  </p>
                  <p className="text-sm mb-2">
                    <span className="font-bold">{result.detected_faces}</span> faces detected
                  </p>
                  {result.identified_students && result.identified_students.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Identified:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.identified_students.map((name, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-md">
        <h4 className="font-bold text-blue-800 mb-2">Live Feed Information</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Periodic analysis runs automatically every {analysisInterval} seconds</li>
          <li>Analysis results are stored in real-time database</li>
          <li>Facial recognition tracks attendance automatically</li>
          <li>Click "Analyze Now" for immediate analysis</li>
          <li>Ensure adequate lighting for best results</li>
        </ul>
      </div>
    </div>
  );
};
