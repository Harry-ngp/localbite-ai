"""
Reset database - drop orders table and recreate with new schema
"""
from sqlalchemy import text
from app.core.database import SessionLocal, engine, Base
from app.models import orders, riders

db = SessionLocal()
try:
    # Drop just the orders table to recreate with new columns
    print("🔄 Dropping orders table...")
    db.execute(text("DROP TABLE IF EXISTS orders CASCADE"))
    db.commit()
    print("✅ Dropped orders table")
except Exception as e:
    print(f"⚠️  Error dropping table: {e}")
    db.rollback()
finally:
    db.close()

# Create all tables with new schema
print("🔄 Creating orders table with new schema...")
Base.metadata.create_all(bind=engine)
print("✅ Created all tables with new schema")
print("✅ Database reset complete!")
