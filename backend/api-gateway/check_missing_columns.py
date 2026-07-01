import asyncio
from sqlalchemy import inspect
from app.core.database import engine, Base

# Import all models to ensure they are registered with Base.metadata
from app.models import orders, riders, marketplace

def check_columns():
    inspector = inspect(engine)
    db_tables = inspector.get_table_names()
    
    missing = False
    
    for table_name, table in Base.metadata.tables.items():
        if table_name not in db_tables:
            print(f"Table missing entirely: {table_name}")
            missing = True
            continue
        
        db_columns = [col['name'] for col in inspector.get_columns(table_name)]
        model_columns = [col.name for col in table.columns]
        
        for col in model_columns:
            if col not in db_columns:
                print(f"Missing column: {table_name}.{col}")
                missing = True

    if not missing:
        print("All tables and columns are up to date!")

if __name__ == "__main__":
    check_columns()
