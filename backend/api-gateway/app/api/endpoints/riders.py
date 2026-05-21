from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_available_riders():
    return {"message": "Fetching all online and unassigned riders"}