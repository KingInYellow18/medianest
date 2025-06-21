"""Flask application factory and extension initialization."""

import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_overrides: dict | None = None) -> Flask:
    """Application factory for creating configured Flask app instances.

    Parameters
    ----------
    config_overrides: dict | None
        Optional configuration overrides used primarily for testing.

    Returns
    -------
    Flask
        Configured Flask application instance.
    """

    app = Flask(__name__, instance_relative_config=True)

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get(
            "DATABASE_URL", f"sqlite:///{os.path.join(app.instance_path, 'medianest.db')}"
        ),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=os.environ.get("JWT_SECRET_KEY", "change-me"),
    )

    if config_overrides:
        app.config.update(config_overrides)

    # Extensions
    db.init_app(app)
    jwt.init_app(app)

    # Enable CORS for dev servers
    CORS(
        app,
        origins=["http://localhost:3000", "http://localhost:5173", "*"],
        supports_credentials=True,
    )

    # Register blueprints
    from .api.auth import auth_bp
    from .api.services import services_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(services_bp)

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"}), 200

    return app
