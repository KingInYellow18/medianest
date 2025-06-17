#!/usr/bin/env python3
"""
MediaNest Backend User Profile Management Tests
Implements **Targeted Testing Strategy** for :ResourcePattern + :CRUDOperations + :SecurityFirst
Tests UserProfileResource, UserProfileSchema validation, mock data layer, and input sanitization
"""

import pytest
import json
import os
import uuid
import re
from datetime import datetime
from unittest.mock import patch, MagicMock
from flask import Flask
from marshmallow import ValidationError

# Import the Flask app
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.app import create_app


class TestUserProfileManagement:
    """
    TARGETED TESTING STRATEGY for User Profile Management
    
    🔹 CORE LOGIC TESTING:
    - UserProfileResource GET/PUT operations (/api/v1/users/{user_id}/profile)
    - UserProfileSchema validation (email, username, bio length, URL validation, nested metadata)
    - Mock data layer operations (retrieve, update) with sample profiles
    - Input sanitization functions (sanitize_text_input)
    - URL parameter validation (user_id regex patterns, injection attempts)
    - Error handling (400, 404, 422 responses with proper JSON structure)
    
    🔹 CONTEXTUAL INTEGRATION TESTING:
    - API Foundation Compatibility (works alongside existing endpoints)
    - Response Format Consistency (api_response helper integration)
    - Flask-RESTful Integration (Resource class routing)
    - Request ID Tracking (middleware compatibility)
    - CORS Configuration (profile endpoints support)
    """
    
    @pytest.fixture
    def app(self):
        """Create Flask app instance for testing"""
        # Set test environment variables (:SecurityFirst)
        os.environ['FLASK_ENV'] = 'testing'
        os.environ['FLASK_DEBUG'] = 'false'
        os.environ['CORS_ORIGINS'] = 'http://localhost:3000,http://localhost:3001'
        
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    # =============================================================================
    # 🔹 CORE LOGIC TESTING
    # =============================================================================
    
    def test_user_profile_get_valid_user(self, client):
        """
        CORE LOGIC: Test GET /api/v1/users/{user_id}/profile for existing user
        Validates successful profile retrieval with proper JSON structure
        Targets :LogicError and :ValidationError
        """
        # Test with existing user from mock data
        response = client.get('/api/v1/users/user_123/profile')
        
        # Verify HTTP status
        assert response.status_code == 200
        assert response.content_type == 'application/json'
        
        # Parse and validate response structure
        data = json.loads(response.data)
        
        # Verify standardized API response format
        required_fields = ['data', 'message', 'status', 'request_id', 'timestamp']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify response content
        assert data['status'] == 'success'
        assert data['message'] == 'User profile retrieved successfully'
        assert data['data'] is not None
        
        # Verify profile data structure
        profile_data = data['data']
        assert profile_data['user_id'] == 'user_123'
        assert profile_data['username'] == 'test_user'
        assert profile_data['email'] == 'test@medianest.com'
        assert 'display_name' in profile_data
        assert 'bio' in profile_data
        assert 'created_at' in profile_data
        assert 'updated_at' in profile_data
        
        # Verify nested metadata fields
        assert 'location' in profile_data
        assert 'website' in profile_data
        assert 'social_links' in profile_data
    
    def test_user_profile_get_nonexistent_user(self, client):
        """
        CORE LOGIC: Test GET /api/v1/users/{user_id}/profile for non-existent user
        Validates 404 error handling with proper JSON structure
        Targets :LogicError and :ValidationError
        """
        response = client.get('/api/v1/users/nonexistent_user/profile')
        
        # Verify HTTP status
        assert response.status_code == 404
        assert response.content_type == 'application/json'
        
        # Parse and validate error response
        data = json.loads(response.data)
        
        # Verify error response structure
        assert data['status'] == 'error'
        assert data['message'] == 'User profile not found'
        assert data['data'] is None
        assert 'request_id' in data
        assert 'timestamp' in data
    
    def test_user_profile_get_invalid_user_id_format(self, client):
        """
        CORE LOGIC: Test GET with invalid user_id format (security validation)
        Validates parameter validation prevents :SecurityVulnerability
        Targets :SecurityVulnerability and :ValidationError
        """
        invalid_user_ids = [
            'user<script>',  # XSS attempt
            'user;DROP TABLE users;',  # SQL injection attempt
            'user@#$%',  # Invalid characters
            '',  # Empty string
            'user with spaces',  # Spaces not allowed
        ]
        
        for invalid_id in invalid_user_ids:
            response = client.get(f'/api/v1/users/{invalid_id}/profile')
            
            # Should return 400 Bad Request
            assert response.status_code == 400
            
            data = json.loads(response.data)
            assert data['status'] == 'error'
            assert data['message'] == 'Invalid user ID format'
            assert data['data'] is None
    
    def test_user_profile_put_valid_update(self, client):
        """
        CORE LOGIC: Test PUT /api/v1/users/{user_id}/profile with valid data
        Validates successful profile update with sanitization
        Targets :LogicError and :ValidationError
        """
        update_data = {
            'display_name': 'Updated Test User',
            'bio': 'Updated bio for testing',
            'location': 'Updated Location',
            'website': 'https://updated-example.com'
        }
        
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps(update_data),
                            content_type='application/json')
        
        # Verify HTTP status
        assert response.status_code == 200
        assert response.content_type == 'application/json'
        
        # Parse and validate response
        data = json.loads(response.data)
        
        # Verify response structure
        assert data['status'] == 'success'
        assert data['message'] == 'User profile updated successfully'
        assert data['data'] is not None
        
        # Verify updated data
        profile_data = data['data']
        assert profile_data['display_name'] == 'Updated Test User'
        assert profile_data['bio'] == 'Updated bio for testing'
        assert profile_data['location'] == 'Updated Location'
        assert profile_data['website'] == 'https://updated-example.com'
        
        # Verify updated_at timestamp was updated
        assert 'updated_at' in profile_data
        updated_at = datetime.fromisoformat(profile_data['updated_at'].replace('Z', '+00:00'))
        assert updated_at is not None
    
    def test_user_profile_schema_validation_email(self, app):
        """
        CORE LOGIC: Test UserProfileSchema email validation
        Validates Marshmallow email field validation
        Targets :ValidationError and :SecurityVulnerability
        """
        with app.app_context():
            from backend.app import UserProfileSchema
            
            schema = UserProfileSchema()
            
            # Valid email should pass
            valid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'valid@example.com'
            }
            result = schema.load(valid_data, partial=True)
            assert result is not None
            
            # Invalid email should raise ValidationError
            invalid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'invalid-email-format'
            }
            with pytest.raises(ValidationError):
                schema.load(invalid_data)
    
    def test_user_profile_schema_validation_username(self, app):
        """
        CORE LOGIC: Test UserProfileSchema username validation
        Validates username constraints (length, characters)
        Targets :ValidationError and :SecurityVulnerability
        """
        with app.app_context():
            from backend.app import UserProfileSchema
            
            schema = UserProfileSchema()
            
            # Valid username should pass
            valid_data = {
                'user_id': 'test_123',
                'username': 'valid_user123',
                'email': 'test@example.com'
            }
            result = schema.load(valid_data, partial=True)
            assert result is not None
            
            # Invalid usernames should raise ValidationError
            invalid_usernames = [
                'ab',  # Too short
                'a' * 31,  # Too long
                'user@invalid',  # Invalid characters
                'user with spaces'  # Spaces not allowed
            ]
            
            for invalid_username in invalid_usernames:
                invalid_data = {
                    'user_id': 'test_123',
                    'username': invalid_username,
                    'email': 'test@example.com'
                }
                with pytest.raises(ValidationError):
                    schema.load(invalid_data)
    
    def test_user_profile_schema_validation_bio_length(self, app):
        """
        CORE LOGIC: Test UserProfileSchema bio length validation
        Validates bio field length limits
        Targets :ValidationError
        """
        with app.app_context():
            from backend.app import UserProfileSchema
            
            schema = UserProfileSchema()
            
            # Valid bio should pass
            valid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'test@example.com',
                'bio': 'This is a valid bio'
            }
            result = schema.load(valid_data, partial=True)
            assert result is not None
            
            # Bio too long should raise ValidationError
            invalid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'test@example.com',
                'bio': 'x' * 501  # Exceeds 500 character limit
            }
            with pytest.raises(ValidationError):
                schema.load(invalid_data)
    
    def test_user_profile_schema_url_validation(self, app):
        """
        CORE LOGIC: Test UserProfileSchema URL validation for avatar_url and website
        Validates URL field validation
        Targets :ValidationError and :SecurityVulnerability
        """
        with app.app_context():
            from backend.app import UserProfileSchema
            
            schema = UserProfileSchema()
            
            # Valid URLs should pass
            valid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'test@example.com',
                'avatar_url': 'https://example.com/avatar.jpg',
                'website': 'https://example.com'
            }
            result = schema.load(valid_data, partial=True)
            assert result is not None
            
            # Invalid URLs should raise ValidationError
            invalid_data = {
                'user_id': 'test_123',
                'username': 'testuser',
                'email': 'test@example.com',
                'avatar_url': 'not-a-valid-url'
            }
            with pytest.raises(ValidationError):
                schema.load(invalid_data)
    
    def test_input_sanitization_function(self, app):
        """
        CORE LOGIC: Test sanitize_text_input function
        Validates XSS prevention and dangerous character removal
        Targets :SecurityVulnerability
        """
        with app.app_context():
            from backend.app import sanitize_text_input
            
            # Test XSS prevention
            malicious_input = '<script>alert("xss")</script>Hello'
            sanitized = sanitize_text_input(malicious_input)
            assert '<script>' not in sanitized
            assert 'alert("xss")' not in sanitized
            assert 'Hello' in sanitized
            
            # Test dangerous character removal
            dangerous_input = 'Hello<>"\'World'
            sanitized = sanitize_text_input(dangerous_input)
            assert '<' not in sanitized
            assert '>' not in sanitized
            assert '"' not in sanitized
            assert "'" not in sanitized
            assert 'HelloWorld' in sanitized
            
            # Test None input
            assert sanitize_text_input(None) is None
            
            # Test empty string
            assert sanitize_text_input('') == ''
    
    def test_user_profile_put_input_sanitization(self, client):
        """
        CORE LOGIC: Test PUT endpoint input sanitization
        Validates that malicious input is sanitized before storage
        Targets :SecurityVulnerability
        """
        malicious_data = {
            'display_name': '<script>alert("xss")</script>Malicious User',
            'bio': 'Bio with <script>dangerous</script> content',
            'location': 'Location<>"with\'quotes'
        }
        
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps(malicious_data),
                            content_type='application/json')
        
        # Should succeed but with sanitized data
        assert response.status_code == 200
        
        data = json.loads(response.data)
        profile_data = data['data']
        
        # Verify malicious content was sanitized
        assert '<script>' not in profile_data['display_name']
        assert 'alert("xss")' not in profile_data['display_name']
        assert '<script>' not in profile_data['bio']
        assert 'dangerous' not in profile_data['bio']
        assert '<' not in profile_data['location']
        assert '>' not in profile_data['location']
        assert '"' not in profile_data['location']
        assert "'" not in profile_data['location']
    
    def test_user_profile_put_validation_errors(self, client):
        """
        CORE LOGIC: Test PUT endpoint validation error handling
        Validates 422 responses for validation failures
        Targets :ValidationError
        """
        # Test invalid email format
        invalid_data = {
            'email': 'invalid-email-format'
        }
        
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps(invalid_data),
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Invalid email format' in data['message']
        
        # Test invalid username format
        invalid_data = {
            'username': 'ab'  # Too short
        }
        
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps(invalid_data),
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Username must be 3-30 characters' in data['message']
    
    def test_mock_data_layer_operations(self, client):
        """
        CORE LOGIC: Test mock data storage operations
        Validates in-memory storage retrieve and update operations
        Targets :LogicError and :DataIntegrityError
        """
        # Test retrieval of existing data
        response = client.get('/api/v1/users/user_456/profile')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        profile_data = data['data']
        assert profile_data['user_id'] == 'user_456'
        assert profile_data['username'] == 'demo_user'
        
        # Test update operation
        update_data = {'display_name': 'Updated Demo User'}
        response = client.put('/api/v1/users/user_456/profile',
                            data=json.dumps(update_data),
                            content_type='application/json')
        
        assert response.status_code == 200
        
        # Verify update persisted
        response = client.get('/api/v1/users/user_456/profile')
        data = json.loads(response.data)
        assert data['data']['display_name'] == 'Updated Demo User'
    
    # =============================================================================
    # 🔹 CONTEXTUAL INTEGRATION TESTING
    # =============================================================================
    
    def test_api_foundation_compatibility(self, client):
        """
        CONTEXTUAL INTEGRATION: Test compatibility with existing API endpoints
        Validates profile endpoints work alongside /health, /, /api/v1/users/info
        Targets :CompatibilityIssue and :InterfaceMismatch
        """
        # Test existing endpoints still work
        existing_endpoints = [
            '/health',
            '/',
            '/api/v1/users/info'
        ]
        
        for endpoint in existing_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            
            data = json.loads(response.data)
            assert data['status'] == 'success'
            assert 'request_id' in data
            assert 'timestamp' in data
        
        # Test new profile endpoint works
        response = client.get('/api/v1/users/user_123/profile')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
    
    def test_response_format_consistency(self, client):
        """
        CONTEXTUAL INTEGRATION: Test consistent response format with api_response helper
        Validates all responses use established JSON structure
        Targets :InterfaceMismatch
        """
        # Test profile GET response format
        response = client.get('/api/v1/users/user_123/profile')
        data = json.loads(response.data)
        
        # Verify standardized format matches other endpoints
        required_fields = ['data', 'message', 'status', 'request_id', 'timestamp']
        for field in required_fields:
            assert field in data
        
        # Test profile PUT response format
        update_data = {'display_name': 'Format Test User'}
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps(update_data),
                            content_type='application/json')
        
        data = json.loads(response.data)
        for field in required_fields:
            assert field in data
        
        # Test error response format consistency
        response = client.get('/api/v1/users/nonexistent/profile')
        data = json.loads(response.data)
        for field in required_fields:
            assert field in data
        assert data['status'] == 'error'
    
    def test_flask_restful_integration(self, client):
        """
        CONTEXTUAL INTEGRATION: Test Flask-RESTful Resource class integration
        Validates proper routing and method handling
        Targets :CompatibilityIssue and :ConfigurationError
        """
        # Test GET method routing
        response = client.get('/api/v1/users/user_123/profile')
        assert response.status_code == 200
        
        # Test PUT method routing
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps({'display_name': 'Test'}),
                            content_type='application/json')
        assert response.status_code == 200
        
        # Test unsupported method (POST should return 405)
        response = client.post('/api/v1/users/user_123/profile',
                             data=json.dumps({'test': 'data'}),
                             content_type='application/json')
        assert response.status_code == 405
        
        # Test unsupported method (DELETE should return 405)
        response = client.delete('/api/v1/users/user_123/profile')
        assert response.status_code == 405
    
    def test_request_id_tracking_integration(self, client):
        """
        CONTEXTUAL INTEGRATION: Test request ID middleware works with profile endpoints
        Validates request tracking functionality
        Targets :ConfigurationError
        """
        # Make multiple profile requests
        response1 = client.get('/api/v1/users/user_123/profile')
        response2 = client.get('/api/v1/users/user_456/profile')
        
        data1 = json.loads(response1.data)
        data2 = json.loads(response2.data)
        
        # Verify unique request IDs
        assert data1['request_id'] != data2['request_id']
        
        # Verify UUID format
        uuid.UUID(data1['request_id'])  # Should not raise exception
        uuid.UUID(data2['request_id'])  # Should not raise exception
        
        # Test PUT request tracking
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps({'display_name': 'Tracked User'}),
                            content_type='application/json')
        
        data = json.loads(response.data)
        assert 'request_id' in data
        uuid.UUID(data['request_id'])  # Should not raise exception
    
    def test_cors_configuration_integration(self, client):
        """
        CONTEXTUAL INTEGRATION: Test CORS headers work with profile endpoints
        Validates CORS configuration for frontend communication
        Targets :CompatibilityIssue and :SecurityVulnerability
        """
        # Test CORS headers on profile GET endpoint
        response = client.options('/api/v1/users/user_123/profile',
                                headers={'Origin': 'http://localhost:3000'})
        
        # Verify CORS headers are present
        assert 'Access-Control-Allow-Origin' in response.headers
        
        # Test profile GET with CORS origin
        response = client.get('/api/v1/users/user_123/profile',
                            headers={'Origin': 'http://localhost:3000'})
        assert response.status_code == 200
        
        # Test profile PUT with CORS origin
        response = client.put('/api/v1/users/user_123/profile',
                            data=json.dumps({'display_name': 'CORS Test'}),
                            content_type='application/json',
                            headers={'Origin': 'http://localhost:3000'})
        assert response.status_code == 200


# =============================================================================
# TEST EXECUTION AND VALIDATION
# =============================================================================

if __name__ == '__main__':
    """
    Execute targeted tests for User Profile Management
    Reports PASS/FAIL status for Boomerang cycle
    """
    pytest.main([__file__, '-v', '--tb=short'])