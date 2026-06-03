import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)
url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

from supabase import create_client, Client
supabase: Client = create_client(url, key)

res = supabase.table('expert_verifications').select("*").execute()
print("Data:", res.data)
