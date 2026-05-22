from pydantic import BaseModel
from typing import Optional

class RiderBase(BaseModel):
    name: str
    phone_number: str

class RiderCreate(RiderBase):
    # What the frontend sends us to register a new rider
    pass

class RiderResponse(RiderBase):
    id: str
    is_active: bool
    current_status: str
    max_volume_capacity: int   # Added
    current_volume_load: int   # Added

    class Config:
        from_attributes = True