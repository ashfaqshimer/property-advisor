from app.db.session import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text('TRUNCATE staff_sessions, staff_users CASCADE'))
print("Truncated tables")
