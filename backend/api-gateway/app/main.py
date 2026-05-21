from fastapi import FastAPI
from app.api.router import api_router

app = FastAPI(
    title="LocalBite AI API",
    description="Core logistics and routing engine for LocalBite AI",
    version="0.1.0"
)

# Connect the master router to the app with a standard v1 prefix
app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "api-gateway"}
