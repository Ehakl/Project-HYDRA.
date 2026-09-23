from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    content: Optional[str] = None

class DocumentResponse(BaseModel):
    id: str
    title: str
    content: Optional[str]
    user_id: int
    created_at: datetime