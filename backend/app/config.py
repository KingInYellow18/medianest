"""Application configuration classes loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env in project root
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / '.env')

class BaseConfig:
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-me')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change-me')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL', f"sqlite:///{ROOT_DIR / 'instance' / 'medianest.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(BaseConfig):
    DEBUG = True
    ENV = 'development'

class ProductionConfig(BaseConfig):
    DEBUG = False
    ENV = 'production'
