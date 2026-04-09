import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from backend/ directory regardless of working directory
load_dotenv(Path(__file__).resolve().parent / ".env")

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Database configuration
    # For production: use PostgreSQL
    # For development: use SQLite
    DATABASE_TYPE = os.getenv('DATABASE_TYPE', 'sqlite')

    if DATABASE_TYPE == 'postgresql':
        # PostgreSQL connection must be provided via DATABASE_URL environment variable
        SQLALCHEMY_DATABASE_URI = os.getenv(
            'DATABASE_URL',
            None  # Force explicit configuration for PostgreSQL
        )
        if not SQLALCHEMY_DATABASE_URI:
            raise ValueError(
                "DATABASE_URL environment variable is required for PostgreSQL. "
                "Example: postgresql://username:password@localhost:5432/zerosec_db"
            )
    else:
        # SQLite for development
        SQLALCHEMY_DATABASE_URI = os.getenv(
            'DATABASE_URL',
            'sqlite:///zerosec.db'
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv('SQLALCHEMY_ECHO', 'False') == 'True'

    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', '24')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', '30')))
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # Security
    BCRYPT_LOG_ROUNDS = int(os.getenv('BCRYPT_LOG_ROUNDS', '12'))

    # Pagination
    DEFAULT_PAGE_SIZE = int(os.getenv('DEFAULT_PAGE_SIZE', '20'))
    MAX_PAGE_SIZE = int(os.getenv('MAX_PAGE_SIZE', '100'))

    # File upload
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'backend/data/docs')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', str(16 * 1024 * 1024)))  # 16MB default

    # -------------------------
    # RAG Provider
    # -------------------------
    # Set RAG_PROVIDER=external to use Groq + Qdrant Cloud instead of local Ollama + Chroma.
    RAG_PROVIDER = os.getenv('RAG_PROVIDER', 'local')          # "local" | "external"

    # Groq API (external LLM) — required when RAG_PROVIDER=external
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', None)
    GROQ_LLM_MODEL = os.getenv('GROQ_LLM_MODEL', 'llama-3.1-8b-instant')
    GROQ_TEMPERATURE = float(os.getenv('GROQ_TEMPERATURE', '0.3'))
    GROQ_MAX_TOKENS = int(os.getenv('GROQ_MAX_TOKENS', '512'))

    # Qdrant Cloud (external vector DB) — required when RAG_PROVIDER=external
    QDRANT_URL = os.getenv('QDRANT_URL', None)
    QDRANT_API_KEY = os.getenv('QDRANT_API_KEY', None)
    QDRANT_COLLECTION = os.getenv('QDRANT_COLLECTION', 'zerosec_docs')
    QDRANT_SIMILARITY_THRESHOLD = float(os.getenv('QDRANT_SIMILARITY_THRESHOLD', '0.30'))

    # -------------------------
    # Encrypted RAG (SAG)
    # -------------------------
    SAG_HMAC_SALT  = os.getenv('SAG_HMAC_SALT', '')
    SAG_KEY_VERSION = int(os.getenv('SAG_KEY_VERSION', '1'))

    # Shared retrieval tuning (applies to both providers)
    RAG_TOP_K = int(os.getenv('RAG_TOP_K', '8'))
    RAG_MAX_RESULTS = int(os.getenv('RAG_MAX_RESULTS', '4'))

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    SQLALCHEMY_ECHO = False

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
