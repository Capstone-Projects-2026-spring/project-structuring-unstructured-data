import unittest
from backend.aiSuggestion import aiSuggestion


class tese_aiSuggestion(unittest.TestCase):
    def test_3_suggestions(self):
        test = aiSuggestion("def add_numbers(a,b):", "create a function that adds 2 numbers together")
        self.assertEqual(len(test), 3)  # add assertion here


if __name__ == '__main__':
    unittest.main()
