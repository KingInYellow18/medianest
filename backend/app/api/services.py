from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from backend.app.services.uptime_kuma import get_services_status

services_bp = Blueprint('services', __name__, url_prefix='/api/services')

@services_bp.route('/status', methods=['GET'])
@jwt_required()
def service_status():
    """
    GET /api/services/status
    Returns the status of monitored services from Uptime Kuma.
    Requires authentication.
    """
    try:
        services = get_services_status()
        return jsonify(services), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500