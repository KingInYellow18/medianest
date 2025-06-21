"""
Authentication API endpoints for the Media Management Web App.

Implements login functionality using Flask-JWT-Extended.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app import db  # Assumes db is SQLAlchemy instance from app context
import logging

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# In-memory blacklist for JWTs (for demo only; use Redis/DB in production)
jwt_blacklist = set()

# JWTManager instance and callback registration should be moved to app initialization.
# For demonstration, we create a local JWTManager and register the callback here.
from flask_jwt_extended import JWTManager

jwt = JWTManager()  # This should be initialized with the Flask app in app.py

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in jwt_blacklist

# Set up logger
logger = logging.getLogger("auth")
logger.setLevel(logging.INFO)

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    ---
    post:
      summary: User login
      description: Authenticates a user and returns JWT tokens on success.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                username:
                  type: string
                password:
                  type: string
      responses:
        200:
          description: Login successful, returns access and refresh tokens.
        400:
          description: Missing username or password.
        401:
          description: Invalid credentials.
    """
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        logger.warning("Login attempt with missing fields.")
        return jsonify({"msg": "Missing username or password"}), 400

    username = data['username']
    password = data['password']

    session: Session = db.session
    user = session.query(User).filter_by(username=username).first()
    if not user or not user.check_password(password):
        logger.warning(f"Failed login attempt for user: {username}")
        return jsonify({"msg": "Invalid credentials"}), 401

    if not user.is_active:
        logger.warning(f"Inactive user login attempt: {username}")
        return jsonify({"msg": "User account is inactive"}), 403

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    logger.info(f"User logged in: {username}")
    return jsonify(access_token=access_token, refresh_token=refresh_token), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    ---
    post:
      summary: User logout
      description: Blacklists the current JWT, effectively logging out the user.
      security:
        - bearerAuth: []
      responses:
        200:
          description: Logout successful.
        401:
          description: Missing or invalid token.
    """
    try:
        jti = get_jwt()["jti"]
        jwt_blacklist.add(jti)
        logger.info(f"User logged out. JWT jti blacklisted: {jti}")
        return jsonify({"msg": "Successfully logged out"}), 200
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({"msg": "Logout failed"}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    ---
    post:
      summary: Refresh JWT access token
      description: Issues a new access token using a valid refresh token.
      security:
        - bearerAuth: []
      responses:
        200:
          description: Token refresh successful, returns new access token.
        401:
          description: Missing, invalid, or revoked refresh token.
        500:
          description: Internal server error.
    """
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        logger.info(f"Token refreshed for user_id: {current_user_id}")
        return jsonify(access_token=access_token), 200
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({"msg": "Token refresh failed"}), 500

@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    """
    ---
    post:
      summary: Register a new user (admin only)
      description: Allows an admin to register a new user. Requires admin JWT.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                username:
                  type: string
                password:
                  type: string
                email:
                  type: string
      responses:
        201:
          description: User registered successfully.
        400:
          description: Missing or invalid fields, or user/email already exists.
        401:
          description: Unauthorized (not logged in).
        403:
          description: Forbidden (not admin).
        500:
          description: Internal server error.
    """
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        logger.warning("Registration attempt with missing fields.")
        return jsonify({"msg": "Missing username or password"}), 400

    username = data['username']
    password = data['password']
    email = data.get('email')

    session: Session = db.session
    current_user_id = get_jwt_identity()
    admin_user = session.query(User).filter_by(id=current_user_id).first()
    if not admin_user or not admin_user.is_admin:
        logger.warning(f"Non-admin registration attempt by user_id: {current_user_id}")
        return jsonify({"msg": "Admin privileges required"}), 403

    # Check for duplicate username/email
    if session.query(User).filter_by(username=username).first():
        logger.warning(f"Registration failed: Username already exists ({username})")
        return jsonify({"msg": "Username already exists"}), 400
    if email and session.query(User).filter_by(email=email).first():
        logger.warning(f"Registration failed: Email already exists ({email})")
        return jsonify({"msg": "Email already exists"}), 400

    try:
        new_user = User(username=username, password=password, email=email)
        session.add(new_user)
        session.commit()
        logger.info(f"Admin {admin_user.username} registered new user: {username}")
        return jsonify({"msg": "User registered successfully"}), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Registration error: {str(e)}")
        return jsonify({"msg": "Registration failed"}), 500