from model_loader import load_llm_pipeline
from langchain.text_splitter import RecursiveCharacterTextSplitter

def generate_summary(text):
    # Load model
    pipe = load_llm_pipeline()
    
    # Text splitter for map-reduce
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200
    )
    
    # Split the full text into chunks
    docs = text_splitter.create_documents([text])
    
    summaries = []
    
    # Map step: Summarize each chunk
    for doc in docs:
        input_text = doc.page_content
        prompt = f"Summarize the following text briefly:\n\n{input_text}\n\nSummary:"
        
        # distilgpt2 context window is small, so we use truncation to avoid errors
        result = pipe(prompt, max_new_tokens=100, temperature=0.7, do_sample=True, truncation=True)
        summary = result[0]['generated_text'].replace(prompt, "").strip()
        summaries.append(summary)
        
    # Reduce step: If there's more than one summary, summarize them together
    if len(summaries) > 1:
        combined_summaries = " ".join(summaries)
        
        # Split again if the combined summaries are somehow still too long
        final_docs = text_splitter.create_documents([combined_summaries])
        
        final_summaries = []
        for doc in final_docs:
            prompt = f"Provide a comprehensive final summary of the following text:\n\n{doc.page_content}\n\nFinal Summary:"
            result = pipe(prompt, max_new_tokens=150, temperature=0.7, do_sample=True, truncation=True)
            summary = result[0]['generated_text'].replace(prompt, "").strip()
            final_summaries.append(summary)
            
        return " ".join(final_summaries)
    
    return summaries[0] if summaries else "No text found to summarize."
