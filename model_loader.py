from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
import torch
import streamlit as st

@st.cache_resource
def load_llm_pipeline():
    model_id = "distilgpt2"
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id)
    
    # Create pipeline
    pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device="cpu" # Force CPU
    )
    
    return pipe
