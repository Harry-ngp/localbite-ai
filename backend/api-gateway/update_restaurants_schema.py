import asyncio
from sqlalchemy import text
from app.core.database import engine

async def update_schema():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS contact_number VARCHAR;"))
        conn.execute(text("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS support_number VARCHAR;"))
        print("Schema updated successfully.")

if __name__ == "__main__":
    asyncio.run(update_schema())
