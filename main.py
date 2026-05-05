import os
import wandb
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from huggingface_hub import HfApi, login

def run_demo():
    # 1. Load Environment Variables passed from GitHub Actions
    wandb_api_key = os.getenv("WANDB_API_KEY")
    wandb_project = os.getenv("WANDB_PROJECT", "wandb-demo")
    hf_token = os.getenv("HF_TOKEN")
    hf_repo_id = os.getenv("HF_REPO_ID")
    upload_to_hf = os.getenv("UPLOAD_TO_HF", "false").lower() == "true"

    print(f"--- Starting Demo for Repo: {hf_repo_id} ---")

    # 2. Authenticate and Initialize W&B
    if wandb_api_key:
        wandb.login(key=wandb_api_key)
        wandb.init(project=wandb_project, name="github-action-run")
        # Log a dummy metric to verify it works
        wandb.log({"status": "success", "message": "BERT model initialized"})
    else:
        print("Warning: WANDB_API_KEY not found. Skipping W&B.")

    # 3. Load a tiny BERT model (for speed in demo)
    model_name = "google-bert/bert-base-uncased"
    print(f"Loading model: {model_name}")
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    # 4. Save model locally
    save_path = "./demo-model"
    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print("Model saved locally.")

    # 5. Upload to Hugging Face
    if upload_to_hf and hf_token and hf_repo_id:
        print(f"Uploading to Hugging Face: {hf_repo_id}")
        try:
            login(token=hf_token)
            model.push_to_hub(hf_repo_id)
            tokenizer.push_to_hub(hf_repo_id)
            print("Successfully uploaded to Hugging Face!")
        except Exception as e:
            print(f"Error uploading to Hugging Face: {e}")
    else:
        print("Skipping Hugging Face upload (check your env variables).")

    # 6. Finish W&B
    if wandb_api_key:
        wandb.finish()

if __name__ == "__main__":
    run_demo()
