from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.nlp.stemmers import Stemmer
from sumy.summarizers.luhn import LuhnSummarizer
from sumy.summarizers.edmundson import EdmundsonSummarizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.utils import get_stop_words
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
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

    def t5_summarize(self,text):
        tokenizer = AutoTokenizer.from_pretrained('t5-base')                        
        model = AutoModelForSeq2SeqLM.from_pretrained('t5-base', return_dict=True) 

        inputs = tokenizer.encode("summarize: " + text,                  
        return_tensors='pt',              
        max_length=512,             
        truncation=True)

        summary_ids = model.generate(inputs, max_length=150, min_length=80, length_penalty=5., num_beams=2)

        summary = tokenizer.decode(summary_ids[0])

        return summary                                         






