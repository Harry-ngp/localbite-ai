from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

# 🚨 THE BULLETPROOF IMPORTS (No folder guessing!)
from app.core.database import get_db, engine, Base
from app.models import orders, riders
from app.api.router import api_router
from app.core.websocket import router as websocket_router
from app.api.partners import router as partners_router 

# 1. Create the app EXACTLY ONCE
app = FastAPI(
    title="LocalBite AI API",
    description="Core logistics and routing engine for LocalBite AI",
    version="0.1.0"
)

# 2. 🚨 THE CORS UNLOCK
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Initialize Database Tables
Base.metadata.create_all(bind=engine)

# 4. Include the routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(websocket_router)
app.include_router(partners_router, prefix="/api/v1/partners", tags=["Partners"])

# ==========================================
# 5. THE LOGIN ENDPOINT
# ==========================================
class LoginRequest(BaseModel):
    email: str
    
@app.post("/api/v1/riders/login")
def login_rider(request: LoginRequest, db: Session = Depends(get_db)):
    # 1. ARMOR: Automatically lowercase the email and strip out any hidden spaces
    clean_email = request.email.strip().lower()
    
    # 2. WIRETAP: Print exactly what React just sent us
    print(f"🕵️ DEBUG: React is asking for email: '{clean_email}'")

    try:
        # 3. Search the database using the cleaned-up email
        rider = db.execute(
            text("SELECT id, email FROM riders WHERE email = :email"),
            {"email": clean_email}
        ).fetchone()
        
        # 4. WIRETAP: Print exactly what the database found
        print(f"🕵️ DEBUG: Database found: {rider}")
        
    except Exception as e:
        print(f"🔥 Login Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database error during login")

    # 5. The Dynamic Check
    if not rider:
        raise HTTPException(status_code=404, detail=f"Rider '{clean_email}' not found in database")

    return {
        "status": "success",
        "rider_id": str(rider[0])
    }

# ==========================================
# 6. Health Check Endpoint
# ==========================================
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy", 
            "service": "api-gateway", 
            "database": "connected"
        }
    except Exception as e:
        print(f"🔥 DATABASE ERROR: {e}") 
        raise HTTPException(status_code=503, detail="Database connection failed")