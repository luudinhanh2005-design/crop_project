<<<<<<< HEAD
import tensorflow as tf
import json
from pathlib import Path
from datetime import datetime
from utils.dataset import create_generators
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history
from config import BEST_MODEL_PATH, HISTORY_PATH, MODEL_DIR

if __name__ == "__main__":
    print("Finalizing training results...")
    
    # Load model
    model = tf.keras.models.load_model(str(BEST_MODEL_PATH))
    
    # Load data
    _, _, test_gen = create_generators(backbone_name="efficientnetb0", augment=False)
    
    # Evaluate
    result = evaluate_model(model, test_gen, verbose=True)
    
    # Plot
    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)
    
    # Load and plot history
    if HISTORY_PATH.exists():
        with open(HISTORY_PATH) as f:
            history = json.load(f)
        plot_history(history, save=True)
    
    # Save final results JSON
    eval_path = MODEL_DIR / "eval_results.json"
    with open(eval_path, "w") as f:
        json.dump({
            "backbone":   "efficientnetb0",
            "accuracy":   result["accuracy"],
            "f1":         result["f1"],
            "trained_at": datetime.now().isoformat(),
        }, f, indent=2)
    
    print("All results finalized successfully!")
=======
import tensorflow as tf
import json
from pathlib import Path
from datetime import datetime
from utils.dataset import create_generators
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history
from config import BEST_MODEL_PATH, HISTORY_PATH, MODEL_DIR

if __name__ == "__main__":
    print("Finalizing training results...")
    
    # Load model
    model = tf.keras.models.load_model(str(BEST_MODEL_PATH))
    
    # Load data
    _, _, test_gen = create_generators(backbone_name="efficientnetb0", augment=False)
    
    # Evaluate
    result = evaluate_model(model, test_gen, verbose=True)
    
    # Plot
    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)
    
    # Load and plot history
    if HISTORY_PATH.exists():
        with open(HISTORY_PATH) as f:
            history = json.load(f)
        plot_history(history, save=True)
    
    # Save final results JSON
    eval_path = MODEL_DIR / "eval_results.json"
    with open(eval_path, "w") as f:
        json.dump({
            "backbone":   "efficientnetb0",
            "accuracy":   result["accuracy"],
            "f1":         result["f1"],
            "trained_at": datetime.now().isoformat(),
        }, f, indent=2)
    
    print("All results finalized successfully!")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
