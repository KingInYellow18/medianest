from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from backend.app.services.uptime_kuma import UptimeKumaService
from backend.app.utils.logging import get_logger
from backend.app.utils.exceptions import ExternalServiceError
import asyncio

services_bp = Blueprint('services', __name__, url_prefix='/api/services')
logger = get_logger("api.services")

@services_bp.route('/status', methods=['GET'])
@jwt_required()
def service_status():
    """
    GET /api/services/status
    Returns the status of monitored services from Uptime Kuma.
    Requires authentication.
    """
    kuma_service = UptimeKumaService()
    try:
        # Run the async method in the event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        services = loop.run_until_complete(kuma_service.get_services_status())
        loop.close()
        return jsonify(services), 200
    except Exception as e:
        logger.error(
            "Failed to get Uptime Kuma service status",
            error=str(e),
            exc_info=True
        )
        raise ExternalServiceError("Failed to get Uptime Kuma service status") from e