import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from unittest.mock import patch, MagicMock
from aiSuggestion import aiSuggestion

def test_ai_retokens_syntax_error():
    """
    Small obvious syntax error. In python there shouldn't be a ;
    This may change for upcoming different language compilers on the app,
    base for now is python
    """
    bad_result = MagicMock()
    bad_result.suggestion = "    return a + b;"  
    bad_result.explanation = "This returns the sum of a and b"

    
    good_result = MagicMock()
    good_result.suggestion = "    return a + b"  
    good_result.explanation = "This returns the sum of a and b"

    """
    Document the two good and bad for testing purposes
    """
    bad_completion = MagicMock()
    bad_completion.choices[0].message.parsed = bad_result

    good_completion = MagicMock()
    good_completion.choices[0].message.parsed = good_result

    with patch("aiSuggestion.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.parse.side_effect = [
            bad_completion,
            good_completion
        ]

        bad = aiSuggestion(
            "def add_numbers(a, b):",
            "create a function that adds 2 numbers together"
        )

        good = aiSuggestion(
            "def add_numbers(a, b):",
            "create a function that adds 2 numbers together"
        )

        assert ";" in bad.suggestion

        assert ";" not in good.suggestion
        assert good.suggestion == "    return a + b"