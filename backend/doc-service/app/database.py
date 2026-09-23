from motor.motor_asyncio import AsyncIOMotorClient
import os

# Why Motor? It's the async driver for MongoDB. FastAPI is async, so we use async DB drivers.
# If we used PyMongo (sync), it would block the event loop and kill our concurrency.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo_db:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.hydra_docs
documents_collection = db.documents