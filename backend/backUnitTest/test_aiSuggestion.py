import unittest
from unittest.mock import patch
from backend.aiSuggestion import aiSuggestion


class test_aiSuggestion(unittest.TestCase):
    def test_response(self):
        test = aiSuggestion("def add_numbers(a,b):", "create a function that adds 2 numbers together")
        self.assertIsNotNone(test)  # add assertion here

    def test_3_suggestions(self):
        test = aiSuggestion("def add_numbers(a,b):", "create a function that adds 2 numbers together")
        self.assertEqual(len(test.suggestions),3)

    def test_fields(self):
        test = aiSuggestion("def add_numbers(a,b):", "create a function that adds 2 numbers together")
        for s in test.suggestions:
            self.assertTrue(s.suggestion.strip())
            self.assertTrue(s.explanation.strip())

    def test_api_raises_exception(self):
        """Should propagate exceptions raised by the OpenAI client."""
        with patch("backend.aiSuggestion.OpenAI") as MockOpenAI, \
                patch("backend.aiSuggestion.load_dotenv"), \
                patch("backend.aiSuggestion.os.getenv", return_value="fake-key"):

            MockOpenAI.return_value.chat.completions.parse.side_effect = Exception("API error")

            with self.assertRaises(Exception) as ctx:
                aiSuggestion("def add_numbers(a,b):", "add two numbers")
            self.assertEqual(str(ctx.exception), "API error")

if __name__ == '__main__':
    unittest.main()
