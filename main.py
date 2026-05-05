import os
import wandb
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer

def run_translation_demo():
    # 1. Initialize Weights & Biases
    wandb_api_key = os.getenv("WANDB_API_KEY")
    project_name = "wandb demo"
    run_name = "translation-test"
    model_id = "Helsinki-NLP/opus-mt-en-hi"

    if wandb_api_key:
        wandb.login(key=wandb_api_key)
        wandb.init(project=project_name, name=run_name)
    else:
        print("WANDB_API_KEY not found. Running in offline mode.")
        wandb.init(mode="disabled")

    # 2. Load Model and Tokenizer
    print(f"Loading model: {model_id}...")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    
    # Create the translation pipeline
    translator = pipeline("translation", model=model, tokenizer=tokenizer)

    # 3. Define Sentences for Translation
    sentences = [
        "Hello, this is a demo of English to Hindi translation.",
        "Machine learning is very useful.",
        "How are you doing today?",
        "Artificial Intelligence is changing the world.",
        "Data science helps in making better decisions."
    ]

    # 4. Create a W&B Table to store results
    # This is what turns "No visualizations yet" into a side-by-side comparison
    columns = ["English Input", "Hindi Translation"]
    results_table = wandb.Table(columns=columns)

    # 5. Perform Translation and Log to Table
    print("\n" + "="*60)
    print("✓ Starting Translation Process")
    print("="*60)

    for eng_text in sentences:
        # Perform translation
        output = translator(eng_text)
        hindi_text = output[0]['translation_text']
        
        # Add a row to our W&B Table
        results_table.add_data(eng_text, hindi_text)
        
        # Print to terminal for GitHub Action logs
        print(f"EN: {eng_text}")
        print(f"HI: {hindi_text}\n")

    # 6. Log the Table to W&B
    wandb.log({"translation_results": results_table})
    
    # 7. Finalize W&B Run
    print("="*60)
    print("✓ Results successfully logged to W&B Table!")
    print("="*60)
    wandb.finish()

if __name__ == "__main__":
    run_translation_demo()
