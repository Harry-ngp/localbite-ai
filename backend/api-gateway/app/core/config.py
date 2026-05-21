# app/core/config.py
import os
from dotenv import load_dotenv

# Load variables from the .env file into the environment
load_dotenv()

class Settings:
    PROJECT_NAME: str = "LocalBite AI API"
    VERSION: str = "0.1.0"
    # Fetch the database URL; throw an error if it's missing
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/localbite_db")

settings = Settings()