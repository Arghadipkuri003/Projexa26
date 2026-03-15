import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const IntelligencePage = () => {
  const [predictive, setPredictive] = useState([]);
  const [mlPredictions, setMlPredictions] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [predictiveRes, mlRes, anomaliesRes] = await Promise.all([
        axios.get(`${API}/predictive-alerts`),
        axios.get(`${API}/ml-predictions`),
        axios.get(`${API}/anomaly-alerts`)
      ]);
      setPredictive(predictiveRes.data);
      setMlPredictions(mlRes.data);
      setAnomalies(anomaliesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async () => {
    setGenerating(true);
    try {
      await Promise.all([
        axios.post(`${API}/predictive-alerts/generate`),
        axios.post(`${API}/ml-predictions/generate`)
      ]);
      toast.success('Predictions generated successfully');
      loadData();
    } catch (error) {
      console.error('Error generating predictions:', error);
      toast.error('Failed to generate predictions');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading AI intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="intelligence-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            AI Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">Predictive maintenance & anomaly detection</p>
        </div>

        <button
          onClick={generatePredictions}
          disabled={generating}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 font-medium shadow-sm"
        >
          {generating ? 'Generating...' : 'Generate Predictions'}
        </button>
      </div>

      <div className="grid gap-8">
        {/* Predictive Maintenance */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Predictive Maintenance Alerts
            </h2>
          </div>

          {predictive.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No predicted maintenance needs</p>
              <p className="text-sm mt-2">System is analyzing historical data for predictions</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {predictive.map((alert) => (
                <div
                  key={alert.id}
                  className="p-6 bg-background rounded-md border border-border border-l-4 border-l-amber-500"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {alert.room_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Predicted maintenance needed: <span className="font-bold">{alert.predicted_date}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="text-2xl font-mono-data font-bold text-primary">
                        {(alert.prediction_confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-card rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Current Cleanliness</p>
                      <p className="text-2xl font-mono-data font-bold">{alert.current_cleanliness.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-card rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Generated</p>
                      <p className="text-sm">{new Date(alert.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-xs uppercase tracking-widest text-blue-800 dark:text-blue-200 font-bold mb-2">
                      AI Recommendation
                    </p>
                    <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                      {alert.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ML Predictions */}
        {mlPredictions.length > 0 && (
          <div className="bg-card p-6 rounded-md border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Machine Learning Predictions
              </h2>
            </div>

            <div className="grid gap-4">
              {mlPredictions.map((pred) => (
                <div
                  key={pred.id}
                  className="p-4 bg-background rounded-md border border-border border-l-4 border-l-purple-500"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold">{pred.room_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Model: {pred.model_type.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="text-xl font-mono-data font-bold text-purple-600">
                        {(pred.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-card rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Predicted {pred.prediction_type}</p>
                      <p className="text-2xl font-mono-data font-bold">{pred.predicted_value.toFixed(1)}{pred.prediction_type === 'cleanliness' ? '%' : ''}</p>
                    </div>
                    <div className="p-3 bg-card rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Date</p>
                      <p className="text-sm font-bold">{pred.prediction_date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomaly Detection */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Anomaly Alerts
            </h2>
          </div>

          {anomalies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No anomalies detected</p>
              <p className="text-sm mt-2">All classrooms operating within normal parameters</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {anomalies.map((alert) => {
                const severityColors = {
                  high: 'border-l-red-500 bg-red-50 dark:bg-red-950',
                  medium: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950',
                  low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950'
                };

                return (
                  <div
                    key={alert.id}
                    className={`p-6 rounded-md border border-border border-l-4 ${severityColors[alert.severity]}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {alert.room_name}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${
                            alert.severity === 'high' ? 'bg-red-200 text-red-800' :
                            alert.severity === 'medium' ? 'bg-amber-200 text-amber-800' :
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {alert.anomaly_type} Anomaly
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Expected</p>
                        <p className="text-xl font-mono-data font-bold">{alert.expected_value}</p>
                      </div>
                      <div className="p-3 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Actual</p>
                        <p className="text-xl font-mono-data font-bold text-red-600">{alert.actual_value}</p>
                      </div>
                      <div className="p-3 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Deviation</p>
                        <p className="text-xl font-mono-data font-bold text-red-600">{alert.deviation_percentage}%</p>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed">{alert.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-md">
        <h4 className="font-bold text-blue-800 mb-2">How AI Intelligence Works</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li><strong>Predictive Maintenance:</strong> Analyzes historical cleanliness trends to predict when rooms will need attention</li>
          <li><strong>Anomaly Detection:</strong> Uses statistical analysis to identify unusual patterns (>2 standard deviations from normal)</li>
          <li><strong>AI Recommendations:</strong> GPT-4o provides context-aware maintenance suggestions</li>
          <li><strong>Automatic Alerts:</strong> Email notifications sent when anomalies or predictions are detected</li>
        </ul>
      </div>
    </div>
  );
};
