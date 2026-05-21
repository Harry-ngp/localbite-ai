from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.router import api_router
from app.core.database import get_db, engine, Base  # Imported engine and Base
from app.models import orders, riders               # Imported your new models

# THIS IS THE MAGIC LINE: It tells SQLAlchemy to check Supabase. 
# If the tables don't exist yet, it creates them instantly.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LocalBite AI API",
    description="Core logistics and routing engine for LocalBite AI",
    version="0.1.0"
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Ping the database with a simple query
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy", 
            "service": "api-gateway", 
            "database": "connected"
        }
    except Exception as e:
        # THIS IS NEW: Print the exact error to the VS Code terminal
        print(f"🔥 DATABASE ERROR: {e}") 
        raise HTTPException(status_code=503, detail="Database connection failed")