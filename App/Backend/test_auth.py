"""
Backend API Tests for JWT Authentication System
Tests: Registration, Login, Token Validation, Role-Based Access Control
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://classroom-monitor-5.preview.emergentagent.com')

# Test data
TEST_USER_EMAIL = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Test User"
TEST_ADMIN_EMAIL = "admin@classroom.com"
TEST_ADMIN_PASSWORD = "admin123"


class TestHealthCheck:
    """Health check tests - run first"""
    
    def test_api_root(self):
        """Test if API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root response: {data}")


class TestUserRegistration:
    """User registration endpoint tests"""
    
    def test_register_new_user_success(self):
        """Test successful user registration"""
        unique_email = f"TEST_reg_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User Registration",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Access token missing in response"
        assert "user" in data, "User data missing in response"
        assert data["token_type"] == "bearer"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == unique_email
        assert user["name"] == "Test User Registration"
        assert user["role"] == "user"
        assert "id" in user
        assert "created_at" in user
        
        print(f"User registered successfully: {user['email']}")
        return data["access_token"]
    
    def test_register_admin_user_success(self):
        """Test admin user registration"""
        unique_email = f"TEST_admin_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "adminpass123",
            "name": "Test Admin",
            "role": "admin"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Admin registration failed: {response.text}"
        data = response.json()
        
        assert data["user"]["role"] == "admin"
        print(f"Admin user registered: {data['user']['email']}")
    
    def test_register_duplicate_email_fails(self):
        """Test that duplicate email registration fails"""
        unique_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "First User",
            "role": "user"
        }
        
        # First registration should succeed
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response1.status_code == 200
        
        # Second registration with same email should fail
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response2.status_code == 400
        assert "already registered" in response2.json().get("detail", "").lower()
        print("Duplicate email correctly rejected")
    
    def test_register_short_password_fails(self):
        """Test that short password registration fails"""
        payload = {
            "email": f"TEST_short_{uuid.uuid4().hex[:8]}@test.com",
            "password": "12345",  # Less than 6 characters
            "name": "Short Password User",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 422, f"Expected validation error, got: {response.status_code}"
        print("Short password correctly rejected")
    
    def test_register_invalid_email_fails(self):
        """Test that invalid email registration fails"""
        payload = {
            "email": "not-an-email",
            "password": "testpass123",
            "name": "Invalid Email User",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 422, f"Expected validation error, got: {response.status_code}"
        print("Invalid email correctly rejected")


class TestUserLogin:
    """User login endpoint tests"""
    
    @pytest.fixture
    def created_user(self):
        """Create a test user for login tests"""
        unique_email = f"TEST_login_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "loginpass123",
            "name": "Login Test User",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        return {"email": unique_email, "password": "loginpass123"}
    
    def test_login_success(self, created_user):
        """Test successful login with valid credentials"""
        payload = {
            "email": created_user["email"],
            "password": created_user["password"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == created_user["email"]
        
        print(f"Login successful for: {created_user['email']}")
    
    def test_login_wrong_password_fails(self, created_user):
        """Test login fails with wrong password"""
        payload = {
            "email": created_user["email"],
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 401
        assert "incorrect" in response.json().get("detail", "").lower()
        print("Wrong password correctly rejected")
    
    def test_login_nonexistent_user_fails(self):
        """Test login fails for non-existent user"""
        payload = {
            "email": "nonexistent@test.com",
            "password": "anypassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 401
        print("Non-existent user login correctly rejected")


class TestTokenValidation:
    """JWT token validation tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        unique_email = f"TEST_token_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "tokentest123",
            "name": "Token Test User",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_me_with_valid_token(self, auth_token):
        """Test /auth/me endpoint with valid token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "role" in data
        assert "created_at" in data
        
        print(f"Token validated for user: {data['email']}")
    
    def test_get_me_without_token_fails(self):
        """Test /auth/me fails without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code in [401, 403]
        print("Request without token correctly rejected")
    
    def test_get_me_with_invalid_token_fails(self):
        """Test /auth/me fails with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401
        print("Invalid token correctly rejected")


class TestRoleBasedAccess:
    """Role-based access control tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        unique_email = f"TEST_adminrole_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "admintest123",
            "name": "Admin Role Test",
            "role": "admin"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def user_token(self):
        """Get regular user authentication token"""
        unique_email = f"TEST_userrole_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "usertest123",
            "name": "User Role Test",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_can_get_all_users(self, admin_token):
        """Test admin can access /auth/users endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "email" in data[0]
            assert "role" in data[0]
        
        print(f"Admin retrieved {len(data)} users")
    
    def test_regular_user_cannot_get_all_users(self, user_token):
        """Test regular user cannot access /auth/users endpoint"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
        
        assert response.status_code == 403
        assert "admin" in response.json().get("detail", "").lower()
        print("Regular user correctly denied admin endpoint access")
    
    def test_admin_can_update_user_role(self, admin_token, user_token):
        """Test admin can update another user's role"""
        # First get user info with user token
        headers_user = {"Authorization": f"Bearer {user_token}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers_user)
        user_id = me_response.json()["id"]
        
        # Admin updates user role
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/auth/users/{user_id}/role?role=admin", 
            headers=headers_admin
        )
        
        assert response.status_code == 200
        assert "updated" in response.json().get("message", "").lower()
        print(f"Admin successfully updated user {user_id} role")
    
    def test_admin_cannot_delete_self(self, admin_token):
        """Test admin cannot delete themselves"""
        # Get admin's own ID
        headers = {"Authorization": f"Bearer {admin_token}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        admin_id = me_response.json()["id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/auth/users/{admin_id}", headers=headers)
        
        assert response.status_code == 400
        assert "cannot delete yourself" in response.json().get("detail", "").lower()
        print("Admin correctly prevented from self-deletion")


class TestExistingAdminUser:
    """Test with provided admin credentials"""
    
    def test_login_with_provided_admin(self):
        """Test login with provided admin@classroom.com credentials"""
        payload = {
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        # If admin doesn't exist, create one
        if response.status_code == 401:
            print("Pre-created admin not found, creating one...")
            register_payload = {
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD,
                "name": "Admin",
                "role": "admin"
            }
            register_response = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
            if register_response.status_code == 200:
                print("Admin user created successfully")
                # Now try to login again
                response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
            elif register_response.status_code == 400:
                print("Admin already exists but password mismatch")
                pytest.skip("Admin exists with different password")
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
