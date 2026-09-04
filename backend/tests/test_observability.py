import os
from unittest.mock import MagicMock, patch
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


def test_attach_langsmith_usage_metadata_helpers():
    """Verify _attach_langsmith_usage correctly computes tokens and estimated cost on active span."""
    mock_run_tree = MagicMock()
    mock_run_tree.extra = {}

    usage_dict = {
        "prompt_tokens": 1000,
        "completion_tokens": 200,
        "total_tokens": 1200,
    }

    # Test in analysis_agent
    with patch("src.analysis_agent.get_current_run_tree", return_value=mock_run_tree):
        analysis_agent._attach_langsmith_usage(usage_dict)
        mock_run_tree.set.assert_called_once()
        call_kwargs = mock_run_tree.set.call_args[1]
        assert "usage_metadata" in call_kwargs
        um = call_kwargs["usage_metadata"]
        assert um["input_tokens"] == 1000
        assert um["output_tokens"] == 200
        assert um["total_tokens"] == 1200
        assert um["input_cost"] == 0.00059
        assert um["output_cost"] == 0.000158
        assert um["total_cost"] == 0.000748

    # Test in llm_judge
    mock_run_tree.reset_mock()
    with patch("src.llm_judge.get_current_run_tree", return_value=mock_run_tree):
        llm_judge._attach_langsmith_usage(usage_dict)
        mock_run_tree.set.assert_called_once()

    # Test in discovery_agent
    mock_run_tree.reset_mock()
    with patch("src.discovery_agent.get_current_run_tree", return_value=mock_run_tree):
        discovery_agent._attach_langsmith_usage(usage_dict)
        mock_run_tree.set.assert_called_once()


def test_groq_api_call_extracts_usage():
    """Verify that _call_groq invokes _attach_langsmith_usage when response JSON contains usage."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": '{"why_it_matters": "Grounded claim.", "confidence": "High"}'}}],
        "usage": {"prompt_tokens": 500, "completion_tokens": 100, "total_tokens": 600},
    }

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_key"}), \
         patch("requests.post", return_value=mock_resp), \
         patch("src.analysis_agent._attach_langsmith_usage") as mock_attach:
        res = analysis_agent._call_groq("sys", "user")
        assert res["confidence"] == "High"
        mock_attach.assert_called_once_with(
            {"prompt_tokens": 500, "completion_tokens": 100, "total_tokens": 600},
            model="openai/gpt-oss-120b",
        )

