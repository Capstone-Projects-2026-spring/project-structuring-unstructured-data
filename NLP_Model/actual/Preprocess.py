import pandas as pd
from datetime import datetime as dt
import time


class Preprocess:
    dt = dt.now()
    current_week = dt.strftime('%U')

    def __init__(self):
        pass
    def create_user_list(self,df):
        user_list = df['user'].unique()
        return user_list
    
    def create_links_df(self,df):

        link_re = '<https?://[^\s<>"{}|\\^`\[\]]+>'

        link_df = df[df['text'].str.contains(link_re,regex = True)]

        return link_df

    def extract_links(self,df):

        link_re = '<https?://[^\s<>"{}|\\^`\[\]]+>'

        link_df = df[~df['text'].str.contains(link_re,regex = True)]

        return link_df
    
    def create_channel_joins_df(self,df):

        ujoin_re = '<(?:.*?)> has joined the channel'

        ujoin_df = df[df['text'].str.contains(ujoin_re,regex = True)]

        return ujoin_df
    
    def extract_channel_joins(self,df):

        ujoin_re = '<(?:.*?)> has joined the channel'

        ujoin_df = df[~df['text'].str.contains(ujoin_re,regex = True)]

        return ujoin_df
    
    def delete_emojis(self,df):

        emoji_re =':(?:.*?):'

        ret_df = df['text'].str.replace(emoji_re,'',regex = True)

        return ret_df
    
    def normal_preprocess(self,dict):

        for coll in dict:
            df = dict[coll]

            df = self.extract_channel_joins(df)
            df = self.extract_links(df)
            df = self.delete_emojis(df)

            dict[coll] = df

        return dict

    def add_day_of_week(self,df):
        df['ts'] = pd.to_datetime(df['ts'],unit='s')

        df['day_name'] = df['ts'].dt.day_name()

        return df
    
    def add_week_of(self,df):
        df['ts'] = pd.to_datetime(df['ts'],unit='s')

        df['week_of'] = df['ts'].dt.strftime('%U')

        df['week_of'] = df['week_of'].astype(int)

        print(self.current_week)



        return df
    
    def display_collection_df(self,):
        pass

    def create_final_dict(self,coll_name,user='all',df):
        col = ['channel_name','user','sum_text','ts']
        final_df = pd.Dataframe(columns=col)

        if user == 'all':
            pass
        #final_df['channel_name'] = 






