#import textacy
#import spacy
from sumy.nlp.tokenizers import Tokenizer
import nltk
import pandas as pd
import re
import os
'''
###Data preprocessing###
- Ensures that the dataframe grabs data according to 
the data schema. Only difference is channel_id to differentiate
channels from the test data.

- Deletes entries without any messages

- Filters out channel joining messages

Resulting dataframes:

df_cid -> Dataframe that's sorted by channel ID
df_cjoin -> Dataframe containing channel joins
df_links -> Dataframe containing links
df_mess -> Dataframe containing messages 

'''
#print(os.getcwd())
#print(os.path.exists('test_data/messages.csv')) # prints True or False
#print(os.listdir('test_data')) # shows all files in current directory
mess_file = 'test_data/messages.csv'
#user_file = 'NLP_Model\mock\test_data\users.csv'
columns = ['channel_id','text','ts','type','user']

# Uploads csv file and turns it into a dataframe
df = pd.read_csv(mess_file,usecols=columns)
#users_df = pd.read_csv(user_file)
dic = {}
dic_chanu = {}

# Deletes empty messages
df = df.dropna(how='any')

# Creates a dataframe for channel join notifications
df_cjoin = df[df['text'].str.contains('> has joined the channel')]
df =  df[~df['text'].str.contains('> has joined the channel')]

# Sorts data by channel_ids
df_cid = df.sort_values(by='channel_id')

col_cid = df['channel_id'].unique()
col_uid = df['user'].unique()
print(col_cid)
print(len(col_cid))
print(col_uid)
print(len(col_uid))
#df.loc['C014LS99C1K',['channel_id']]
print(df.loc[df['channel_id'] == 'C014LS99C1K'])

'''
for channel in col_cid:
    #print(df.loc[df['channel_id'] == channel])
    dic[channel] = df.loc[df['channel_id'] == channel]
    dic_chanu[channel] = dic[channel]
    #print('---------------------------------------------------------------------')
#print(dic)
#--------------------------------------------------------------------------------------
#--------------------------------------------------------------------------------------
nltk.download('punkt_tab')
nltk.download('stopwords')

tokenizer = Tokenizer('en')

for channel in dic:
    print(dic[channel])
'''
