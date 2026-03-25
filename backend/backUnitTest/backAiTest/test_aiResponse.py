import sys
import os
"""""
gotta use this to point to the right testing folder
"""""
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from unittest.mock import patch, MagicMock
from aiSuggestion import aiSuggestion


def test_ai_suggestion_returns_response():
    mock_result = MagicMock()
    mock_result.suggestion = "return a + b"
    mock_result.explanation = "This returns the sum of a and b"

    mock_completion = MagicMock()
    mock_completion.choices[0].message.parsed = mock_result

    with patch("aiSuggestion.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.parse.return_value = mock_completion

        """""
        Two suggestions can be possibly given to the user
        """""
        result = aiSuggestion(
            "def add_numbers(a,b):",
            "create a function that adds 2 numbers together"
        )

        """""
        Just check to see if we got something from the mock AI.
        """""
        assert result.suggestion is not None
        assert result.explanation is not None
        assert len(result.suggestion) > 0
        assert len(result.explanation) > 0