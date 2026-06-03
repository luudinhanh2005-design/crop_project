import requests
url = 'http://localhost:8000/predict'
files = {'file': ('test.jpg', open('/home/mink/crop_project/frontend/images/lua.jpg', 'rb'), 'image/jpeg')}
try:
    response = requests.post(url, files=files)
    print(response.status_code)
    print(response.text)
except Exception as e:
    print("Error:", e)
