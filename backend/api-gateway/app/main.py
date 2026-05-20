from fastapi import FastAPI

app = FastAPI(
    title="LocalBite AI API",
    description="Core logistics and routing engine for LocalBite AI",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"message": "LocalBite AI Backend Running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "api-gateway"}