import os
import wandb
from transformers import pipeline

def run_translation_demo():
    # 1. Setup Environment & W&B
    wandb_api_key = os.getenv("WANDB_API_KEY")
    model_id = "Helsinki-NLP/opus-mt-en-hi" # English to Hindi
    
    if wandb_api_key:
        wandb.login(key=wandb_api_key)
        wandb.init(project="wandb demo", name="translation-test")

    # 2. Load the Translation Pipeline
    print(f"Loading model: {model_id}...")
    translator = pipeline("translation", model=model_id)

    # 3. Define sentences to translate
    sentences = [
        "Hello, this is a demo of English to Hindi translation.",
        "Machine learning is very useful.",
        "How are you doing today?"
    ]

    # 4. Perform Translation
    results = translator(sentences)

    # 5. PRINT FORMATTED OUTPUT (To match your image)
    print("\n" + "="*60)
    print("✓ Translation completed successfully!")
    print("="*60)
    print(f"Model: {model_id}")
    print("Inference Type: ACTUAL MODEL")
    print(f"Total translations: {len(sentences)}")
    print("\nTranslations:\n")

    for i, (eng, res) in enumerate(zip(sentences, results)):
        hindi_text = res['translation_text']
        print(f"[{i+1}] English: {eng}")
        print(f"    Hindi: {hindi_text}\n")
        
        # Optional: Log to W&B table
        if wandb_api_key:
            wandb.log({f"translation_{i}": f"EN: {eng} -> HI: {hindi_text}"})

    if wandb_api_key:
        wandb.finish()

if __name__ == "__main__":
    run_translation_demo()
