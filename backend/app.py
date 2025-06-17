#!/usr/bin/env python3
"""
MediaNest Backend - REST API Foundation
Implements :RESTfulAPI + :LayeredArchitecture + :ClientServerPattern
:TechnologyVersion Flask v3.1.x + Python v3.11
:SecurityFirst - No hardcoded secrets, environment-based configuration
"""

import os
import logging
import uuid
import re
from datetime import datetime
from flask import Flask, jsonify, request, g
from flask_restful import Api, Resource, reqparse
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from marshmallow import Schema, fields, ValidationError, EXCLUDE, validate
from dotenv import load_dotenv

# Load environment variables (:SecurityFirst principle)
load_dotenv()

def create_app():
    """
    Flask application factory pattern implementing :RESTfulAPI + :LayeredArchitecture
    Establishes REST API foundation with proper error handling and validation
    """
    app = Flask(__name__)
    
    # Configure logging for debugging and monitoring
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Security-first configuration using environment variables
    app.config.update({
        'SECRET_KEY': os.getenv('FLASK_SECRET_KEY', 'dev-key-change-in-production'),
        'DEBUG': os.getenv('FLASK_DEBUG', 'False').lower() == 'true',
        'ENV': os.getenv('FLASK_ENV', 'development'),
        'HOST': os.getenv('FLASK_HOST', '0.0.0.0'),
        'PORT': int(os.getenv('FLASK_PORT', '5000')),
        # JWT Configuration (:SecurityFirst)
        'JWT_SECRET_KEY': os.getenv('JWT_SECRET_KEY', 'jwt-dev-key-change-in-production'),
        'JWT_ACCESS_TOKEN_EXPIRES': int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', '3600'))
    })
    
    # Initialize Flask-RESTful API with versioning
    api = Api(app, prefix='/api/v1')
    
    # Initialize JWT Manager for authentication preparation (:ConfigurationError fix)
    jwt = JWTManager(app)
    app.jwt_manager = jwt  # Make JWT manager accessible as app.jwt_manager
    
    # CORS configuration for API endpoints (:ClientServerPattern)
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    CORS(app,
         origins=cors_origins,
         supports_credentials=True,
         resources={
             r"/api/*": {
                 "origins": cors_origins,
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization"]
             }
         })
    
    # Request ID middleware for debugging and tracking
    @app.before_request
    def before_request():
        """Generate unique request ID for tracking and debugging"""
        g.request_id = str(uuid.uuid4())
        g.request_start_time = datetime.utcnow()
        app.logger.info(f"Request {g.request_id}: {request.method} {request.path}")
    
    # Standard API response format helper
    def api_response(data=None, message="", status="success", status_code=200):
        """
        Standardized API response format
        Implements consistent JSON structure across all endpoints
        """
        response_data = {
            "data": data,
            "message": message,
            "status": status,
            "request_id": getattr(g, 'request_id', None),
            "timestamp": datetime.utcnow().isoformat()
        }
        return jsonify(response_data), status_code
    
    # API Error handlers with consistent JSON format
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request errors"""
        return api_response(
            data=None,
            message="Bad request - invalid input data",
            status="error",
            status_code=400
        )
    
    @app.errorhandler(401)
    def unauthorized(error):
        """Handle 401 Unauthorized errors"""
        return api_response(
            data=None,
            message="Unauthorized - authentication required",
            status="error",
            status_code=401
        )
    
    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 Forbidden errors"""
        return api_response(
            data=None,
            message="Forbidden - insufficient permissions",
            status="error",
            status_code=403
        )
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found errors (:InterfaceMismatch fix)"""
        return api_response(
            data=None,
            message="Resource not found",
            status="error",
            status_code=404
        )
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Handle 405 Method Not Allowed errors (:InterfaceMismatch fix)"""
        return api_response(
            data=None,
            message="Method not allowed",
            status="error",
            status_code=405
        )
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server errors"""
        app.logger.error(f"Internal server error: {str(error)}")
        return api_response(
            data=None,
            message="Internal server error",
            status="error",
            status_code=500
        )
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        """Handle Marshmallow validation errors"""
        return api_response(
            data={"validation_errors": error.messages},
            message="Input validation failed",
            status="error",
            status_code=400
        )
    
    # Health check endpoint for container orchestration
    @app.route('/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint for Docker/Kubernetes monitoring
        Returns service status and basic metadata
        """
        try:
            return api_response(
                data={
                    'service': 'medianest-backend',
                    'version': '1.0.0',
                    'environment': app.config['ENV'],
                    'api_version': 'v1'
                },
                message="Service is healthy",
                status="success"
            )
        except Exception as e:
            app.logger.error(f"Health check failed: {str(e)}")
            return api_response(
                data=None,
                message="Service health check failed",
                status="error",
                status_code=500
            )
    
    # Root endpoint with API information
    @app.route('/', methods=['GET'])
    def root():
        """
        Root endpoint providing API information and available endpoints
        Implements :RESTfulAPI pattern with service discovery
        """
        return api_response(
            data={
                'service': 'medianest-backend',
                'version': '1.0.0',
                'api_version': 'v1',
                'endpoints': {
                    'health': '/health',
                    'api_base': '/api/v1',
                    'users': '/api/v1/users',
                    'documentation': '/api/docs (coming soon)'
                }
            },
            message="MediaNest Backend API - REST foundation established"
        )
    
    # User Info Schema for validation (:ValidationError fix)
    class UserInfoSchema(Schema):
        """Marshmallow schema for user info validation"""
        class Meta:
            unknown = EXCLUDE  # Allow unknown fields like 'profile' and 'preferences'
        
        user_id = fields.Str(required=False, allow_none=True)
        username = fields.Str(required=False, allow_none=True)
        email = fields.Email(required=False, allow_none=True)
        created_at = fields.DateTime(required=False, allow_none=True)
        profile = fields.Dict(required=False, allow_none=True)
        preferences = fields.Dict(required=False, allow_none=True)
    
    # User Profile Schema for comprehensive validation (:SecurityFirst + :ValidationError)
    class UserProfileSchema(Schema):
        """
        Marshmallow schema for user profile validation
        Implements :SecurityFirst with input sanitization and validation
        """
        class Meta:
            unknown = EXCLUDE  # Ignore unknown fields for security
        
        user_id = fields.Str(required=True, validate=validate.Regexp(r'^[a-zA-Z0-9_-]+$'))
        username = fields.Str(required=True, validate=[
            validate.Length(min=3, max=30),
            validate.Regexp(r'^[a-zA-Z0-9_-]+$', error='Username contains invalid characters')
        ])
        email = fields.Email(required=True)
        display_name = fields.Str(required=False, validate=validate.Length(max=100))
        bio = fields.Str(required=False, validate=validate.Length(max=500))
        avatar_url = fields.Url(required=False, allow_none=True)
        created_at = fields.DateTime(required=False, allow_none=True)
        updated_at = fields.DateTime(required=False, allow_none=True)
        
        # Nested profile metadata with validation
        location = fields.Str(required=False, validate=validate.Length(max=100))
        website = fields.Url(required=False, allow_none=True)
        social_links = fields.Dict(required=False, allow_none=True)
    
    # Mock data storage for user profiles (:MockDataLayer)
    user_profiles_storage = {
        "user_123": {
            "user_id": "user_123",
            "username": "test_user",
            "email": "test@medianest.com",
            "display_name": "Test User",
            "bio": "MediaNest test user account",
            "avatar_url": "https://example.com/avatar.jpg",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "location": "San Francisco, CA",
            "website": "https://example.com",
            "social_links": {
                "twitter": "@testuser",
                "github": "testuser"
            }
        },
        "user_456": {
            "user_id": "user_456",
            "username": "demo_user",
            "email": "demo@medianest.com",
            "display_name": "Demo User",
            "bio": "Demo account for testing",
            "avatar_url": None,
            "created_at": "2024-01-02T00:00:00Z",
            "updated_at": "2024-01-02T00:00:00Z",
            "location": "New York, NY",
            "website": None,
            "social_links": {}
        }
    }
    
    def sanitize_text_input(text):
        """
        Sanitize text input to prevent :SecurityVulnerability
        Removes potentially dangerous characters while preserving readability
        """
        if not text:
            return text
        # Remove HTML tags and script content
        text = re.sub(r'<[^>]*>', '', text)
        # Remove potentially dangerous characters
        text = re.sub(r'[<>"\']', '', text)
        return text.strip()
    
    # First REST API endpoint: User Info
    class UserInfoResource(Resource):
        """
        User Info REST endpoint implementing :RESTfulAPI pattern
        Provides basic user information structure for testing
        """
        
        def get(self):
            """
            GET /api/v1/users/info
            Returns basic user info structure for API testing
            """
            try:
                # Validate request parameters (if any)
                schema = UserInfoSchema()
                
                # Mock user data for testing (no database yet)
                user_data = {
                    "user_id": "user_123",
                    "username": "test_user",
                    "email": "test@medianest.com",
                    "created_at": datetime.utcnow().isoformat(),
                    "profile": {
                        "display_name": "Test User",
                        "bio": "MediaNest test user account"
                    },
                    "preferences": {
                        "theme": "light",
                        "notifications": True
                    }
                }
                
                # Validate response data
                validated_data = schema.load(user_data, partial=True)
                
                # Return JSON-serializable data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": user_data,
                    "message": "User info retrieved successfully",
                    "status": "success",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data
                
            except ValidationError as e:
                app.logger.error(f"Validation error in user info: {str(e)}")
                raise e
            except Exception as e:
                app.logger.error(f"Error retrieving user info: {str(e)}")
                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": None,
                    "message": "Failed to retrieve user information",
                    "status": "error",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data, 500
    
    # User Profile Resource implementing :RESTfulAPI + :ResourcePattern + :CRUDOperations
    class UserProfileResource(Resource):
        """
        User Profile REST endpoint implementing :ResourcePattern
        Provides GET and PUT operations for user profile management
        Implements :SecurityFirst with parameter validation and input sanitization
        """
        
        def __init__(self):
            # URL parameter parser for user_id validation (:SecurityFirst)
            self.url_parser = reqparse.RequestParser()
            self.url_parser.add_argument(
                'user_id',
                type=str,
                required=True,
                help='Invalid user ID format: {error_msg}',
                location='view_args'
            )
            
            # Request body parser for PUT operations
            self.put_parser = reqparse.RequestParser()
            self.put_parser.add_argument('username', type=str, required=False)
            self.put_parser.add_argument('email', type=str, required=False)
            self.put_parser.add_argument('display_name', type=str, required=False)
            self.put_parser.add_argument('bio', type=str, required=False)
            self.put_parser.add_argument('avatar_url', type=str, required=False)
            self.put_parser.add_argument('location', type=str, required=False)
            self.put_parser.add_argument('website', type=str, required=False)
            self.put_parser.add_argument('social_links', type=dict, required=False)
        
        def get(self, user_id):
            """
            GET /api/v1/users/{user_id}/profile
            Retrieve user profile with validation and error handling
            """
            try:
                # Validate user_id parameter (:SecurityFirst)
                if not user_id or not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
                    # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                    response_data = {
                        "data": None,
                        "message": "Invalid user ID format",
                        "status": "error",
                        "request_id": getattr(g, 'request_id', None),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    return response_data, 400
                
                # Check if user exists in mock storage
                if user_id not in user_profiles_storage:
                    # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                    response_data = {
                        "data": None,
                        "message": "User profile not found",
                        "status": "error",
                        "request_id": getattr(g, 'request_id', None),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    return response_data, 404
                
                # Retrieve and validate profile data
                profile_data = user_profiles_storage[user_id].copy()
                schema = UserProfileSchema()
                
                try:
                    validated_data = schema.load(profile_data, partial=True)
                except ValidationError as e:
                    app.logger.error(f"Profile validation error for user {user_id}: {e.messages}")
                    # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                    response_data = {
                        "data": {"validation_errors": e.messages},
                        "message": "Profile data validation failed",
                        "status": "error",
                        "request_id": getattr(g, 'request_id', None),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    return response_data, 422
                
                # Return JSON-serializable success data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": profile_data,
                    "message": "User profile retrieved successfully",
                    "status": "success",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data, 200
                
            except Exception as e:
                app.logger.error(f"Error retrieving profile for user {user_id}: {str(e)}")
                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": None,
                    "message": "Failed to retrieve user profile",
                    "status": "error",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data, 500
        
        def put(self, user_id):
            """
            PUT /api/v1/users/{user_id}/profile
            Update user profile with validation and sanitization
            """
            try:
                # Validate user_id parameter (:SecurityFirst)
                if not user_id or not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
                    return api_response(
                        data=None,
                        message="Invalid user ID format",
                        status="error",
                        status_code=400
                    )
                
                # Check if user exists
                if user_id not in user_profiles_storage:
                    # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                    response_data = {
                        "data": None,
                        "message": "User profile not found",
                        "status": "error",
                        "request_id": getattr(g, 'request_id', None),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    return response_data, 404
                
                # Parse and validate request data
                args = self.put_parser.parse_args()
                
                # Get current profile data
                current_profile = user_profiles_storage[user_id].copy()
                
                # Update only provided fields with sanitization (:SecurityFirst)
                update_data = {}
                for key, value in args.items():
                    if value is not None:
                        if key in ['display_name', 'bio', 'location']:
                            # Sanitize text inputs
                            update_data[key] = sanitize_text_input(value)
                        elif key == 'username':
                            # Validate username format
                            if not re.match(r'^[a-zA-Z0-9_-]{3,30}$', value):
                                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                                response_data = {
                                    "data": None,
                                    "message": "Username must be 3-30 characters, alphanumeric, underscore, or dash only",
                                    "status": "error",
                                    "request_id": getattr(g, 'request_id', None),
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                return response_data, 400
                            update_data[key] = value
                        elif key == 'email':
                            # Basic email validation
                            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', value):
                                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                                response_data = {
                                    "data": None,
                                    "message": "Invalid email format",
                                    "status": "error",
                                    "request_id": getattr(g, 'request_id', None),
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                return response_data, 400
                            update_data[key] = value
                        elif key in ['avatar_url', 'website']:
                            # URL validation
                            if value and not value.startswith(('http://', 'https://')):
                                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                                response_data = {
                                    "data": None,
                                    "message": f"Invalid {key} format - must be a valid URL",
                                    "status": "error",
                                    "request_id": getattr(g, 'request_id', None),
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                return response_data, 400
                            update_data[key] = value
                        else:
                            update_data[key] = value
                
                # Merge updates with current profile
                updated_profile = {**current_profile, **update_data}
                updated_profile['updated_at'] = datetime.utcnow().isoformat()
                
                # Validate complete updated profile
                schema = UserProfileSchema()
                try:
                    validated_data = schema.load(updated_profile, partial=True)
                except ValidationError as e:
                    # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                    response_data = {
                        "data": {"validation_errors": e.messages},
                        "message": "Profile update validation failed",
                        "status": "error",
                        "request_id": getattr(g, 'request_id', None),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    return response_data, 422
                
                # Save updated profile
                user_profiles_storage[user_id] = updated_profile
                
                # Return JSON-serializable success data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": updated_profile,
                    "message": "User profile updated successfully",
                    "status": "success",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data, 200
                
            except Exception as e:
                app.logger.error(f"Error updating profile for user {user_id}: {str(e)}")
                # Return JSON-serializable error data for Flask-RESTful (:InterfaceMismatch fix)
                response_data = {
                    "data": None,
                    "message": "Failed to update user profile",
                    "status": "error",
                    "request_id": getattr(g, 'request_id', None),
                    "timestamp": datetime.utcnow().isoformat()
                }
                return response_data, 500
    
    # Register API resources
    api.add_resource(UserInfoResource, '/users/info')
    api.add_resource(UserProfileResource, '/users/<user_id>/profile')
    
    return app

# User Info Schema for validation - Module level access (:ImportError fix)
class UserInfoSchema(Schema):
    """Marshmallow schema for user info validation"""
    class Meta:
        unknown = EXCLUDE  # Allow unknown fields like 'profile' and 'preferences'
    
    user_id = fields.Str(required=False, allow_none=True)
    username = fields.Str(required=False, allow_none=True)
    email = fields.Email(required=False, allow_none=True)
    created_at = fields.DateTime(required=False, allow_none=True)
    profile = fields.Dict(required=False, allow_none=True)
    preferences = fields.Dict(required=False, allow_none=True)

# Create Flask application instance
app = create_app()

if __name__ == '__main__':
    """
    Development server entry point
    Compatible with Docker CMD ["python", "app.py"]
    Runs on 0.0.0.0:5000 for container networking
    """
    try:
        host = app.config['HOST']
        port = app.config['PORT']
        debug = app.config['DEBUG']
        
        app.logger.info(f"Starting MediaNest Backend on {host}:{port}")
        app.logger.info(f"Debug mode: {debug}")
        app.logger.info(f"Environment: {app.config['ENV']}")
        
        # Run Flask development server
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=True  # Enable threading for better performance
        )
        
    except Exception as e:
        app.logger.error(f"Failed to start server: {str(e)}")
        raise