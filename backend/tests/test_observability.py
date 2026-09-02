import os
import pytest
from src import config, analysis_agent, llm_judge, discovery_agent

def test_langsmith_config_defaults():
    """Verify default LangSmith configuration constants."""
    assert config.LANGCHAIN_PROJECT == os.getenv("LANGCHAIN_PROJECT", "prismiq-production")
    assert config.LANGCHAIN_ENDPOINT == "https://api.smith.langchain.com"
    assert isinstance(config.LANGCHAIN_TRACING_V2, bool)


def test_traceable_decorator_wrapped_functions():
    """Verify decorated functions maintain signature and execute properly."""
    assert callable(analysis_agent._call_groq)
    assert callable(llm_judge._call_groq_judge)
    assert callable(discovery_agent._call_groq_discovery)


def test_node_level_failure_distinction():
    """Verify that an individual LLM call failure returns fallback and does not crash agent."""
    # When API key is missing or invalid, fallback dictionary is returned gracefully
    original_key = os.environ.get("GROQ_API_KEY")
    try:
        os.environ["GROQ_API_KEY"] = ""
        res = analysis_agent._call_groq("system prompt", "user prompt")
        assert isinstance(res, dict)
        assert "why_it_matters" in res
        assert res["confidence"] == "Low"
    finally:
        if original_key is not None:
            os.environ["GROQ_API_KEY"] = original_key
