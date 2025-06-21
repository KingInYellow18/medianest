from flask import Flask, jsonify, request, g
from flask_cors import CORS
import traceback
import uuid
import structlog

from backend.app.utils.logging import configure_logging, get_logger
from backend.app.utils.exceptions import AppException

app = Flask(__name__)

# Configure logging at startup
configure_logging()
logger = get_logger("app")

# Allow CORS for frontend dev servers (adjust origins as needed for production)
CORS(
    app,
    origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "*"
    ],
    supports_credentials=True
)

# Register API Blueprints
from backend.app.api.services import services_bp
app.register_blueprint(services_bp)

@app.before_request
def inject_request_id():
    """
    Generate a unique request ID for each request, store in Flask's g,
    and bind to structlog contextvars for logging.
    """
    request_id = str(uuid.uuid4())
    g.request_id = request_id
    structlog.contextvars.bind_contextvars(request_id=request_id)

@app.teardown_request
def clear_request_id(exception=None):
    """
    Clear structlog contextvars after request to avoid leaking context.
    """
    structlog.contextvars.clear_contextvars()

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.errorhandler(Exception)
def handle_exception(e):
    # Try to get a request ID from headers or context (optional, fallback to None)
    request_id = (
        getattr(g, "request_id", None)
        or request.headers.get("X-Request-ID")
        or None
    )

    # Default error response
    error_type = type(e).__name__
    message = str(e)
    code = None

    # If it's a custom AppException, extract message and code
    if isinstance(e, AppException):
        message = e.message
        code = e.code

    # Log the error with structured context
    logger.error(
        "Unhandled exception",
        error_type=error_type,
        message=message,
        code=code,
        request_id=request_id,
        path=request.path,
        method=request.method,
        stack_trace=traceback.format_exc()
    )

    # Build JSON error response
    response = {
        "error_type": error_type,
        "message": message,
        "request_id": request_id,
    }
    if code is not None:
        response["code"] = code

    return jsonify(response), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)