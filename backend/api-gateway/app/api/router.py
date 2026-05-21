from fastapi import APIRouter
from .endpoints import orders, riders

# This is the master router for the entire API
api_router = APIRouter()

# Attach the individual endpoint files
api_router.include_router(orders.router, prefix="/orders", tags=["Orders Management"])
api_router.include_router(riders.router, prefix="/riders", tags=["Rider Fleet"])