from model_loader import load_summarizer_pipeline
from langchain_text_splitters import RecursiveCharacterTextSplitter

def generate_summary(text):
    # Load model
    pipe = load_summarizer_pipeline()
    
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
        
        result = pipe(input_text, max_new_tokens=100, min_new_tokens=30, do_sample=False, truncation=True)
        summary = result[0]['summary_text'].strip()
        summaries.append(summary)
        
    # Reduce step: If there's more than one summary, summarize them together
    if len(summaries) > 1:
        combined_summaries = " ".join(summaries)
        
        # Split again if the combined summaries are somehow still too long
        final_docs = text_splitter.create_documents([combined_summaries])
        
        final_summaries = []
        for doc in final_docs:
            result = pipe(doc.page_content, max_new_tokens=150, min_new_tokens=40, do_sample=False, truncation=True)
            summary = result[0]['summary_text'].strip()
            final_summaries.append(summary)
            
        return " ".join(final_summaries)
    
    return summaries[0] if summaries else "No text found to summarize."
