import streamlit as st
import os
from rag_pipeline import process_pdf
from summarizer import generate_summary
from qa_system import get_answer

# Page Configuration
st.set_page_config(page_title="AI PDF Summarizer & Q&A", layout="wide")

# Custom CSS for Streamlit
st.markdown("""
    <style>
    .main {
        background-color: #f0f2f6;
    }
    .stButton>button {
        width: 100%;
        border-radius: 5px;
        height: 3em;
        background-color: #ff4b4b;
        color: white;
    }
    .stTextInput>div>div>input {
        border-radius: 5px;
    }
    </style>
    """, unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.title("📚 PDF AI Assistant")
    st.markdown("---")
    uploaded_file = st.file_uploader("Upload your PDF", type="pdf")
    
    if uploaded_file:
        if st.session_state.get('current_file') != uploaded_file.name:
            with st.spinner("Processing PDF..."):
                # Save temporary file
                with open("temp.pdf", "wb") as f:
                    f.write(uploaded_file.getbuffer())
                
                # Process PDF
                vector_store, full_text = process_pdf("temp.pdf")
                st.session_state['vector_store'] = vector_store
                st.session_state['full_text'] = full_text
                st.session_state['current_file'] = uploaded_file.name
                st.session_state['messages'] = []
                st.success("PDF Processed!")
        else:
            st.success("PDF Processed!")
            
    st.markdown("---")
    if st.button("Clear Chat History"):
        st.session_state['messages'] = []
        st.rerun()

# Main UI
st.title("Document Analysis Dashboard")

if 'messages' not in st.session_state:
    st.session_state['messages'] = []

col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("📝 Summary")
    if st.button("Summarize PDF"):
        if 'full_text' in st.session_state:
            with st.spinner("Generating summary..."):
                summary = generate_summary(st.session_state['full_text'])
                st.text_area("Summary Output", summary, height=400)
        else:
            st.warning("Please upload a PDF first.")

with col2:
    st.subheader("💬 Chat with PDF")
    
    # Display chat history
    chat_container = st.container(height=400)
    for message in st.session_state['messages']:
        with chat_container.chat_message(message["role"]):
            st.markdown(message["content"])

    # Chat input
    if prompt := st.chat_input("Ask a question about the PDF"):
        if 'vector_store' in st.session_state:
            # Add user message to chat history
            st.session_state.messages.append({"role": "user", "content": prompt})
            with chat_container.chat_message("user"):
                st.markdown(prompt)

            # Generate response
            with st.spinner("Thinking..."):
                answer = get_answer(st.session_state['vector_store'], prompt)
                
            # Add assistant response to chat history
            st.session_state.messages.append({"role": "assistant", "content": answer})
            with chat_container.chat_message("assistant"):
                st.markdown(answer)
        else:
            st.warning("Please upload a PDF first.")
