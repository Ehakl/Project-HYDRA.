from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    content: Optional[str] = None

class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str = ""
    record_type: str = "other"
    sample_id: Optional[str] = None
    site_name: Optional[str] = None
    user_id: int
    created_at: datetime