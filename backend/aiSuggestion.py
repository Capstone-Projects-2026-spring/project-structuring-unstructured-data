import os
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

def aiSuggestion(currentCode, problemPrompt):

    # This loads the variables from your .env file into the environment
    load_dotenv()

    # The client will now automatically find the key from your .env file
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    class SingleSuggestion(BaseModel):
        suggestion: str
        explanation: str

    class CodeResponse(BaseModel):
        suggestions: list[SingleSuggestion]

    # Define the chat completion request
    completion = client.chat.completions.parse(
        model="gpt-5-mini",  # Or your preferred model (e.g., gpt-4o-mini)
        messages=[
            {"role": "system", "content": "You are a helpful and concise programming assistant specialized in python. Only give next line suggestions. You are going to assist the user in finishing this problem. " + problemPrompt},
            {"role": "user", "content": "give me 3 different suggestions for the next line of this code: " + currentCode}
        ],
        response_format=CodeResponse,
    )

    # Access the structured data
    result = completion.choices[0].message.parsed
    return result