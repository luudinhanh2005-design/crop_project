<<<<<<< HEAD
import subprocess
from pathlib import Path

def test_kaggle():
    print("Testing Kaggle API connection...")
    cmd = ["venv\\Scripts\\kaggle.exe", "datasets", "list", "-s", "agriculture", "--page", "1"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("Success! Kaggle API is working.")
        print("Output snippet:", result.stdout[:200])
        return True
    except Exception as e:
        print(f"Failed! Kaggle API error: {e}")
        return False

if __name__ == "__main__":
    test_kaggle()
=======
import subprocess
from pathlib import Path

def test_kaggle():
    print("Testing Kaggle API connection...")
    cmd = ["venv\\Scripts\\kaggle.exe", "datasets", "list", "-s", "agriculture", "--page", "1"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("Success! Kaggle API is working.")
        print("Output snippet:", result.stdout[:200])
        return True
    except Exception as e:
        print(f"Failed! Kaggle API error: {e}")
        return False

if __name__ == "__main__":
    test_kaggle()
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
