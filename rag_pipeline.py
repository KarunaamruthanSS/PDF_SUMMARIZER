from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

def process_pdf(pdf_path):
    # 1. Load PDF
    loader = PyPDFLoader(pdf_path)
    documents = loader.load()
    
    # 2. Extract full text for summarization
    full_text = " ".join([doc.page_content for doc in documents])
    
    # 3. Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = text_splitter.split_documents(documents)
    
    # 4. Generate Embeddings & Store in FAISS
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.from_documents(chunks, embeddings)
    
    return vector_store, full_text
