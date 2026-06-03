<<<<<<< HEAD
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.dataset import prepare_dataset

if __name__ == "__main__":
    print("=== BAT DAU PHAN CHIA LAI DATASET (Voi anh Field-View moi) ===")
    # prepare_dataset(overwrite=True) se xoa cac thu muc train/val/test cu va chia lai tu dau
    prepare_dataset(overwrite=True)
    print("\n=== HOAN TAT CHUAN BI DU LIEU ===")
=======
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.dataset import prepare_dataset

if __name__ == "__main__":
    print("=== BAT DAU PHAN CHIA LAI DATASET (Voi anh Field-View moi) ===")
    # prepare_dataset(overwrite=True) se xoa cac thu muc train/val/test cu va chia lai tu dau
    prepare_dataset(overwrite=True)
    print("\n=== HOAN TAT CHUAN BI DU LIEU ===")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
