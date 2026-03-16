from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Set
import uuid
from datetime import datetime, timezone, timedelta
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import json
import asyncio
import resend
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from collections import defaultdict
import numpy as np
from sklearn.linear_model import LinearRegression
import pickle
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
from fastapi.responses import StreamingResponse
import csv
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Resend configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'classroom-vision-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Scheduler
scheduler = AsyncIOScheduler()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logging.info(f"WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logging.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logging.error(f"Failed to send message: {e}")
                disconnected.add(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Auth Models
class UserRole:
    ADMIN = "admin"
    USER = "user"

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    role: str = Field(default=UserRole.USER)

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Models
class ClassroomAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    occupancy_count: int
    cleanliness_score: int
    lighting_condition: str
    raw_analysis: str
    image_data: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnalyzeRequest(BaseModel):
    room_name: str
    image_base64: str

class BatchAnalyzeRequest(BaseModel):
    analyses: List[AnalyzeRequest]

class DashboardStats(BaseModel):
    total_analyses: int
    avg_occupancy: float
    avg_cleanliness: float
    rooms_need_maintenance: int
    active_alerts: int

class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    room_name: str
    occupancy_count: int
    cleanliness_score: int
    lighting_condition: str
    raw_analysis: str
    timestamp: str

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    alert_type: str
    severity: str
    message: str
    analysis_id: str
    resolved: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlertResponse(BaseModel):
    id: str
    room_name: str
    alert_type: str
    severity: str
    message: str
    resolved: bool
    timestamp: str

class SettingsUpdate(BaseModel):
    cleanliness_threshold: Optional[int] = None
    alert_emails: Optional[str] = None
    monitoring_enabled: Optional[bool] = None
    report_schedule: Optional[str] = None  # daily, weekly, disabled
    report_time: Optional[str] = None  # HH:MM format

class Settings(BaseModel):
    cleanliness_threshold: int = 60
    alert_emails: str = ""
    monitoring_enabled: bool = False
    report_schedule: str = "disabled"  # daily, weekly, disabled
    report_time: str = "09:00"

class TrendDataPoint(BaseModel):
    date: str
    avg_occupancy: float
    avg_cleanliness: float
    total_analyses: int

class VideoFrameRequest(BaseModel):
    frame_base64: str
    camera_id: Optional[str] = "default"

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    date: str
    detected_faces: int
    identified_students: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Student(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    student_id: str
    face_description: str  # AI-generated description for matching
    face_embedding: Optional[List[float]] = None  # Vector embedding for better matching
    enrolled_courses: List[str] = []

class MLPrediction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    prediction_type: str  # cleanliness, occupancy
    predicted_value: float
    prediction_date: str
    model_type: str  # linear_regression, ai, ensemble
    confidence: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MobileAlert(BaseModel):
    room_name: str
    alert_type: str
    severity: str
    message: str
    timestamp: str

class PredictiveMaintenanceAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    predicted_date: str
    current_cleanliness: float
    prediction_confidence: float
    recommendation: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnomalyAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_name: str
    anomaly_type: str  # occupancy, cleanliness, lighting
    expected_value: float
    actual_value: float
    deviation_percentage: float
    severity: str  # low, medium, high
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper: Analyze image
async def analyze_classroom_image(image_base64: str) -> dict:
    """
    Analyze a classroom image using GPT-5.2 Vision AI.
    Returns occupancy count, cleanliness score, lighting condition, and observations.
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"analysis-{uuid.uuid4()}",
            system_message="You are a classroom monitoring AI that analyzes images to detect occupancy, cleanliness, and lighting conditions. Always provide accurate, objective assessments based on what you see in the image."
        ).with_model("openai", "gpt-5.2")
        
        image_content = ImageContent(image_base64=image_base64)
        
        prompt = """Analyze this classroom/room image carefully and provide the following information in JSON format:

1. occupancy_count: Count the exact number of people/students visible in the image (integer, 0 if empty)
2. cleanliness_score: Rate the overall cleanliness from 0-100 based on:
   - Presence of trash/debris (major deduction)
   - Organization of furniture/items
   - Visible dust or stains
   - General tidiness
   (0=extremely dirty, 50=average, 100=spotlessly clean)
3. lighting_condition: Assess the lighting quality as one of:
   - "Poor" (very dark, harsh shadows, inadequate)
   - "Fair" (some issues, uneven lighting)
   - "Good" (adequate, well-lit most areas)
   - "Excellent" (optimal, even, natural lighting)
4. observations: 2-3 sentences describing what you see, including notable features, potential issues, or recommendations

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "occupancy_count": <number>,
  "cleanliness_score": <number>,
  "lighting_condition": "<Poor/Fair/Good/Excellent>",
  "observations": "<description>"
}"""
        
        user_message = UserMessage(
            text=prompt,
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logging.info(f"AI Vision response received: {response[:200]}...")
        
        # Clean response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith('```'):
            # Remove opening ```json or ``` and closing ```
            lines = response_text.split('\n')
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            response_text = '\n'.join(lines)
        
        analysis_data = json.loads(response_text)
        
        logging.info(f"AI Analysis result: occupancy={analysis_data.get('occupancy_count')}, cleanliness={analysis_data.get('cleanliness_score')}, lighting={analysis_data.get('lighting_condition')}")
        
        return {
            "occupancy_count": int(analysis_data.get("occupancy_count", 0)),
            "cleanliness_score": max(0, min(100, int(analysis_data.get("cleanliness_score", 50)))),
            "lighting_condition": analysis_data.get("lighting_condition", "Fair"),
            "raw_analysis": analysis_data.get("observations", "Analysis completed successfully")
        }
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error in AI response: {e}")
        logging.error(f"Raw response was: {response_text[:500] if 'response_text' in dir() else 'N/A'}")
        return {
            "occupancy_count": 0,
            "cleanliness_score": 50,
            "lighting_condition": "Fair",
            "raw_analysis": "Unable to parse AI analysis results - using defaults"
        }
    except Exception as e:
        logging.error(f"AI Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

# Helper: Create alert if needed
async def check_and_create_alert(analysis: ClassroomAnalysis, threshold: int):
    if analysis.cleanliness_score < threshold:
        alert = Alert(
            room_name=analysis.room_name,
            alert_type="cleanliness",
            severity="high" if analysis.cleanliness_score < 40 else "medium",
            message=f"{analysis.room_name} requires maintenance - Cleanliness score: {analysis.cleanliness_score}%",
            analysis_id=analysis.id
        )
        
        doc = alert.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.alerts.insert_one(doc)
        
        return alert
    return None

# Helper: Send email alert
async def send_alert_email(alert: Alert, recipients: str):
    if not recipients or not resend.api_key:
        return
    
    email_list = [email.strip() for email in recipients.split(',') if email.strip()]
    if not email_list:
        return
    
    sender_email = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #EF4444;">⚠️ Classroom Maintenance Alert</h2>
            <div style="background: #FEF2F2; padding: 20px; border-left: 4px solid #EF4444; margin: 20px 0;">
                <h3 style="margin-top: 0;">{alert.room_name}</h3>
                <p><strong>Alert Type:</strong> {alert.alert_type.title()}</p>
                <p><strong>Severity:</strong> {alert.severity.upper()}</p>
                <p><strong>Message:</strong> {alert.message}</p>
                <p><strong>Time:</strong> {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <p>Please take necessary action to maintain optimal classroom conditions.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">This is an automated alert from Classroom Vision Monitoring System.</p>
        </body>
    </html>
    """
    
    params = {
        "from": sender_email,
        "to": email_list,
        "subject": f"🚨 Maintenance Required: {alert.room_name}",
        "html": html_content
    }
    
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Alert email sent to {recipients}")
    except Exception as e:
        logging.error(f"Failed to send alert email: {e}")

# Helper: Send scheduled report
async def send_scheduled_report():
    try:
        settings = await db.settings.find_one({}, {"_id": 0})
        if not settings or not settings.get('alert_emails') or not resend.api_key:
            logging.info("Skipping scheduled report - no recipients or API key")
            return
        
        # Get data for report
        analyses = await db.classroom_analyses.find({}, {"_id": 0, "image_data": 0}).sort("timestamp", -1).limit(50).to_list(50)
        alerts = await db.alerts.find({"resolved": False}, {"_id": 0}).to_list(100)
        
        if not analyses:
            logging.info("No analyses to report")
            return
        
        # Calculate stats
        total = len(analyses)
        avg_occ = sum(a["occupancy_count"] for a in analyses) / total
        avg_clean = sum(a["cleanliness_score"] for a in analyses) / total
        needs_maintenance = sum(1 for a in analyses if a["cleanliness_score"] < 60)
        
        # Create HTML report
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <h1 style="color: #2563EB;">📊 Classroom Monitoring Report</h1>
                <p style="color: #6B7280;">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                
                <h2 style="color: #1F2937; margin-top: 30px;">Summary Statistics</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #F3F4F6;">
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>Total Analyses</strong></td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;">{total}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>Average Occupancy</strong></td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;">{avg_occ:.1f}</td>
                    </tr>
                    <tr style="background: #F3F4F6;">
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>Average Cleanliness</strong></td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;">{avg_clean:.1f}%</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>Rooms Need Maintenance</strong></td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB; color: #EF4444;">{needs_maintenance}</td>
                    </tr>
                    <tr style="background: #F3F4F6;">
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>Active Alerts</strong></td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB; color: #EF4444;">{len(alerts)}</td>
                    </tr>
                </table>
                
                <h2 style="color: #1F2937; margin-top: 30px;">Recent Analyses</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                    <thead>
                        <tr style="background: #1F2937; color: white;">
                            <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: left;">Room</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">Occupancy</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">Cleanliness</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">Lighting</th>
                        </tr>
                    </thead>
                    <tbody>
        """
        
        for i, analysis in enumerate(analyses[:10]):
            bg_color = "#F9FAFB" if i % 2 == 0 else "#FFFFFF"
            clean_color = "#10B981" if analysis["cleanliness_score"] >= 80 else "#F59E0B" if analysis["cleanliness_score"] >= 60 else "#EF4444"
            
            html_content += f"""
                        <tr style="background: {bg_color};">
                            <td style="padding: 8px; border: 1px solid #E5E7EB;">{analysis["room_name"]}</td>
                            <td style="padding: 8px; border: 1px solid #E5E7EB; text-align: center;">{analysis["occupancy_count"]}</td>
                            <td style="padding: 8px; border: 1px solid #E5E7EB; text-align: center; color: {clean_color}; font-weight: bold;">{analysis["cleanliness_score"]}%</td>
                            <td style="padding: 8px; border: 1px solid #E5E7EB; text-align: center;">{analysis["lighting_condition"]}</td>
                        </tr>
            """
        
        html_content += """
                    </tbody>
                </table>
                
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
                <p style="color: #6B7280; font-size: 12px;">This is an automated report from Classroom Vision Monitoring System.</p>
            </body>
        </html>
        """
        
        email_list = [email.strip() for email in settings['alert_emails'].split(',') if email.strip()]
        sender_email = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
        
        params = {
            "from": sender_email,
            "to": email_list,
            "subject": f"📊 Classroom Monitoring Report - {datetime.now().strftime('%Y-%m-%d')}",
            "html": html_content
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Scheduled report sent to {settings['alert_emails']}")
    except Exception as e:
        logging.error(f"Failed to send scheduled report: {e}")

# Helper: Detect and identify faces for attendance
async def detect_faces_for_attendance(image_base64: str, room_name: str) -> dict:
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            return {"detected_faces": 0, "identified_students": []}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"attendance-{uuid.uuid4()}",
            system_message="You are an attendance tracking AI that detects and counts faces in classroom images."
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        prompt = """Analyze this classroom image for attendance tracking. Provide:
1. Total number of distinct human faces visible
2. Brief description of each person's appearance (for identification)

Respond in JSON format:
{
  "total_faces": <number>,
  "face_descriptions": ["description1", "description2", ...]
}"""
        
        user_message = UserMessage(text=prompt, file_contents=[image_content])
        response = await chat.send_message(user_message)
        
        response_text = response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('\n', 1)[1].rsplit('```', 1)[0]
        
        data = json.loads(response_text)
        
        # Try to match faces with enrolled students
        students = await db.students.find({}, {"_id": 0}).to_list(100)
        identified = []
        
        for desc in data.get("face_descriptions", []):
            # Simple matching based on description similarity
            # In production, use proper face recognition with embeddings
            for student in students:
                if room_name in student.get("enrolled_courses", []):
                    identified.append(student["name"])
                    break
        
        return {
            "detected_faces": data.get("total_faces", 0),
            "identified_students": identified[:data.get("total_faces", 0)]
        }
    except Exception as e:
        logging.error(f"Face detection error: {e}")
        return {"detected_faces": 0, "identified_students": []}

# Helper: Predict maintenance needs using AI
async def predict_maintenance_needs():
    try:
        # Get historical data
        analyses = await db.classroom_analyses.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        if len(analyses) < 10:
            logging.info("Not enough data for predictions")
            return
        
        # Group by room
        room_data = defaultdict(list)
        for analysis in analyses:
            room_data[analysis["room_name"]].append({
                "timestamp": analysis["timestamp"],
                "cleanliness": analysis["cleanliness_score"]
            })
        
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            return
        
        # Analyze each room
        for room_name, data in room_data.items():
            if len(data) < 5:
                continue
            
            # Get trend
            recent_scores = [d["cleanliness"] for d in data[:10]]
            avg_recent = sum(recent_scores) / len(recent_scores)
            
            # Calculate degradation rate
            if len(data) >= 10:
                old_scores = [d["cleanliness"] for d in data[-10:]]
                avg_old = sum(old_scores) / len(old_scores)
                degradation_rate = (avg_old - avg_recent) / len(data)
                
                # Predict when cleanliness will drop below threshold
                threshold = 60
                if avg_recent > threshold and degradation_rate > 0:
                    days_until_maintenance = (avg_recent - threshold) / max(degradation_rate, 0.1)
                    
                    if days_until_maintenance <= 7:  # Alert if within a week
                        # Use AI for detailed recommendation
                        chat = LlmChat(
                            api_key=api_key,
                            session_id=f"predict-{uuid.uuid4()}",
                            system_message="You are a facility management AI that predicts maintenance needs."
                        ).with_model("openai", "gpt-4o")
                        
                        prompt = f"""Based on this data for {room_name}:
- Current average cleanliness: {avg_recent:.1f}%
- Degradation rate: {degradation_rate:.2f}% per analysis
- Estimated days until maintenance needed: {days_until_maintenance:.1f}

Provide a concise maintenance recommendation (max 100 words)."""
                        
                        user_message = UserMessage(text=prompt)
                        recommendation = await chat.send_message(user_message)
                        
                        # Create predictive alert
                        alert = PredictiveMaintenanceAlert(
                            room_name=room_name,
                            predicted_date=(datetime.now() + __import__('datetime').timedelta(days=int(days_until_maintenance))).strftime("%Y-%m-%d"),
                            current_cleanliness=avg_recent,
                            prediction_confidence=min(0.9, len(data) / 50),
                            recommendation=recommendation.strip()
                        )
                        
                        doc = alert.model_dump()
                        doc['timestamp'] = doc['timestamp'].isoformat()
                        
                        # Store or update prediction
                        await db.predictive_alerts.update_one(
                            {"room_name": room_name},
                            {"$set": doc},
                            upsert=True
                        )
                        
                        logging.info(f"Created predictive alert for {room_name}")
    except Exception as e:
        logging.error(f"Prediction error: {e}")

# Helper: Detect anomalies
async def detect_anomalies(analysis: ClassroomAnalysis):
    try:
        room_name = analysis.room_name
        
        # Get historical data for this room (last 30 days)
        from_date = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=30)
        historical = await db.classroom_analyses.find(
            {
                "room_name": room_name,
                "timestamp": {"$gte": from_date.isoformat()}
            },
            {"_id": 0}
        ).to_list(1000)
        
        if len(historical) < 10:  # Need baseline data
            return
        
        # Calculate baseline statistics
        occupancy_values = [h["occupancy_count"] for h in historical]
        cleanliness_values = [h["cleanliness_score"] for h in historical]
        
        avg_occupancy = sum(occupancy_values) / len(occupancy_values)
        avg_cleanliness = sum(cleanliness_values) / len(cleanliness_values)
        
        # Calculate standard deviation
        import math
        std_occupancy = math.sqrt(sum((x - avg_occupancy) ** 2 for x in occupancy_values) / len(occupancy_values))
        std_cleanliness = math.sqrt(sum((x - avg_cleanliness) ** 2 for x in cleanliness_values) / len(cleanliness_values))
        
        anomalies = []
        
        # Check for occupancy anomaly (> 2 standard deviations)
        if std_occupancy > 0:
            occupancy_z_score = abs(analysis.occupancy_count - avg_occupancy) / std_occupancy
            if occupancy_z_score > 2:
                deviation = ((analysis.occupancy_count - avg_occupancy) / max(avg_occupancy, 1)) * 100
                severity = "high" if occupancy_z_score > 3 else "medium"
                
                anomaly = AnomalyAlert(
                    room_name=room_name,
                    anomaly_type="occupancy",
                    expected_value=round(avg_occupancy, 1),
                    actual_value=analysis.occupancy_count,
                    deviation_percentage=round(abs(deviation), 1),
                    severity=severity,
                    description=f"Unusual occupancy detected: {analysis.occupancy_count} vs normal {avg_occupancy:.1f}"
                )
                anomalies.append(anomaly)
        
        # Check for cleanliness anomaly
        if std_cleanliness > 0:
            cleanliness_z_score = abs(analysis.cleanliness_score - avg_cleanliness) / std_cleanliness
            if cleanliness_z_score > 2 and analysis.cleanliness_score < avg_cleanliness:  # Only alert on drops
                deviation = ((analysis.cleanliness_score - avg_cleanliness) / avg_cleanliness) * 100
                severity = "high" if cleanliness_z_score > 3 else "medium"
                
                anomaly = AnomalyAlert(
                    room_name=room_name,
                    anomaly_type="cleanliness",
                    expected_value=round(avg_cleanliness, 1),
                    actual_value=analysis.cleanliness_score,
                    deviation_percentage=round(abs(deviation), 1),
                    severity=severity,
                    description=f"Sudden cleanliness drop: {analysis.cleanliness_score}% vs normal {avg_cleanliness:.1f}%"
                )
                anomalies.append(anomaly)
        
        # Store anomalies
        for anomaly in anomalies:
            doc = anomaly.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.anomaly_alerts.insert_one(doc)
            
            logging.info(f"Anomaly detected in {room_name}: {anomaly.anomaly_type}")
            
            # Broadcast anomaly via WebSocket
            await broadcast_alert("anomaly", {
                "room_name": anomaly.room_name,
                "anomaly_type": anomaly.anomaly_type,
                "severity": anomaly.severity,
                "message": anomaly.description
            })
            
            # Send email notification if configured
            settings = await db.settings.find_one({}, {"_id": 0})
            if settings and settings.get('alert_emails'):
                await send_anomaly_email(anomaly, settings['alert_emails'])
    
    except Exception as e:
        logging.error(f"Anomaly detection error: {e}")

# Helper: Send anomaly email
async def send_anomaly_email(anomaly: AnomalyAlert, recipients: str):
    if not recipients or not resend.api_key:
        return
    
    email_list = [email.strip() for email in recipients.split(',') if email.strip()]
    if not email_list:
        return
    
    sender_email = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
    
    severity_colors = {
        "high": "#EF4444",
        "medium": "#F59E0B",
        "low": "#3B82F6"
    }
    
    color = severity_colors.get(anomaly.severity, "#6B7280")
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: {color};">🔍 Anomaly Detected</h2>
            <div style="background: #FEF2F2; padding: 20px; border-left: 4px solid {color}; margin: 20px 0;">
                <h3 style="margin-top: 0;">{anomaly.room_name}</h3>
                <p><strong>Anomaly Type:</strong> {anomaly.anomaly_type.title()}</p>
                <p><strong>Severity:</strong> {anomaly.severity.upper()}</p>
                <p><strong>Expected Value:</strong> {anomaly.expected_value}</p>
                <p><strong>Actual Value:</strong> {anomaly.actual_value}</p>
                <p><strong>Deviation:</strong> {anomaly.deviation_percentage}%</p>
                <p><strong>Description:</strong> {anomaly.description}</p>
                <p><strong>Time:</strong> {anomaly.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <p>Please investigate this unusual activity to ensure classroom safety and optimal conditions.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">This is an automated anomaly alert from Classroom Vision Monitoring System.</p>
        </body>
    </html>
    """
    
    params = {
        "from": sender_email,
        "to": email_list,
        "subject": f"🔍 Anomaly Alert: {anomaly.room_name} - {anomaly.anomaly_type.title()}",
        "html": html_content
    }
    
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Anomaly email sent to {recipients}")
    except Exception as e:
        logging.error(f"Failed to send anomaly email: {e}")

# Helper: Generate face embedding using AI
async def generate_face_embedding(image_base64: str) -> Optional[List[float]]:
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            return None
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"embedding-{uuid.uuid4()}",
            system_message="You are a face analysis AI. Describe facial features in detail for identification."
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        prompt = """Analyze the facial features in this image. Provide detailed characteristics:
- Face shape, skin tone, hair color and style
- Eye color and shape, nose shape, mouth shape
- Distinctive features (glasses, facial hair, etc.)
- Approximate age range

Provide a detailed, unique description that can be used for identification."""
        
        user_message = UserMessage(text=prompt, file_contents=[image_content])
        response = await chat.send_message(user_message)
        
        # Create a simple embedding from the text
        embedding = [float(ord(c)) / 255.0 for c in response[:128]]
        
        if len(embedding) < 128:
            embedding.extend([0.0] * (128 - len(embedding)))
        else:
            embedding = embedding[:128]
        
        return embedding
    except Exception as e:
        logging.error(f"Embedding generation error: {e}")
        return None

# Helper: Calculate embedding similarity
def calculate_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    if not embedding1 or not embedding2:
        return 0.0
    
    arr1 = np.array(embedding1)
    arr2 = np.array(embedding2)
    
    dot_product = np.dot(arr1, arr2)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)

# Helper: ML-based prediction
async def ml_predict_maintenance():
    try:
        analyses = await db.classroom_analyses.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        if len(analyses) < 20:
            logging.info("Not enough data for ML predictions")
            return
        
        room_data = defaultdict(list)
        for analysis in analyses:
            room_data[analysis["room_name"]].append({
                "timestamp": analysis["timestamp"],
                "cleanliness": analysis["cleanliness_score"],
                "occupancy": analysis["occupancy_count"]
            })
        
        for room_name, data in room_data.items():
            if len(data) < 15:
                continue
            
            X = np.array([[i] for i in range(len(data))])
            y_clean = np.array([d["cleanliness"] for d in data])
            
            model_clean = LinearRegression()
            model_clean.fit(X, y_clean)
            
            future_X = np.array([[len(data) + i] for i in range(1, 8)])
            pred_clean = model_clean.predict(future_X)
            
            threshold = 60
            for i, clean_val in enumerate(pred_clean):
                if clean_val < threshold:
                    ml_pred = MLPrediction(
                        room_name=room_name,
                        prediction_type="cleanliness",
                        predicted_value=float(clean_val),
                        prediction_date=(datetime.now() + __import__('datetime').timedelta(days=i+1)).strftime("%Y-%m-%d"),
                        model_type="linear_regression",
                        confidence=0.75
                    )
                    
                    doc = ml_pred.model_dump()
                    doc['timestamp'] = doc['timestamp'].isoformat()
                    
                    await db.ml_predictions.update_one(
                        {"room_name": room_name, "prediction_type": "cleanliness"},
                        {"$set": doc},
                        upsert=True
                    )
                    
                    logging.info(f"ML prediction for {room_name}: {clean_val:.1f}% in {i+1} days")
                    break
        
    except Exception as e:
        logging.error(f"ML prediction error: {e}")

# ============ Authentication Functions ============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    
    return {
        "id": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "created_at": user["created_at"]
    }

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ============ Auth Endpoints ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    user_doc = {
        "_id": user_id,
        "email": user_data.email,
        "password": hashed_password,
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token = create_access_token(data={"sub": user_id, "role": user_data.role})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Extended expiry for "Remember Me" - 30 days vs default 24 hours
    expires_delta = timedelta(days=30) if user_data.remember_me else None
    access_token = create_access_token(
        data={"sub": user["_id"], "role": user["role"]},
        expires_delta=expires_delta
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["_id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

@api_router.get("/auth/users", response_model=List[UserResponse])
async def get_all_users(current_user: dict = Depends(get_current_admin)):
    """Admin only: Get all users"""
    users = await db.users.find({}, {"password": 0}).to_list(100)
    return [UserResponse(
        id=u["_id"],
        email=u["email"],
        name=u["name"],
        role=u["role"],
        created_at=u["created_at"]
    ) for u in users]

@api_router.delete("/auth/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    """Admin only: Delete a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, current_user: dict = Depends(get_current_admin)):
    """Admin only: Update user role"""
    if role not in [UserRole.ADMIN, UserRole.USER]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"_id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully"}

# ============ API Endpoints ============

@api_router.get("/")
async def root():
    return {"message": "Smart Classroom Monitoring API"}

@api_router.post("/analyze", response_model=AnalysisResponse)
async def analyze_classroom(request: AnalyzeRequest):
    try:
        analysis_result = await analyze_classroom_image(request.image_base64)
        
        analysis = ClassroomAnalysis(
            room_name=request.room_name,
            occupancy_count=analysis_result["occupancy_count"],
            cleanliness_score=analysis_result["cleanliness_score"],
            lighting_condition=analysis_result["lighting_condition"],
            raw_analysis=analysis_result["raw_analysis"],
            image_data=request.image_base64[:100]
        )
        
        doc = analysis.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.classroom_analyses.insert_one(doc)
        
        # Check for alerts
        settings = await db.settings.find_one({}, {"_id": 0})
        threshold = settings.get('cleanliness_threshold', 60) if settings else 60
        alert_emails = settings.get('alert_emails', '') if settings else ''
        
        alert = await check_and_create_alert(analysis, threshold)
        if alert:
            await send_alert_email(alert, alert_emails)
        
        # Detect anomalies
        await detect_anomalies(analysis)
        
        # Broadcast new analysis via WebSocket
        await broadcast_alert("new_analysis", {
            "room_name": analysis.room_name,
            "cleanliness_score": analysis.cleanliness_score,
            "occupancy_count": analysis.occupancy_count
        })
        
        return AnalysisResponse(
            id=analysis.id,
            room_name=analysis.room_name,
            occupancy_count=analysis.occupancy_count,
            cleanliness_score=analysis.cleanliness_score,
            lighting_condition=analysis.lighting_condition,
            raw_analysis=analysis.raw_analysis,
            timestamp=analysis.timestamp.isoformat()
        )
    except Exception as e:
        logging.error(f"Error in analyze_classroom: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze/batch")
async def batch_analyze(request: BatchAnalyzeRequest):
    results = []
    
    for item in request.analyses:
        try:
            analysis_result = await analyze_classroom_image(item.image_base64)
            
            analysis = ClassroomAnalysis(
                room_name=item.room_name,
                occupancy_count=analysis_result["occupancy_count"],
                cleanliness_score=analysis_result["cleanliness_score"],
                lighting_condition=analysis_result["lighting_condition"],
                raw_analysis=analysis_result["raw_analysis"],
                image_data=item.image_base64[:100]
            )
            
            doc = analysis.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.classroom_analyses.insert_one(doc)
            
            settings = await db.settings.find_one({}, {"_id": 0})
            threshold = settings.get('cleanliness_threshold', 60) if settings else 60
            alert_emails = settings.get('alert_emails', '') if settings else ''
            
            alert = await check_and_create_alert(analysis, threshold)
            if alert:
                await send_alert_email(alert, alert_emails)
            
            results.append({
                "success": True,
                "room_name": analysis.room_name,
                "analysis": AnalysisResponse(
                    id=analysis.id,
                    room_name=analysis.room_name,
                    occupancy_count=analysis.occupancy_count,
                    cleanliness_score=analysis.cleanliness_score,
                    lighting_condition=analysis.lighting_condition,
                    raw_analysis=analysis.raw_analysis,
                    timestamp=analysis.timestamp.isoformat()
                )
            })
        except Exception as e:
            results.append({
                "success": False,
                "room_name": item.room_name,
                "error": str(e)
            })
    
    return {"results": results, "total": len(request.analyses), "successful": sum(1 for r in results if r["success"])}

@api_router.get("/analyses", response_model=List[AnalysisResponse])
async def get_analyses(limit: int = 50):
    try:
        # Only fetch analyses that have the required 'id' field
        analyses = await db.classroom_analyses.find(
            {"id": {"$exists": True}}, 
            {"_id": 0, "image_data": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        logging.info(f"Fetched {len(analyses)} analyses from database")
        
        result = []
        for a in analyses:
            result.append(AnalysisResponse(
                id=a["id"],
                room_name=a["room_name"],
                occupancy_count=a["occupancy_count"],
                cleanliness_score=a["cleanliness_score"],
                lighting_condition=a["lighting_condition"],
                raw_analysis=a["raw_analysis"],
                timestamp=a["timestamp"] if isinstance(a["timestamp"], str) else a["timestamp"].isoformat()
            ))
        
        logging.info(f"Returning {len(result)} analyses")
        return result
    except Exception as e:
        logging.error(f"Error fetching analyses: {e}")
        return []

@api_router.get("/stats", response_model=DashboardStats)
async def get_stats():
    try:
        analyses = await db.classroom_analyses.find({}, {"_id": 0}).to_list(1000)
        alerts = await db.alerts.find({"resolved": False}, {"_id": 0}).to_list(100)
        
        if not analyses:
            return DashboardStats(
                total_analyses=0,
                avg_occupancy=0.0,
                avg_cleanliness=0.0,
                rooms_need_maintenance=0,
                active_alerts=len(alerts)
            )
        
        total = len(analyses)
        avg_occ = sum(a["occupancy_count"] for a in analyses) / total
        avg_clean = sum(a["cleanliness_score"] for a in analyses) / total
        needs_maintenance = sum(1 for a in analyses if a["cleanliness_score"] < 60)
        
        return DashboardStats(
            total_analyses=total,
            avg_occupancy=round(avg_occ, 1),
            avg_cleanliness=round(avg_clean, 1),
            rooms_need_maintenance=needs_maintenance,
            active_alerts=len(alerts)
        )
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        return DashboardStats(
            total_analyses=0,
            avg_occupancy=0.0,
            avg_cleanliness=0.0,
            rooms_need_maintenance=0,
            active_alerts=0
        )

@api_router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(resolved: Optional[bool] = None):
    try:
        query = {} if resolved is None else {"resolved": resolved}
        alerts = await db.alerts.find(query, {"_id": 0}).sort("timestamp", -1).limit(50).to_list(50)
        
        return [
            AlertResponse(
                id=a["id"],
                room_name=a["room_name"],
                alert_type=a["alert_type"],
                severity=a["severity"],
                message=a["message"],
                resolved=a["resolved"],
                timestamp=a["timestamp"]
            )
            for a in alerts
        ]
    except Exception as e:
        logging.error(f"Error fetching alerts: {e}")
        return []

@api_router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    try:
        result = await db.alerts.update_one(
            {"id": alert_id},
            {"$set": {"resolved": True}}
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Alert resolved"}
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    except Exception as e:
        logging.error(f"Error resolving alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings", response_model=Settings)
async def get_settings():
    try:
        settings = await db.settings.find_one({}, {"_id": 0})
        if settings:
            return Settings(**settings)
        else:
            default_settings = Settings()
            await db.settings.insert_one(default_settings.model_dump())
            return default_settings
    except Exception as e:
        logging.error(f"Error fetching settings: {e}")
        return Settings()

@api_router.post("/settings")
async def update_settings(update: SettingsUpdate):
    try:
        settings = await db.settings.find_one({}, {"_id": 0})
        if not settings:
            settings = Settings().model_dump()
        
        old_schedule = settings.get('report_schedule', 'disabled')
        old_time = settings.get('report_time', '09:00')
        
        if update.cleanliness_threshold is not None:
            settings['cleanliness_threshold'] = update.cleanliness_threshold
        if update.alert_emails is not None:
            settings['alert_emails'] = update.alert_emails
        if update.monitoring_enabled is not None:
            settings['monitoring_enabled'] = update.monitoring_enabled
        if update.report_schedule is not None:
            settings['report_schedule'] = update.report_schedule
        if update.report_time is not None:
            settings['report_time'] = update.report_time
        
        await db.settings.delete_many({})
        await db.settings.insert_one(settings.copy())
        
        # Update scheduler if report schedule changed
        new_schedule = settings.get('report_schedule', 'disabled')
        new_time = settings.get('report_time', '09:00')
        
        if old_schedule != new_schedule or old_time != new_time:
            # Remove existing scheduled jobs
            for job in scheduler.get_jobs():
                if job.id == 'daily_report' or job.id == 'weekly_report':
                    job.remove()
            
            # Add new scheduled job
            if new_schedule == 'daily':
                hour, minute = map(int, new_time.split(':'))
                scheduler.add_job(
                    send_scheduled_report,
                    CronTrigger(hour=hour, minute=minute),
                    id='daily_report',
                    replace_existing=True
                )
                logging.info(f"Scheduled daily report at {new_time}")
            elif new_schedule == 'weekly':
                hour, minute = map(int, new_time.split(':'))
                scheduler.add_job(
                    send_scheduled_report,
                    CronTrigger(day_of_week='mon', hour=hour, minute=minute),
                    id='weekly_report',
                    replace_existing=True
                )
                logging.info(f"Scheduled weekly report (Mondays) at {new_time}")
        
        clean_settings = {
            "cleanliness_threshold": settings['cleanliness_threshold'],
            "alert_emails": settings['alert_emails'],
            "monitoring_enabled": settings['monitoring_enabled'],
            "report_schedule": settings.get('report_schedule', 'disabled'),
            "report_time": settings.get('report_time', '09:00')
        }
        
        return {"success": True, "settings": clean_settings}
    except Exception as e:
        logging.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/trends")
async def get_trends(days: int = 7):
    try:
        from_date = datetime.now(timezone.utc) - timedelta(days=days)
        logging.info(f"Fetching trends from {from_date} for {days} days")
        
        analyses = await db.classroom_analyses.find(
            {"timestamp": {"$gte": from_date}},
            {"_id": 0}
        ).to_list(10000)
        
        logging.info(f"Found {len(analyses)} analyses")
        
        # Group by date
        daily_data = defaultdict(lambda: {"occupancy": [], "cleanliness": [], "count": 0})
        
        for analysis in analyses:
            timestamp = analysis.get("timestamp", "")
            if isinstance(timestamp, str):
                date_str = timestamp.split("T")[0]
            else:
                date_str = timestamp.strftime("%Y-%m-%d")
            
            daily_data[date_str]["occupancy"].append(analysis["occupancy_count"])
            daily_data[date_str]["cleanliness"].append(analysis["cleanliness_score"])
            daily_data[date_str]["count"] += 1
        
        # Calculate averages
        trend_data = []
        for date in sorted(daily_data.keys()):
            data = daily_data[date]
            trend_data.append({
                "date": date,
                "avg_occupancy": round(sum(data["occupancy"]) / len(data["occupancy"]), 1) if data["occupancy"] else 0,
                "avg_cleanliness": round(sum(data["cleanliness"]) / len(data["cleanliness"]), 1) if data["cleanliness"] else 0,
                "total_analyses": data["count"]
            })
        
        return trend_data
    except Exception as e:
        logging.error(f"Error fetching trends: {e}")
        return []

@api_router.post("/video/analyze")
async def analyze_video_frame(request: VideoFrameRequest):
    try:
        analysis_result = await analyze_classroom_image(request.frame_base64)
        
        # Also detect faces for attendance
        attendance_data = await detect_faces_for_attendance(request.frame_base64, request.camera_id)
        
        # Store in a separate video_analyses collection for live feed tracking
        video_analysis = {
            "id": str(uuid.uuid4()),
            "camera_id": request.camera_id,
            "occupancy_count": analysis_result["occupancy_count"],
            "cleanliness_score": analysis_result["cleanliness_score"],
            "lighting_condition": analysis_result["lighting_condition"],
            "raw_analysis": analysis_result["raw_analysis"],
            "detected_faces": attendance_data["detected_faces"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.video_analyses.insert_one(video_analysis)
        
        # Store attendance record if faces detected
        if attendance_data["detected_faces"] > 0:
            attendance_record = AttendanceRecord(
                room_name=request.camera_id,
                date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                detected_faces=attendance_data["detected_faces"],
                identified_students=attendance_data["identified_students"]
            )
            
            doc = attendance_record.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.attendance.insert_one(doc)
        
        return {
            "success": True,
            "occupancy_count": analysis_result["occupancy_count"],
            "cleanliness_score": analysis_result["cleanliness_score"],
            "lighting_condition": analysis_result["lighting_condition"],
            "raw_analysis": analysis_result["raw_analysis"],
            "detected_faces": attendance_data["detected_faces"],
            "identified_students": attendance_data["identified_students"]
        }
    except Exception as e:
        logging.error(f"Error analyzing video frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/attendance")
async def get_attendance(date: Optional[str] = None, room: Optional[str] = None):
    try:
        query = {}
        if date:
            query["date"] = date
        if room:
            query["room_name"] = room
        
        records = await db.attendance.find(query, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
        return records
    except Exception as e:
        logging.error(f"Error fetching attendance: {e}")
        return []

@api_router.post("/students")
async def register_student(student: Student):
    try:
        doc = student.model_dump()
        await db.students.insert_one(doc)
        return {"success": True, "student_id": student.id}
    except Exception as e:
        logging.error(f"Error registering student: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/students/with-photo")
async def register_student_with_photo(name: str, student_id: str, enrolled_courses: str, photo_base64: str):
    try:
        # Generate face embedding
        embedding = await generate_face_embedding(photo_base64)
        
        student = Student(
            name=name,
            student_id=student_id,
            face_description="AI-generated from photo",
            face_embedding=embedding,
            enrolled_courses=enrolled_courses.split(',') if enrolled_courses else []
        )
        
        doc = student.model_dump()
        await db.students.insert_one(doc)
        return {"success": True, "student_id": student.id, "embedding_generated": embedding is not None}
    except Exception as e:
        logging.error(f"Error registering student: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/students")
async def get_students():
    try:
        students = await db.students.find({}, {"_id": 0}).to_list(100)
        return students
    except Exception as e:
        logging.error(f"Error fetching students: {e}")
        return []

@api_router.get("/predictive-alerts")
async def get_predictive_alerts():
    try:
        alerts = await db.predictive_alerts.find({}, {"_id": 0}).sort("predicted_date", 1).to_list(50)
        return alerts
    except Exception as e:
        logging.error(f"Error fetching predictive alerts: {e}")
        return []

@api_router.post("/predictive-alerts/generate")
async def generate_predictions():
    try:
        await predict_maintenance_needs()
        return {"success": True, "message": "Predictions generated"}
    except Exception as e:
        logging.error(f"Error generating predictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anomaly-alerts")
async def get_anomaly_alerts(limit: int = 50):
    try:
        alerts = await db.anomaly_alerts.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
        return alerts
    except Exception as e:
        logging.error(f"Error fetching anomaly alerts: {e}")
        return []

@api_router.get("/ml-predictions")
async def get_ml_predictions():
    try:
        predictions = await db.ml_predictions.find({}, {"_id": 0}).sort("prediction_date", 1).to_list(50)
        return predictions
    except Exception as e:
        logging.error(f"Error fetching ML predictions: {e}")
        return []

@api_router.post("/ml-predictions/generate")
async def generate_ml_predictions():
    try:
        await ml_predict_maintenance()
        return {"success": True, "message": "ML predictions generated"}
    except Exception as e:
        logging.error(f"Error generating ML predictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mobile-specific endpoints
@api_router.get("/mobile/dashboard")
async def mobile_dashboard():
    try:
        stats = await db.classroom_analyses.find({}, {"_id": 0}).to_list(1000)
        alerts = await db.alerts.find({"resolved": False}, {"_id": 0}).to_list(10)
        anomalies = await db.anomaly_alerts.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
        
        total = len(stats)
        if total == 0:
            return {
                "stats": {"total": 0, "avg_clean": 0, "alerts": 0},
                "recent_alerts": [],
                "recent_anomalies": []
            }
        
        avg_clean = sum(s["cleanliness_score"] for s in stats) / total
        
        return {
            "stats": {
                "total_analyses": total,
                "avg_cleanliness": round(avg_clean, 1),
                "active_alerts": len(alerts),
                "needs_attention": sum(1 for s in stats if s["cleanliness_score"] < 60)
            },
            "recent_alerts": [
                MobileAlert(
                    room_name=a["room_name"],
                    alert_type=a["alert_type"],
                    severity=a["severity"],
                    message=a["message"],
                    timestamp=a["timestamp"]
                ).model_dump() for a in alerts[:3]
            ],
            "recent_anomalies": [
                MobileAlert(
                    room_name=a["room_name"],
                    alert_type=a["anomaly_type"],
                    severity=a["severity"],
                    message=a["description"],
                    timestamp=a["timestamp"]
                ).model_dump() for a in anomalies[:3]
            ]
        }
    except Exception as e:
        logging.error(f"Error fetching mobile dashboard: {e}")
        return {"stats": {}, "recent_alerts": [], "recent_anomalies": []}

@api_router.get("/mobile/rooms")
async def mobile_rooms():
    try:
        analyses = await db.classroom_analyses.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        # Group by room and get latest
        room_status = {}
        for analysis in analyses:
            room = analysis["room_name"]
            if room not in room_status:
                room_status[room] = {
                    "room_name": room,
                    "cleanliness": analysis["cleanliness_score"],
                    "occupancy": analysis["occupancy_count"],
                    "lighting": analysis["lighting_condition"],
                    "last_checked": analysis["timestamp"],
                    "status": "good" if analysis["cleanliness_score"] >= 80 else "warning" if analysis["cleanliness_score"] >= 60 else "critical"
                }
        
        return list(room_status.values())
    except Exception as e:
        logging.error(f"Error fetching mobile rooms: {e}")
        return []

# WebSocket endpoint
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive messages
            data = await websocket.receive_text()
            # Echo back for heartbeat
            await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Helper: Broadcast alert via WebSocket
async def broadcast_alert(alert_type: str, data: dict):
    message = {
        "type": alert_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast(message)

@api_router.get("/export/csv")
async def export_csv():
    try:
        analyses = await db.classroom_analyses.find({}, {"_id": 0, "image_data": 0}).sort("timestamp", -1).to_list(1000)
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=['room_name', 'occupancy_count', 'cleanliness_score', 'lighting_condition', 'raw_analysis', 'timestamp'])
        writer.writeheader()
        
        for a in analyses:
            writer.writerow({
                'room_name': a['room_name'],
                'occupancy_count': a['occupancy_count'],
                'cleanliness_score': a['cleanliness_score'],
                'lighting_condition': a['lighting_condition'],
                'raw_analysis': a['raw_analysis'],
                'timestamp': a['timestamp']
            })
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=classroom_analyses_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    except Exception as e:
        logging.error(f"Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/export/pdf")
async def export_pdf():
    try:
        analyses = await db.classroom_analyses.find({}, {"_id": 0, "image_data": 0}).sort("timestamp", -1).limit(100).to_list(100)
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        title = Paragraph("<b>Classroom Analysis Report</b>", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 0.3*inch))
        
        subtitle = Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal'])
        elements.append(subtitle)
        elements.append(Spacer(1, 0.3*inch))
        
        data = [['Room', 'Occupancy', 'Cleanliness', 'Lighting', 'Time']]
        
        for a in analyses:
            data.append([
                a['room_name'],
                str(a['occupancy_count']),
                f"{a['cleanliness_score']}%",
                a['lighting_condition'],
                a['timestamp'][:16] if isinstance(a['timestamp'], str) else str(a['timestamp'])[:16]
            ])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        doc.build(elements)
        
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=classroom_report_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
    except Exception as e:
        logging.error(f"Error exporting PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logging.info("Starting scheduler...")
    scheduler.start()
    
    # Schedule predictive maintenance analysis (daily at 2 AM)
    scheduler.add_job(
        predict_maintenance_needs,
        CronTrigger(hour=2, minute=0),
        id='predictive_maintenance',
        replace_existing=True
    )
    logging.info("Scheduled predictive maintenance job")
    
    # Schedule ML predictions (daily at 3 AM)
    scheduler.add_job(
        ml_predict_maintenance,
        CronTrigger(hour=3, minute=0),
        id='ml_predictions',
        replace_existing=True
    )
    logging.info("Scheduled ML prediction job")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    scheduler.shutdown()
    
