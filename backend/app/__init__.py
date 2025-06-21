"""Flask application factory and extension initialization."""

import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from .config import DevelopmentConfig, ProductionConfig, BaseConfig

db = SQLAlchemy()
jwt = JWTManager()


def create_app(
    config_name: str | None = None, config_overrides: dict | None = None
) -> Flask:
    """Application factory for creating configured Flask app instances.

    Parameters
    ----------
    config_name: str | None
        Name of the configuration to load ("development" or "production").
    config_overrides: dict | None
        Optional configuration overrides used primarily for testing.

    Returns
    -------
    Flask
        Configured Flask application instance.
    """

    app = Flask(__name__, instance_relative_config=True)

    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    config_map = {
        "development": DevelopmentConfig,
        "production": ProductionConfig,
    }

    config_class = config_map.get(config_name, DevelopmentConfig)
    app.config.from_object(config_class)

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
    from .api import (
        auth_bp,
        services_bp,
        users_bp,
        media_bp,
        admin_bp,
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(media_bp)
    app.register_blueprint(admin_bp)

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"}), 200

    return app
