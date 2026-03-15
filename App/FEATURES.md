# Vision-Based Smart Classroom Monitoring System - Features Documentation

## Overview
A comprehensive AI-powered classroom monitoring platform that analyzes classroom images for occupancy, cleanliness, and lighting conditions. Built with OpenAI Vision GPT-4o, React, FastAPI, and MongoDB.

## Core Features

### 1. Image Analysis
- **AI-Powered Analysis**: Uses OpenAI Vision (GPT-4o) to analyze classroom images
- **Multiple Metrics**:
  - Occupancy count (number of people detected)
  - Cleanliness score (0-100 scale)
  - Lighting condition (Poor/Fair/Good/Excellent)
  - Detailed observations

### 2. Batch Analysis
- **Multi-Room Processing**: Upload and analyze multiple classroom images simultaneously
- **Batch Mode Toggle**: Switch between single and batch analysis modes
- **Bulk Results**: View success/failure status for each analysis in batch
- **Automatic Room Naming**: Auto-generates room names for batch uploads

### 3. Dashboard & Analytics
- **Real-Time Statistics**:
  - Total analyses count
  - Average occupancy across all rooms
  - Average cleanliness score
  - Rooms needing maintenance
  - Active alerts count
- **Recent Analyses Table**: Quick view of latest 5 analyses
- **Color-Coded Indicators**: Visual status badges for cleanliness and lighting

### 4. Alert System
- **Automatic Alert Generation**: Creates alerts when cleanliness falls below threshold
- **Severity Levels**: High (< 40%), Medium (40-60%)
- **Alert Management**:
  - View unresolved/resolved/all alerts
  - Resolve alerts with one click
  - Real-time badge counter in navigation
- **Email Notifications**: Automatic email alerts via Resend (when configured)

### 5. Export Functionality
- **CSV Export**: Download analysis data in CSV format
- **PDF Reports**: Generate formatted PDF reports with tables
- **Bulk Data**: Export up to 1000 analyses at once
- **Timestamped Files**: Automatic filename with current date

### 6. Settings & Configuration
- **Cleanliness Threshold**: Set custom threshold for alert generation (default: 60%)
- **Email Recipients**: Configure comma-separated email list for alerts
- **Scheduled Monitoring**: Enable/disable automated monitoring
- **Persistent Settings**: All preferences saved to database

### 7. History Tracking
- **Complete Archive**: View all past analyses
- **Sortable Table**: Organized by timestamp (newest first)
- **Detailed View**: Full observations and metrics for each analysis
- **Search & Filter**: Easy navigation through historical data

## Technical Implementation

### Backend APIs

#### Analysis Endpoints
- `POST /api/analyze` - Analyze single classroom image
- `POST /api/analyze/batch` - Batch analyze multiple images
- `GET /api/analyses` - Retrieve analysis history (limit: 50)

#### Stats & Reports
- `GET /api/stats` - Dashboard statistics
- `GET /api/export/csv` - Export CSV report
- `GET /api/export/pdf` - Export PDF report

#### Alerts Management
- `GET /api/alerts` - Get alerts (filter by resolved status)
- `POST /api/alerts/{id}/resolve` - Resolve specific alert

#### Settings
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings

### Frontend Pages

1. **Dashboard** (`/`)
   - Overview statistics
   - Recent analyses table
   - Export buttons (CSV/PDF)

2. **Analyze** (`/analyze`)
   - Single/batch mode toggle
   - Image upload with preview
   - Real-time analysis results

3. **History** (`/history`)
   - Complete analysis archive
   - Sortable table view

4. **Alerts** (`/alerts`)
   - Active/resolved alerts
   - Filter dropdown
   - Resolve functionality

5. **Settings** (`/settings`)
   - Threshold configuration
   - Email setup
   - Monitoring toggle

## Setup Instructions

### Environment Variables

#### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=sk-emergent-xxxxx
RESEND_API_KEY=re_xxxxx  # Optional, for email alerts
SENDER_EMAIL=onboarding@resend.dev
CLEANLINESS_THRESHOLD=60
ALERT_EMAIL_RECIPIENTS=admin@example.com,manager@example.com
```

#### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://classroom-monitor-5.preview.emergentagent.com
```

### Email Alerts Setup (Optional)

1. Sign up at [resend.com](https://resend.com)
2. Create API key from dashboard
3. Add `RESEND_API_KEY` to backend .env
4. Configure recipient emails in Settings page
5. Enable scheduled monitoring

**Note**: System works fully without email alerts. Email is only for automated notifications.

## Usage Guide

### Analyzing a Single Classroom

1. Navigate to **Analyze** page
2. Enter room name (e.g., "Room 301")
3. Upload classroom image (JPEG/PNG/WEBP)
4. Click "Analyze Image"
5. View results: occupancy, cleanliness, lighting

### Batch Analysis

1. Navigate to **Analyze** page
2. Enable "Batch Analysis Mode" checkbox
3. Select multiple images (up to 10 recommended)
4. Click "Analyze Batch"
5. View individual results for each room

### Exporting Reports

1. Go to **Dashboard**
2. Click "Export CSV" or "Export PDF"
3. File downloads automatically
4. Filename includes current date

### Managing Alerts

1. Navigate to **Alerts** page
2. View unresolved alerts (default)
3. Use filter to see resolved/all alerts
4. Click "Resolve" button to mark as resolved
5. Badge in sidebar shows active alert count

### Configuring Settings

1. Go to **Settings** page
2. Adjust cleanliness threshold (0-100)
3. Add email recipients (comma-separated)
4. Enable scheduled monitoring if desired
5. Click "Save Settings"

## Design System

### Typography
- **Headings**: Manrope (600-700 weight)
- **Body**: Inter (400-500 weight)
- **Data/Metrics**: JetBrains Mono

### Color Palette
- **Primary**: Vision Blue (#2563EB)
- **Success**: Green (#10B981) - Good/Clean
- **Warning**: Amber (#F59E0B) - Medium/Fair
- **Danger**: Red (#EF4444) - Poor/Dirty
- **Neutral**: Slate (#64748B) - Offline/No Data

### Status Indicators
- **Cleanliness**:
  - 80-100: Green (Clean)
  - 60-79: Amber (Moderate)
  - 0-59: Red (Needs Maintenance)
- **Lighting**:
  - Excellent/Good: Green
  - Fair: Amber
  - Poor: Red

## Database Schema

### classroom_analyses
```
{
  id: string (UUID)
  room_name: string
  occupancy_count: integer
  cleanliness_score: integer (0-100)
  lighting_condition: string (Poor/Fair/Good/Excellent)
  raw_analysis: string
  image_data: string (thumbnail, first 100 chars)
  timestamp: datetime (ISO format)
}
```

### alerts
```
{
  id: string (UUID)
  room_name: string
  alert_type: string (cleanliness/lighting/occupancy)
  severity: string (low/medium/high)
  message: string
  analysis_id: string
  resolved: boolean
  timestamp: datetime (ISO format)
}
```

### settings
```
{
  cleanliness_threshold: integer (default: 60)
  alert_emails: string (comma-separated)
  monitoring_enabled: boolean (default: false)
}
```

## Best Practices

### Image Quality
- Use clear, well-lit classroom photos
- Minimum resolution: 640x480
- Supported formats: JPEG, PNG, WEBP
- Avoid blurry or dark images

### Alert Management
- Review alerts regularly
- Set appropriate threshold for your facility
- Resolve alerts after maintenance
- Configure email notifications for critical alerts

### Data Export
- Export weekly/monthly for record-keeping
- Use CSV for spreadsheet analysis
- Use PDF for formal reports
- Archive exports for historical reference

## Troubleshooting

### Analysis Not Working
- Check EMERGENT_LLM_KEY is set
- Verify image format (JPEG/PNG/WEBP only)
- Ensure image contains recognizable classroom features
- Check backend logs for errors

### Email Alerts Not Sending
- Verify RESEND_API_KEY is configured
- Check email recipients are valid
- Ensure monitoring is enabled in Settings
- Test emails may go to spam folder

### Export Not Downloading
- Check browser download settings
- Verify backend /api/export endpoints are accessible
- Clear browser cache and retry
- Check console for errors

## Performance Notes

- **Analysis Speed**: 3-5 seconds per image
- **Batch Limit**: Recommended max 10 images per batch
- **Export Limit**: CSV (1000 analyses), PDF (100 analyses)
- **History Limit**: 50 most recent analyses displayed
- **Alert Polling**: Sidebar updates every 30 seconds

## Future Enhancements

Potential improvements for next iterations:
- Real-time video feed monitoring
- Advanced analytics with charts and trends
- Multi-language support
- Mobile app for on-the-go monitoring
- Integration with facility management systems
- Custom alert rules (lighting, occupancy thresholds)
- Scheduled reports via email
- Role-based access control

---

**Version**: 2.0  
**Last Updated**: February 20, 2026  
**Tech Stack**: React 19, FastAPI, MongoDB, OpenAI Vision GPT-4o, Resend
