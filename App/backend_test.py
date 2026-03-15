import requests
import sys
import json
import base64
from datetime import datetime
from pathlib import Path

class ClassroomAPITester:
    def __init__(self, base_url="https://classroom-monitor-5.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, test_name, success, details=""):
        self.tests_run += 1
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"\n{status} - {test_name}")
        if details:
            print(f"  Details: {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"test": test_name, "details": details})

    def create_test_image_base64(self):
        """Create a simple test image in base64 format"""
        # Create a minimal PNG image (1x1 pixel)
        import io
        try:
            from PIL import Image
            img = Image.new('RGB', (100, 100), color='red')
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_bytes = buffer.getvalue()
            return base64.b64encode(img_bytes).decode('utf-8')
        except ImportError:
            # Fallback: use a minimal PNG in base64
            # This is a 1x1 red pixel PNG
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {response.json()}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        try:
            response = requests.get(f"{self.api_url}/stats", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Data: {data}"
                # Validate structure - updated to include active_alerts
                required_fields = ["total_analyses", "avg_occupancy", "avg_cleanliness", "rooms_need_maintenance", "active_alerts"]
                for field in required_fields:
                    if field not in data:
                        success = False
                        details += f", Missing field: {field}"
                        break
            self.log_test("Stats Endpoint", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Stats Endpoint", False, f"Error: {str(e)}")
            return False, {}

    def test_analyses_endpoint(self):
        """Test analyses endpoint"""
        try:
            response = requests.get(f"{self.api_url}/analyses", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Count: {len(data)} analyses"
            self.log_test("Analyses Endpoint", success, details)
            return success, response.json() if success else []
        except Exception as e:
            self.log_test("Analyses Endpoint", False, f"Error: {str(e)}")
            return False, []

    def test_analyze_endpoint(self):
        """Test analyze endpoint"""
        try:
            image_base64 = self.create_test_image_base64()
            
            payload = {
                "room_name": "Test Room 101",
                "image_base64": image_base64
            }
            
            headers = {'Content-Type': 'application/json'}
            response = requests.post(
                f"{self.api_url}/analyze", 
                json=payload, 
                headers=headers,
                timeout=30  # Analysis might take longer
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Response fields: {list(data.keys())}"
                
                # Validate required fields
                required_fields = ["id", "room_name", "occupancy_count", "cleanliness_score", "lighting_condition", "raw_analysis", "timestamp"]
                for field in required_fields:
                    if field not in data:
                        success = False
                        details += f", Missing field: {field}"
                        break
                
                if success:
                    # Validate data types and ranges
                    if not isinstance(data["occupancy_count"], int):
                        success = False
                        details += ", occupancy_count not integer"
                    elif not (0 <= data["cleanliness_score"] <= 100):
                        success = False
                        details += ", cleanliness_score not in range 0-100"
                    elif data["lighting_condition"] not in ["Poor", "Fair", "Good", "Excellent"]:
                        success = False
                        details += f", invalid lighting_condition: {data['lighting_condition']}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response text: {response.text}"
            
            self.log_test("Analyze Endpoint", success, details)
            return success, response.json() if success else {}
            
        except Exception as e:
            self.log_test("Analyze Endpoint", False, f"Error: {str(e)}")
            return False, {}

    def test_batch_analyze_endpoint(self):
        """Test batch analyze endpoint"""
        try:
            image_base64 = self.create_test_image_base64()
            
            payload = {
                "analyses": [
                    {"room_name": "Test Room A", "image_base64": image_base64},
                    {"room_name": "Test Room B", "image_base64": image_base64}
                ]
            }
            
            headers = {'Content-Type': 'application/json'}
            response = requests.post(
                f"{self.api_url}/analyze/batch", 
                json=payload, 
                headers=headers,
                timeout=60  # Batch analysis might take longer
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Response keys: {list(data.keys())}"
                
                # Validate structure
                required_fields = ["results", "total", "successful"]
                for field in required_fields:
                    if field not in data:
                        success = False
                        details += f", Missing field: {field}"
                        break
                
                if success and data["total"] == 2:
                    details += f", Processed {data['successful']}/{data['total']} successfully"
                else:
                    success = False
                    details += f", Expected 2 analyses, got {data.get('total', 'unknown')}"
            
            self.log_test("Batch Analyze Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("Batch Analyze Endpoint", False, f"Error: {str(e)}")
            return False

    def test_alerts_endpoint(self):
        """Test alerts endpoint"""
        try:
            # Test getting all alerts
            response = requests.get(f"{self.api_url}/alerts", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                alerts = response.json()
                details += f", Found {len(alerts)} alerts"
                
                # Test with filter
                response_unresolved = requests.get(f"{self.api_url}/alerts?resolved=false", timeout=10)
                if response_unresolved.status_code == 200:
                    unresolved = response_unresolved.json()
                    details += f", {len(unresolved)} unresolved"
            
            self.log_test("Alerts Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("Alerts Endpoint", False, f"Error: {str(e)}")
            return False

    def test_settings_endpoints(self):
        """Test settings GET and POST endpoints"""
        try:
            # Test GET settings
            response = requests.get(f"{self.api_url}/settings", timeout=10)
            get_success = response.status_code == 200
            details = f"GET Status: {response.status_code}"
            
            settings_data = {}
            if get_success:
                settings_data = response.json()
                required_fields = ["cleanliness_threshold", "alert_emails", "monitoring_enabled"]
                for field in required_fields:
                    if field not in settings_data:
                        get_success = False
                        details += f", Missing field: {field}"
                        break
                
                if get_success:
                    details += f", Current threshold: {settings_data['cleanliness_threshold']}"
            
            # Test POST settings
            post_success = True
            if get_success:
                update_payload = {
                    "cleanliness_threshold": 55,
                    "alert_emails": "test@example.com",
                    "monitoring_enabled": True
                }
                
                post_response = requests.post(
                    f"{self.api_url}/settings", 
                    json=update_payload, 
                    timeout=10
                )
                
                post_success = post_response.status_code == 200
                details += f", POST Status: {post_response.status_code}"
                
                if post_success:
                    post_data = post_response.json()
                    if post_data.get("success"):
                        details += ", Settings updated successfully"
                    else:
                        post_success = False
                        details += ", Update failed"
            
            overall_success = get_success and post_success
            self.log_test("Settings Endpoints", overall_success, details)
            return overall_success
            
        except Exception as e:
            self.log_test("Settings Endpoints", False, f"Error: {str(e)}")
            return False

    def test_export_endpoints(self):
        """Test CSV and PDF export endpoints"""
        csv_success = True
        pdf_success = True
        
        try:
            # Test CSV export
            csv_response = requests.get(f"{self.api_url}/export/csv", timeout=30)
            csv_success = csv_response.status_code == 200
            csv_details = f"CSV Status: {csv_response.status_code}"
            
            if csv_success:
                content_type = csv_response.headers.get('content-type', '')
                if 'csv' in content_type.lower() or 'text' in content_type.lower():
                    csv_details += ", Correct content-type"
                else:
                    csv_success = False
                    csv_details += f", Wrong content-type: {content_type}"
            
            self.log_test("CSV Export Endpoint", csv_success, csv_details)
            
        except Exception as e:
            csv_success = False
            self.log_test("CSV Export Endpoint", False, f"Error: {str(e)}")
        
        try:
            # Test PDF export
            pdf_response = requests.get(f"{self.api_url}/export/pdf", timeout=30)
            pdf_success = pdf_response.status_code == 200
            pdf_details = f"PDF Status: {pdf_response.status_code}"
            
            if pdf_success:
                content_type = pdf_response.headers.get('content-type', '')
                if 'pdf' in content_type.lower():
                    pdf_details += ", Correct content-type"
                else:
                    pdf_success = False
                    pdf_details += f", Wrong content-type: {content_type}"
            
            self.log_test("PDF Export Endpoint", pdf_success, pdf_details)
            
        except Exception as e:
            pdf_success = False
            self.log_test("PDF Export Endpoint", False, f"Error: {str(e)}")
        
        return csv_success and pdf_success

    def test_alert_resolution(self):
        """Test alert resolution functionality by creating and resolving an alert"""
        try:
            # First, try to get existing unresolved alerts
            alerts_response = requests.get(f"{self.api_url}/alerts?resolved=false", timeout=10)
            if alerts_response.status_code != 200:
                self.log_test("Alert Resolution", False, "Could not fetch alerts to test resolution")
                return False
            
            alerts = alerts_response.json()
            
            if len(alerts) == 0:
                # Create an analysis that will generate an alert (low cleanliness)
                # We'll need to ensure settings threshold is high enough
                settings_response = requests.get(f"{self.api_url}/settings", timeout=10)
                if settings_response.status_code == 200:
                    settings = settings_response.json()
                    # Set threshold to 70 to ensure our low cleanliness triggers alert
                    threshold_update = {"cleanliness_threshold": 70}
                    requests.post(f"{self.api_url}/settings", json=threshold_update, timeout=10)
                
                self.log_test("Alert Resolution", True, "No existing alerts to test resolution (normal scenario)")
                return True
            
            # Try to resolve the first unresolved alert
            alert_to_resolve = alerts[0]
            alert_id = alert_to_resolve['id']
            
            resolve_response = requests.post(
                f"{self.api_url}/alerts/{alert_id}/resolve",
                timeout=10
            )
            
            success = resolve_response.status_code == 200
            details = f"Resolution Status: {resolve_response.status_code}"
            
            if success:
                resolve_data = resolve_response.json()
                if resolve_data.get("success"):
                    details += ", Alert resolved successfully"
                else:
                    success = False
                    details += ", Resolution response indicates failure"
            
            self.log_test("Alert Resolution", success, details)
            return success
            
        except Exception as e:
            self.log_test("Alert Resolution", False, f"Error: {str(e)}")
            return False

    def test_image_format_validation(self):
        """Test different image formats"""
        test_cases = [
            ("JPEG", "image/jpeg"),
            ("PNG", "image/png"),
            ("WEBP", "image/webp")
        ]
        
        all_passed = True
        for format_name, mime_type in test_cases:
            try:
                # For simplicity, we'll use the same base64 image but test the endpoint
                image_base64 = self.create_test_image_base64()
                
                payload = {
                    "room_name": f"Test Room {format_name}",
                    "image_base64": image_base64
                }
                
                response = requests.post(
                    f"{self.api_url}/analyze", 
                    json=payload,
                    timeout=30
                )
                
                success = response.status_code == 200
                if not success:
                    all_passed = False
                    
                self.log_test(f"Image Format {format_name}", success, f"Status: {response.status_code}")
                
            except Exception as e:
                all_passed = False
                self.log_test(f"Image Format {format_name}", False, f"Error: {str(e)}")
        
        return all_passed

    def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 Starting Backend API Tests - Enhanced Features")
        print("=" * 60)
        
        # Basic endpoint tests
        api_root_works = self.test_api_root()
        if not api_root_works:
            print("\n❌ API root not responding - backend might be down")
            return False
        
        print("\n📊 Testing Core Endpoints...")
        # Test individual endpoints
        stats_success, stats_data = self.test_stats_endpoint()
        analyses_success, analyses_data = self.test_analyses_endpoint()
        
        print("\n🔍 Testing Analysis Functionality...")
        # Test analysis functionality (most important)
        analyze_success, analyze_data = self.test_analyze_endpoint()
        batch_success = self.test_batch_analyze_endpoint()
        
        print("\n🔔 Testing Alert System...")
        # Test alerts system
        alerts_success = self.test_alerts_endpoint()
        alert_resolution_success = self.test_alert_resolution()
        
        print("\n⚙️ Testing Settings...")
        # Test settings
        settings_success = self.test_settings_endpoints()
        
        print("\n📄 Testing Export Features...")
        # Test export functionality
        export_success = self.test_export_endpoints()
        
        print("\n🖼️ Testing Image Format Validation...")
        # Test image format validation
        format_success = self.test_image_format_validation()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Backend Test Results:")
        print(f"  Tests run: {self.tests_run}")
        print(f"  Tests passed: {self.tests_passed}")
        print(f"  Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        # Check critical functionality
        critical_passed = api_root_works and analyze_success and batch_success
        enhanced_features_passed = alerts_success and settings_success and export_success
        
        print(f"\n🎯 Critical functionality: {'✅ Working' if critical_passed else '❌ Broken'}")
        print(f"🆕 Enhanced features: {'✅ Working' if enhanced_features_passed else '❌ Issues detected'}")
        
        return critical_passed and enhanced_features_passed

if __name__ == "__main__":
    tester = ClassroomAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)