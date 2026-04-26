from dotenv import load_dotenv
from google import genai
from google.genai import types
from datetime import datetime, timezone, timedelta
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
            
            sample_text = (
                "*Main tasks:*\n"
                "\t- Finalized API schema updates for summary retrieval endpoint\n"
                "\t- Reviewed preprocessing edge cases for Slack timestamp parsing\n"
                "\t- Coordinated MongoDB collection naming conventions\n"
                "*Completed tasks*\n"
                "\t- Merged parser fix for malformed ts values\n"
                "\t- Added week-based filtering to preprocessing pipeline\n"
                "\t- Verified local run for selected channel and week"
            )

            system_instruction = (
                "You are a Slack message summarizer. Be concise and professional. "
                "Return only the summary body, with no preamble, no markdown fences, and no extra commentary. "
                "Match the structure of the example as closely as possible. Keep the same section names, order, and bullet nesting. "
                "Use exactly two top-level sections: 'Main tasks' and 'Completed tasks'. Each section should contain up to three bullet points. "
                "If there is insufficient content for a section, keep the section and use a short placeholder bullet such as 'None'.\n\n"
                f"Example format:\n{sample_text}"
            )

            client = genai.Client(api_key=gemini_api)

            response = client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=(
                    "Summarize the following day section using the required structure. "
                    "The output must follow the example format exactly in section order and nesting.\n\n"
                    f"{text}"
                ),
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,        # lower = more consistent summaries
                    )
            )
            #print(response.text)
            return response.text
        except Exception as e:
            print(f'Error: {e}')
            return 'Please try again later'
        
    def user_summarize(self,text):
        now = datetime.now()
        
        try:
            # Load in gemini api key
            
            gemini_api = os.getenv('GEMINI_API_KEY')

            sample_text = (
                        "To-do\n"
                        "\t*   Verify Home tab visibility after PR merge without local execution.\n"
                        "\t*   Test new dashboard changes on the real workspace (post-demo) by updating bot event URLs.\n"
                        "\t*   Investigate 404 error and troubleshoot PR visibility issues.\n\n"
                        "Skills\n"
                        "\t*   MongoDB management\n"
                        "\t*   Bot permission configuring\n"
                        "\t*   App deployment links (ngrok, render)\n"
                        "\t*   Slack API event subscriptions\n\n"
                        "Completed tasks\n"
                        "\t*   Merged a dashboard PR.\n"
                        "\t*   Pushed new changes to the home dashboard, including admin permissions and channel storage statistics.\n"
                        "\t*   Stopped the app and reset deployment links to render.\n\n"
            )
            

            system_instruction = (
                "You are a Slack message summarizer. Be concise and professional. "
                "Return only the summary body, with no preamble, no markdown fences, and no extra commentary. "
                "Match the structure of the example as closely as possible. Keep the same section names, order, and bullet nesting. "
                "Use exactly three top-level sections: 'To-do','Skills','Completed tasks'."
                "The 'To-do' section should contain up to three bullet points outlining the main action items for the user."
                "The 'Skills' section should contain any number of bullet points describing the user's key skills and frequently mentioned topics based on the content provided."
                "Each bullet should be a single word or short phrase, not a full sentence."
                "The 'Completed tasks' section should contain up to three bullet points summarizing the main accomplishments or completed action items for the user. "
                "If there is insufficient content for a section, keep the section and use a short placeholder bullet such as 'None'.\n\n"
                f"Example format:\n{sample_text}"
            )

            client = genai.Client(api_key=gemini_api)

            response = client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=(
                    "Summarize the following user based on their messages using the required structure. "
                    "The output must follow the example format exactly in section order and nesting.\n\n"
                    f"{text}"
                ),
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,        # lower = more consistent summaries
                    )
            )
            #print(response.text)
            return response.text
        except Exception as e:
            print(f'Error: {e}')
            return 'Please try again later'
        