# Generative AI PDF Summarizer & Q&A

A local Generative AI PDF Summarizer and Question Answering application built with Python and Streamlit. This application uses LangChain, FAISS, and Hugging Face's DistilGPT2 to run entirely locally on your CPU—no OpenAI API or internet required once the models are downloaded!

## Features
- **Upload PDF**: Process any PDF document locally.
- **Full PDF Summarization**: Uses a chunk-based Map-Reduce approach to summarize long documents.
- **Chat with PDF (RAG)**: Ask questions about the document and get answers based ONLY on the context (avoids AI hallucinations).
- **100% Local (CPU-Only)**: Privacy-first; your documents never leave your machine.
- **Streamlit UI**: A clean, interactive, chat-like web interface.

## Prerequisites
- Python 3.8+

## Installation

1. Clone or download this repository.
2. Prepare your environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## How to Run

1. Start the Streamlit application:
   ```bash
   streamlit run app.py
   ```
2. Your browser will automatically open to `http://localhost:8501`.

## Example Usage
1. Upload a PDF file using the sidebar.
2. Wait for the "Processing PDF..." spinner to finish and display "PDF Processed!".
3. Click "Summarize PDF" on the left panel to get a full map-reduce summary of the document.
4. Use the chat input block on the right to "Ask a question about the PDF" and press Enter. 
5. The AI will retrieve relevant context (top-K chunks) and securely generate a context-aware answer!
