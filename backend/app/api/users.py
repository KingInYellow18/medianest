"""User management API blueprint."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('', methods=['GET'])
@jwt_required()
def list_users():
    """List all users (admin only placeholder)."""
    return jsonify([]), 200


@users_bp.route('', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user (admin only placeholder)."""
    return jsonify({"msg": "user created"}), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id: int):
    """Update user details (placeholder)."""
    return jsonify({"msg": f"user {user_id} updated"}), 200


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id: int):
    """Delete a user (admin only placeholder)."""
    return jsonify({"msg": f"user {user_id} deleted"}), 200


@users_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Return current user profile (placeholder)."""
    user_id = get_jwt_identity()
    return jsonify({"id": user_id}), 200


@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user profile (placeholder)."""
    user_id = get_jwt_identity()
    _ = request.get_json()
    return jsonify({"msg": f"profile {user_id} updated"}), 200
