from dotenv import load_dotenv
from google import genai
import os
import pandas as pd

class Summarizer:
    def __init__(self):
        pass

    def gemini_summarize(self,text):
        # Load in gemini api key
        load_dotenv()
        gemini_api = os.getenv('GEMINI_API_KEY')
        print("ENV KEY:", os.getenv("GEMINI_API_KEY"))

        client = genai.Client(api_key=gemini_api)

        response = client.models.generate_content(
            model="gemini-3-flash-preview", 
            contents=f"Summarize the main points through bullet points and only return the bullet points. If there is nothing to summarize, just put Nothing to summarize: \n{text}"
        )
        print(response.text)
        return response.text