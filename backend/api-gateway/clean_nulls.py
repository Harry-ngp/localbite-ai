import asyncio
from sqlalchemy import text
from app.core.database import engine

async def clean_nulls():
    with engine.begin() as conn:
        # 1. Update marketplace_users
        conn.execute(text("UPDATE marketplace_users SET name = '' WHERE name IS NULL"))
        conn.execute(text("UPDATE marketplace_users SET phone = '' WHERE phone IS NULL"))
        conn.execute(text("UPDATE marketplace_users SET address = '' WHERE address IS NULL"))
        conn.execute(text("UPDATE marketplace_users SET bio = '' WHERE bio IS NULL"))
        conn.execute(text("UPDATE marketplace_users SET preferences = '' WHERE preferences IS NULL"))
        
        # 2. Update restaurants
        conn.execute(text("UPDATE restaurants SET contact_number = '' WHERE contact_number IS NULL"))
        conn.execute(text("UPDATE restaurants SET support_number = '' WHERE support_number IS NULL"))
        
        print("Replaced NULLs with empty strings in users and restaurants tables.")

if __name__ == "__main__":
    asyncio.run(clean_nulls())
