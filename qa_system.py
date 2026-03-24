from model_loader import load_llm_pipeline

def get_answer(vector_store, question):
    # 1. Retrieve top-k chunks
    docs = vector_store.similarity_search(question, k=3)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    # 2. Load model
    pipe = load_llm_pipeline()
    
    # 3. Construct RAG prompt
    prompt = f"""Answer the question based ONLY on the context provided. 
If the answer is not in the context, say "I don't know".

Context: {context[:1000]}

Question: {question}

Answer:"""

    result = pipe(prompt, max_new_tokens=100, temperature=0.3, do_sample=True)
    answer = result[0]['generated_text'].replace(prompt, "").strip()
    
    return answer
