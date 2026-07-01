import asyncio
from sqlalchemy import text
from app.core.database import engine

async def update_marketplace_users_schema():
    columns_to_add = [
        "name VARCHAR",
        "password_hash VARCHAR",
        "phone VARCHAR",
        "address VARCHAR",
        "bio VARCHAR",
        "preferences VARCHAR"
    ]
    
    with engine.begin() as conn:
        for col in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE marketplace_users ADD COLUMN IF NOT EXISTS {col};"))
                print(f"Added column {col} if it didn't exist.")
            except Exception as e:
                print(f"Error adding {col}: {e}")
        print("Marketplace users schema updated successfully.")

if __name__ == "__main__":
    asyncio.run(update_marketplace_users_schema())
