// Import new pages
import { LiveFeedPage } from './pages/LiveFeedPage';
import { TrendsPage } from './pages/TrendsPage';

// Add to navigation items in DashboardLayout:
const newNavItems = [
  { path: '/live', label: 'Live Feed', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { path: '/trends', label: 'Trends', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' }
];

// Add new routes in App:
<Route path="/live" element={<LiveFeedPage />} />
<Route path="/trends" element={<TrendsPage />} />

// Enhanced Settings with report scheduling:
const [formData, setFormData] = useState({
  cleanliness_threshold: 60,
  alert_emails: '',
  monitoring_enabled: false,
  report_schedule: 'disabled',
  report_time: '09:00'
});

// Add in Settings form:
<div>
  <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Scheduled Reports</h3>
  
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-2">Report Schedule</label>
      <select
        value={formData.report_schedule}
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
          value={formData.report_time}
          onChange={(e) => setFormData({...formData, report_time: e.target.value})}
          className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    )}
  </div>
</div>
