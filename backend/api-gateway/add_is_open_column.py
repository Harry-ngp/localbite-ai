"""
Migration: Add is_open column to restaurants table.
Run once: python add_is_open_column.py
"""
from sqlalchemy import text
from app.core.database import engine

def run():
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT TRUE NOT NULL;"
        ))
        print("OK: Added 'is_open' column to restaurants table.")

if __name__ == "__main__":
    run()
