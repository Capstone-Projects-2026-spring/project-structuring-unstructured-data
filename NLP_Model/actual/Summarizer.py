from dotenv import load_dotenv
from google import genai
from google.genai import types
import os
import pandas as pd

load_dotenv()

class Summarizer:
    def __init__(self):
        pass

    def gemini_summarize(self,text):
        try:
            # Load in gemini api key
            
            gemini_api = os.getenv('GEMINI_API_KEY')
            #print("ENV KEY:", os.getenv("GEMINI_API_KEY"))

            # Number of bullet points
            bp = '3'

            mp = 'Summarize the main tasks'
            mt = 'Summarize the main completed tasks'


            client = genai.Client(api_key=gemini_api)

            response = client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=f"For each day section, {mp} and {mt} in {bp} bullet points each and just return the bullet points\n{text}",
                config=types.GenerateContentConfig(
                    system_instruction="You are a Slack message summarizer. Be concise and professional.",
                    temperature=0.3,        # lower = more consistent summaries
                    )
            )
            #print(response.text)
            return response.text
        except Exception as e:
            print(f'Error: {e}')
            return 'Please try again later'