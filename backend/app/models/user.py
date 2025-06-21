"""
User model for the Media Management Web App.

This module defines the User model with SQLAlchemy for authentication
and user management functionality.
"""

from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from backend.app import db


class User(db.Model):
    """
    User model for authentication and user management.
    
    Attributes:
        id (int): Primary key, auto-incrementing user ID
        username (str): Unique username for login (max 80 characters)
        password_hash (str): Hashed password for security (max 255 characters)
        email (str): User email address (max 120 characters, optional)
        is_admin (bool): Admin role flag, defaults to False
        is_active (bool): Account active status, defaults to True
        created_at (datetime): Account creation timestamp
        updated_at (datetime): Last update timestamp
    """
    
    __tablename__ = 'users'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Authentication fields
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # User information
    email = Column(String(120), unique=True, nullable=True, index=True)
    
    # Role and status
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __init__(self, username, password, email=None, is_admin=False, is_active=True):
        """
        Initialize a new User instance.
        
        Args:
            username (str): Unique username
            password (str): Plain text password (will be hashed)
            email (str, optional): User email address
            is_admin (bool, optional): Admin role flag, defaults to False
            is_active (bool, optional): Account active status, defaults to True
        """
        self.username = username
        self.set_password(password)
        self.email = email
        self.is_admin = is_admin
        self.is_active = is_active
    
    def set_password(self, password):
        """
        Hash and set the user's password.
        
        Args:
            password (str): Plain text password to hash and store
        """
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """
        Check if the provided password matches the stored hash.
        
        Args:
            password (str): Plain text password to verify
            
        Returns:
            bool: True if password matches, False otherwise
        """
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_sensitive=False):
        """
        Convert user instance to dictionary representation.
        
        Args:
            include_sensitive (bool): Whether to include sensitive fields
            
        Returns:
            dict: User data as dictionary
        """
        user_dict = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sensitive:
            user_dict['password_hash'] = self.password_hash
            
        return user_dict
    
    def __repr__(self):
        """String representation of User instance."""
        return f'<User {self.username}>'
    
    def __str__(self):
        """Human-readable string representation."""
        return f'User: {self.username} (ID: {self.id})'