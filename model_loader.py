from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import streamlit as st

@st.cache_resource
def load_summarizer_pipeline():
    model_id = "sshleifer/distilbart-cnn-12-6"
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    
    pipe = pipeline(
        "summarization",
        model=model,
        tokenizer=tokenizer,
        device="cpu"
    )
    return pipe

@st.cache_resource
def load_qa_pipeline():
    model_id = "google/flan-t5-base"
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    
    pipe = pipeline(
        "text2text-generation",
        model=model,
        tokenizer=tokenizer,
        device="cpu"
    )
    return pipe
