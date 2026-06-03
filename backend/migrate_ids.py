import sqlite3
import uuid
import os

DB_PATH = "backend/auth.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all users
    cursor.execute("SELECT id, username FROM custom_users")
    users = cursor.fetchall()

    updates = []
    for user_id, username in users:
        # Check if ID is already a UUID
        try:
            uuid.UUID(str(user_id))
            print(f"User {username} already has UUID: {user_id}")
        except ValueError:
            # Not a UUID, generate one
            new_id = str(uuid.uuid4())
            print(f"Migrating user {username}: {user_id} -> {new_id}")
            updates.append((new_id, user_id))

    # Perform updates
    for new_id, old_id in updates:
        cursor.execute("UPDATE custom_users SET id = ? WHERE id = ?", (new_id, old_id))
    
    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
