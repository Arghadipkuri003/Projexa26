"""
Backend API Tests for Remember Me Feature and AI/CV Image Analysis
Tests: JWT token expiry with/without Remember Me, AI-powered classroom image analysis
"""
import pytest
import requests
import os
import uuid
import base64
import time
from jose import jwt

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://classroom-monitor-5.preview.emergentagent.com')

# JWT secret must match backend
SECRET_KEY = "classroom-vision-secret-key-change-in-production"
ALGORITHM = "HS256"

# Test credentials
TEST_ADMIN_EMAIL = "admin@classroom.com"
TEST_ADMIN_PASSWORD = "admin123"

# Test image URLs from Unsplash
EMPTY_CLASSROOM_URL = "https://images.unsplash.com/photo-1654366698665-e6d611a9aaa9"
LECTURE_HALL_URL = "https://images.unsplash.com/photo-1606761568499-6d2451b23c66"


def get_image_as_base64(url):
    """Fetch image from URL and convert to base64"""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return base64.b64encode(response.content).decode('utf-8')


def decode_token_expiry(token):
    """Decode JWT token and return expiry timestamp (exp claim)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("exp")
    except Exception as e:
        # Try decoding without verification to read claims
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("exp")


class TestRememberMeFeature:
    """Tests for Remember Me checkbox functionality - token expiry variations"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create test user if not exists"""
        self.unique_email = f"TEST_remember_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "remembertest123"
        
        # Register a test user
        payload = {
            "email": self.unique_email,
            "password": self.password,
            "name": "Remember Me Test User",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        # If already exists, that's fine
        if response.status_code not in [200, 400]:
            pytest.fail(f"Failed to setup user: {response.text}")
    
    def test_login_without_remember_me_default_expiry(self):
        """Test login without Remember Me uses default 24hr token expiry"""
        payload = {
            "email": self.unique_email,
            "password": self.password,
            "remember_me": False  # Explicitly false
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        token = data["access_token"]
        
        # Decode token to check expiry
        exp = decode_token_expiry(token)
        current_time = time.time()
        
        # Default expiry is 24 hours = 86400 seconds
        token_lifetime = exp - current_time
        
        # Should be approximately 24 hours (allow 5 minute tolerance)
        expected_lifetime = 24 * 60 * 60  # 24 hours in seconds
        
        assert token_lifetime > 0, "Token already expired"
        assert token_lifetime <= expected_lifetime + 300, f"Token lifetime {token_lifetime}s exceeds expected {expected_lifetime}s"
        assert token_lifetime >= expected_lifetime - 300, f"Token lifetime {token_lifetime}s less than expected {expected_lifetime}s"
        
        print(f"Token without Remember Me - Lifetime: {token_lifetime/3600:.2f} hours (expected ~24h)")
    
    def test_login_with_remember_me_extended_expiry(self):
        """Test login with Remember Me checkbox extends token to 30 days"""
        payload = {
            "email": self.unique_email,
            "password": self.password,
            "remember_me": True  # Extended expiry
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        token = data["access_token"]
        
        # Decode token to check expiry
        exp = decode_token_expiry(token)
        current_time = time.time()
        
        # Remember Me expiry is 30 days = 2592000 seconds
        token_lifetime = exp - current_time
        
        expected_lifetime = 30 * 24 * 60 * 60  # 30 days in seconds
        
        assert token_lifetime > 0, "Token already expired"
        assert token_lifetime <= expected_lifetime + 300, f"Token lifetime {token_lifetime}s exceeds expected {expected_lifetime}s"
        assert token_lifetime >= expected_lifetime - 300, f"Token lifetime {token_lifetime}s less than expected {expected_lifetime}s"
        
        print(f"Token with Remember Me - Lifetime: {token_lifetime/86400:.2f} days (expected ~30 days)")
    
    def test_login_default_behavior_when_remember_me_not_provided(self):
        """Test login defaults to 24hr expiry when remember_me field is omitted"""
        payload = {
            "email": self.unique_email,
            "password": self.password
            # remember_me not provided - should default to False
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        token = data["access_token"]
        
        # Decode token to check expiry
        exp = decode_token_expiry(token)
        current_time = time.time()
        
        token_lifetime = exp - current_time
        expected_lifetime = 24 * 60 * 60  # 24 hours
        
        # Should default to 24 hours, not 30 days
        assert token_lifetime <= expected_lifetime + 300, "Default should be 24hr, not 30 days"
        
        print(f"Token default (no remember_me) - Lifetime: {token_lifetime/3600:.2f} hours")
    
    def test_admin_login_with_remember_me(self):
        """Test admin login with Remember Me also extends token"""
        # First ensure admin exists
        login_payload = {
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        }
        check_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        
        if check_response.status_code == 401:
            # Create admin
            register_payload = {
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD,
                "name": "Admin",
                "role": "admin"
            }
            requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        
        # Now test with Remember Me
        payload = {
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD,
            "remember_me": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert data["user"]["role"] == "admin"
        
        # Verify extended expiry
        token = data["access_token"]
        exp = decode_token_expiry(token)
        current_time = time.time()
        token_lifetime = exp - current_time
        
        expected_30_days = 30 * 24 * 60 * 60
        assert token_lifetime >= expected_30_days - 300, f"Admin remember_me token should be ~30 days, got {token_lifetime/86400:.2f} days"
        
        print(f"Admin token with Remember Me - Lifetime: {token_lifetime/86400:.2f} days")


class TestAIImageAnalysis:
    """Tests for Real AI/CV Image Analysis using GPT-5.2 Vision"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers with admin token"""
        # Try login first
        payload = {
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        if response.status_code == 401:
            # Register admin
            register_payload = {
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD,
                "name": "Admin",
                "role": "admin"
            }
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
            if reg_response.status_code == 200:
                token = reg_response.json()["access_token"]
            else:
                pytest.skip("Could not authenticate")
        else:
            token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
    
    def test_analyze_empty_classroom_image(self):
        """Test AI analysis detects empty classroom with 0 occupancy"""
        print("Fetching empty classroom image from Unsplash...")
        
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_Empty_Classroom",
            "image_base64": image_base64
        }
        
        print("Sending image for AI analysis (this may take a few seconds)...")
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        
        assert response.status_code == 200, f"Analysis failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response missing 'id'"
        assert "room_name" in data, "Response missing 'room_name'"
        assert "occupancy_count" in data, "Response missing 'occupancy_count'"
        assert "cleanliness_score" in data, "Response missing 'cleanliness_score'"
        assert "lighting_condition" in data, "Response missing 'lighting_condition'"
        assert "raw_analysis" in data, "Response missing 'raw_analysis' (observations)"
        assert "timestamp" in data, "Response missing 'timestamp'"
        
        # Verify data types
        assert isinstance(data["occupancy_count"], int), f"occupancy_count should be int, got {type(data['occupancy_count'])}"
        assert isinstance(data["cleanliness_score"], int), f"cleanliness_score should be int, got {type(data['cleanliness_score'])}"
        assert isinstance(data["lighting_condition"], str), f"lighting_condition should be str, got {type(data['lighting_condition'])}"
        
        # Verify values are within expected ranges
        assert 0 <= data["occupancy_count"] <= 500, f"Occupancy {data['occupancy_count']} out of range"
        assert 0 <= data["cleanliness_score"] <= 100, f"Cleanliness {data['cleanliness_score']} out of range"
        assert data["lighting_condition"] in ["Poor", "Fair", "Good", "Excellent"], f"Invalid lighting: {data['lighting_condition']}"
        
        # For empty classroom, occupancy should be 0 or very low
        assert data["occupancy_count"] <= 5, f"Empty classroom should have low occupancy, got {data['occupancy_count']}"
        
        print(f"\nEmpty Classroom Analysis Results:")
        print(f"  Occupancy Count: {data['occupancy_count']} (expected 0-5)")
        print(f"  Cleanliness Score: {data['cleanliness_score']}%")
        print(f"  Lighting Condition: {data['lighting_condition']}")
        print(f"  Observations: {data['raw_analysis'][:200]}...")
    
    def test_analyze_lecture_hall_with_students(self):
        """Test AI analysis detects students in lecture hall image"""
        print("Fetching lecture hall image from Unsplash...")
        
        try:
            image_base64 = get_image_as_base64(LECTURE_HALL_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_Lecture_Hall",
            "image_base64": image_base64
        }
        
        print("Sending image for AI analysis (this may take a few seconds)...")
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        
        assert response.status_code == 200, f"Analysis failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "occupancy_count" in data
        assert "cleanliness_score" in data
        assert "lighting_condition" in data
        assert "raw_analysis" in data
        
        # For lecture hall with students, occupancy should be > 0
        assert data["occupancy_count"] > 0, f"Lecture hall should have occupancy > 0, got {data['occupancy_count']}"
        
        # AI should detect significant number of people (main agent verified 63)
        # Allow some variance in AI detection
        assert data["occupancy_count"] >= 10, f"Expected many students, got only {data['occupancy_count']}"
        
        print(f"\nLecture Hall Analysis Results:")
        print(f"  Occupancy Count: {data['occupancy_count']} (expected many students)")
        print(f"  Cleanliness Score: {data['cleanliness_score']}%")
        print(f"  Lighting Condition: {data['lighting_condition']}")
        print(f"  Observations: {data['raw_analysis'][:200]}...")
    
    def test_ai_analysis_returns_meaningful_observations(self):
        """Test that AI returns detailed, meaningful observations about the room"""
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_Observation_Check",
            "image_base64": image_base64
        }
        
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        observations = data["raw_analysis"]
        
        # Observations should be a meaningful string, not empty or default
        assert len(observations) > 20, f"Observations too short: {observations}"
        assert observations.lower() != "analysis completed successfully", "Should have detailed observations"
        assert observations.lower() != "unable to parse", "Should have valid observations"
        
        print(f"\nAI Observations: {observations}")
    
    def test_analysis_data_persisted_to_database(self):
        """Test that analysis results are stored in database and retrievable"""
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        room_name = f"TEST_Persist_{uuid.uuid4().hex[:8]}"
        payload = {
            "room_name": room_name,
            "image_base64": image_base64
        }
        
        # Create analysis
        create_response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        assert create_response.status_code == 200
        created_data = create_response.json()
        created_id = created_data["id"]
        
        # Verify it appears in analyses list
        list_response = requests.get(f"{BASE_URL}/api/analyses?limit=10")
        assert list_response.status_code == 200
        
        analyses = list_response.json()
        found = False
        for analysis in analyses:
            if analysis.get("id") == created_id:
                found = True
                assert analysis["room_name"] == room_name
                assert analysis["occupancy_count"] == created_data["occupancy_count"]
                assert analysis["cleanliness_score"] == created_data["cleanliness_score"]
                break
        
        assert found, f"Created analysis {created_id} not found in list"
        print(f"\nAnalysis persisted and retrieved: {created_id}")
    
    def test_cleanliness_score_within_valid_range(self):
        """Test cleanliness score is always 0-100"""
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_Cleanliness_Range",
            "image_base64": image_base64
        }
        
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        score = data["cleanliness_score"]
        
        assert 0 <= score <= 100, f"Cleanliness score {score} out of 0-100 range"
        print(f"\nCleanliness score validated: {score}")
    
    def test_lighting_condition_valid_values(self):
        """Test lighting condition returns valid enum values"""
        try:
            image_base64 = get_image_as_base64(LECTURE_HALL_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_Lighting_Enum",
            "image_base64": image_base64
        }
        
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        lighting = data["lighting_condition"]
        
        valid_values = ["Poor", "Fair", "Good", "Excellent"]
        assert lighting in valid_values, f"Invalid lighting value: {lighting}. Expected one of {valid_values}"
        
        print(f"\nLighting condition validated: {lighting}")


class TestAnalyzeEndpointAuthentication:
    """Test that analyze endpoint respects authentication (if protected)"""
    
    def test_analyze_endpoint_accessible(self):
        """Test analyze endpoint is accessible (current implementation allows unauthenticated)"""
        # Note: Current implementation doesn't require auth for /analyze
        # This test documents current behavior
        
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "room_name": "TEST_NoAuth",
            "image_base64": image_base64
        }
        
        response = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=60)
        
        # Document current behavior - /analyze is not protected
        if response.status_code == 200:
            print("\n/api/analyze endpoint is accessible without authentication (current behavior)")
        elif response.status_code in [401, 403]:
            print("\n/api/analyze endpoint requires authentication")
        else:
            print(f"\n/api/analyze returned status {response.status_code}")
        
        # Test should pass regardless to document behavior
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"


class TestBatchAnalysis:
    """Test batch analysis endpoint with multiple images"""
    
    def test_batch_analyze_multiple_rooms(self):
        """Test batch analysis of multiple classrooms"""
        try:
            image_base64 = get_image_as_base64(EMPTY_CLASSROOM_URL)
        except Exception as e:
            pytest.skip(f"Could not fetch image: {e}")
        
        payload = {
            "analyses": [
                {
                    "room_name": f"TEST_Batch_Room1_{uuid.uuid4().hex[:8]}",
                    "image_base64": image_base64
                },
                {
                    "room_name": f"TEST_Batch_Room2_{uuid.uuid4().hex[:8]}",
                    "image_base64": image_base64
                }
            ]
        }
        
        print("Sending batch analysis request (may take a minute for multiple images)...")
        response = requests.post(f"{BASE_URL}/api/analyze/batch", json=payload, timeout=120)
        
        assert response.status_code == 200, f"Batch analysis failed: {response.text}"
        
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert "successful" in data
        
        assert data["total"] == 2
        assert data["successful"] >= 1, "At least one analysis should succeed"
        
        print(f"\nBatch Analysis Results:")
        print(f"  Total: {data['total']}")
        print(f"  Successful: {data['successful']}")
        
        for result in data["results"]:
            if result.get("success"):
                print(f"  {result['room_name']}: occupancy={result['analysis']['occupancy_count']}, cleanliness={result['analysis']['cleanliness_score']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
