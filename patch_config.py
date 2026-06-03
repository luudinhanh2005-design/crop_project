import re

with open('backend/config.py', 'r') as f:
    content = f.read()

# Just append the new details or create a new file. Wait, it's better to just rewrite CROP_DETAILS directly if we can.
