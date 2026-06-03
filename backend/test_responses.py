import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(url, key)

try:
    res = supabase.table("expert_responses").select("*").execute()
    data = res.data or []
    print("SUCCESS: fetched", len(data), "responses")
    if data and isinstance(data[0], dict):
        print("Keys available:", list(data[0].keys()))
except Exception as e:
    print("ERROR:", str(e))
