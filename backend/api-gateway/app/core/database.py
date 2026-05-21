# app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# The Engine is the core interface to the database
engine = create_engine(settings.DATABASE_URL)

# The SessionLocal class is a factory for generating new database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that all our future database models will inherit from
Base = declarative_base()

# Dependency function to get a database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()