#import textacy
#import spacy
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
file = 'data/test_data/messages.csv'
columns = ['channel_id','text','ts','type','user']

# Uploads csv file and turns it into a dataframe
df = pd.read_csv(file,usecols=columns)

# Deletes empty messages
df = df.dropna(how='any')

# Creates a dataframe for channel join notifications
df_cjoin = df[df['text'].str.contains('> has joined the channel')]
df =  df[~df['text'].str.contains('> has joined the channel')]

# Sorts data by channel_ids
df_cid = df.sort_values(by='channel_id')



