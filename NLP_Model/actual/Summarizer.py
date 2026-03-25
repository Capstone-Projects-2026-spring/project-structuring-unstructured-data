from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.nlp.stemmers import Stemmer
from sumy.summarizers.luhn import LuhnSummarizer
from sumy.summarizers.edmundson import EdmundsonSummarizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.utils import get_stop_words
from dotenv import load_dotenv
from google import genai
#import google.generativeai as genai
import os
import pandas as pd
import nltk
import torch
nltk.download('punkt')

class Summarizer:
    def __init__(self):
        pass

    def tokenize_series(self,df):
        nltk.download('punkt')
        '''
        Argument:
        dict - A pandas series containing preprocessed 
        messages from the mongo database

        Returns:
        A series that tokenizes all words in the
        received series 
        '''

        combined_string = ''.join(df['text'])

        # Initializes tokenizer
        tokenizer = Tokenizer('en')

        return combined_string
    
    def luhn_summarize(self,text, sentence_count=2):
        '''
        Frequency based
        '''
        # Parse the input text
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
    
        # Initialize summarizer with stemmer
        summarizer = LuhnSummarizer(Stemmer("english"))
        summarizer.stop_words = get_stop_words("english")
    
        # Generate summary
        summary = summarizer(parser.document, sentence_count)
        return summary
    
    def lsa_summarize(self,text, sentence_count=2):
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        
        # Initialize LSA summarizer
        summarizer = LsaSummarizer(Stemmer("english"))
        summarizer.stop_words = get_stop_words("english")
    
        summary = summarizer(parser.document, sentence_count)
        return summary

        

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