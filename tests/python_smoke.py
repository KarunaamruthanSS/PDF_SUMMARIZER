"""Basic smoke test for Python modules without loading heavy ML models."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import summarizer
import qa_system


class FakeDoc:
    def __init__(self, page_content: str):
        self.page_content = page_content


class FakeVectorStore:
    def similarity_search(self, question: str, k: int = 3):
        assert question
        return [
            FakeDoc("The project processes PDFs locally and stores chunks in a vector store."),
            FakeDoc("Summarization and Q&A both use a generation pipeline."),
        ][:k]


def fake_pipe(prompt: str, **_kwargs):
    return [{"generated_text": f"{prompt} synthetic-output"}]


def run_smoke_test() -> None:
    summarizer.load_llm_pipeline = lambda: fake_pipe
    qa_system.load_llm_pipeline = lambda: fake_pipe

    summary = summarizer.generate_summary(
        "This is a short sample document text used only for smoke test coverage. " * 8,
    )
    assert isinstance(summary, str)
    assert summary

    answer = qa_system.get_answer(FakeVectorStore(), "How does this app work?")
    assert isinstance(answer, str)
    assert answer

    print("Python smoke test passed")


if __name__ == "__main__":
    run_smoke_test()
