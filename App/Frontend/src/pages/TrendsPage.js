import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import predictionService from '../services/predictionService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TrendsPage = () => {
  const [trendData, setTrendData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    loadTrends();
  }, [days]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/trends?days=${days}`);
      setTrendData(response.data);
    } catch (error) {
      console.error('Error loading trends:', error);
      toast.error('Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async () => {
    if (trendData.length < 10) {
      toast.error('Need at least 10 data points for predictions');
      return;
    }

    setPredicting(true);
    try {
      // Prepare training data
      const trainingData = trendData.map((d, i) => ({
        timestamp: i,
        cleanliness: d.avg_cleanliness,
        occupancy: d.avg_occupancy
      }));

      // Train model
      const trained = await predictionService.trainModel(trainingData);
      
      if (trained) {
        // Get predictions
        const preds = await predictionService.predict(7);
        setPredictions(preds);
        toast.success('AI predictions generated using TensorFlow.js');
      } else {
        toast.error('Failed to train prediction model');
      }
    } catch (error) {
      console.error('Error generating predictions:', error);
      toast.error('Prediction generation failed');
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="trends-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Trends & Analytics
          </h1>
          <p className="text-muted-foreground mt-2">Historical data visualization and insights</p>
        </div>

        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          
          <button
            onClick={generatePredictions}
            disabled={predicting || trendData.length < 10}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 text-sm font-medium shadow-sm"
          >
            {predicting ? 'Predicting...' : 'AI Predict (TF.js)'}
          </button>
        </div>
      </div>

      {trendData.length === 0 ? (
        <div className="bg-card p-12 rounded-md border border-border shadow-sm text-center text-muted-foreground">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No trend data available for the selected period</p>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Occupancy Trend */}
          <div className="bg-card p-6 rounded-md border border-border shadow-sm">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Occupancy Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avg_occupancy" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Average Occupancy"
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cleanliness Trend */}
          <div className="bg-card p-6 rounded-md border border-border shadow-sm">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Cleanliness Score Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCleanliness" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="avg_cleanliness" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCleanliness)"
                  name="Average Cleanliness (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Analysis Count */}
          <div className="bg-card p-6 rounded-md border border-border shadow-sm">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Daily Analysis Volume
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#6B7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="total_analyses" 
                  fill="#6366F1" 
                  name="Total Analyses"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="bg-card p-6 rounded-md border border-border shadow-sm">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Detailed Data
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Date</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Avg Occupancy</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Avg Cleanliness</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Total Analyses</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((item, index) => (
                    <tr key={index} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="py-4 font-medium">{item.date}</td>
                      <td className="py-4 font-mono-data">{item.avg_occupancy}</td>
                      <td className="py-4">
                        <span className={`font-mono-data font-bold ${
                          item.avg_cleanliness >= 80 ? 'text-green-600' : 
                          item.avg_cleanliness >= 60 ? 'text-amber-600' : 
                          'text-red-600'
                        }`}>
                          {item.avg_cleanliness}%
                        </span>
                      </td>
                      <td className="py-4 font-mono-data">{item.total_analyses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
