import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)
url = os.getenv("SUPABASE_URL") or ""
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

from supabase import create_client, Client
supabase: Client = create_client(url, key)

try:
    image_bytes = b"fake image"
    res = supabase.storage.from_('avatars').upload("test_cert_123.jpg", image_bytes, file_options={"content-type": "image/jpeg"})
    print("Upload result:", res)
    public_url = supabase.storage.from_('avatars').get_public_url("test_cert_123.jpg")
    print("Public URL:", public_url)
except Exception as e:
    print("Upload failed:", e)
