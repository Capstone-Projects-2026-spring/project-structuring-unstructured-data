import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def aiSuggestion(currentCode, problemPrompt):
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful and concise programming assistant. "
                    "Only give next-line suggestions. "
                    "You are assisting the user in finishing this problem: " + problemPrompt + "\n\n"
                    "Respond ONLY with a JSON object in this exact format, no markdown, no extra text:\n"
                    '{"suggestions": [{"suggestion": "...", "explanation": "..."}, ...]}'
                ),
            },
            {
                "role": "user",
                "content": "Give me 3 different suggestions for the next line of this code:\n" + currentCode,
            },
        ],
    )

    raw = completion.choices[0].message.content
    data = json.loads(raw)

    # Normalise into the shape routes_ai.py expects
    class _Suggestion:
        def __init__(self, suggestion, explanation):
            self.suggestion = suggestion
            self.explanation = explanation

    class _Response:
        def __init__(self, suggestions):
            self.suggestions = suggestions

    suggestions = [
        _Suggestion(s.get("suggestion", ""), s.get("explanation", ""))
        for s in data.get("suggestions", [])
    ]
    return _Response(suggestions)
