from datetime import datetime as dt
from Summarizer import Summarizer

import pandas as pd
import time

class DataProcess:
    dt = dt.now()
    current_week = int(dt.strftime('%U'))

    def __init__(self):
        pass
    
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
    
    def user_list(self,coll,dic):
        
        df = dic[coll]
        ret_list = df['user'].unique()

        return ret_list
    
    def delete_emojis(self,df):

        emoji_re =':(?:.*?):'

        df['text'] = df['text'].str.replace(emoji_re, '', regex=True)

        return df
    
    def normal_preprocess(self,dic):

        for coll in dic:
            df = dic[coll]
            #print(df.info())

            df = self.extract_channel_joins(df)
            df = self.extract_links(df)
            df = self.delete_emojis(df)
            df = self.add_day_of_week(df)
            df = self.add_week_of(df)

            dic[coll] = df

        return dic

    def add_day_of_week(self, df):
        df['ts'] = pd.to_datetime(df['ts'], unit='s')

        df['day_name'] = df['ts'].dt.day_name()

        return df
    
    def add_week_of(self, df):
        df['ts'] = pd.to_datetime(df['ts'], unit='s')

        df['week_of'] = df['ts'].dt.strftime('%U')

        df['week_of'] = df['week_of'].astype(int)

        #print(self.current_week)

        return df
    
    def display_collection_df(self,):
        pass

    def filter_by_week(self,dic,week_num=current_week):
        filt_week = {}
        for coll in dic:
            df = dic[coll]
            filt_week[coll] = df[df['week_of'] == week_num]

        return filt_week
    
    def create_user_summary(self,df,user,coll):

        summarize = Summarizer()

        user_text = '.'.join(df['text'])

        #t5_summary = summarize.t5_summarize(user_text)
        lsa_summary = summarize.lsa_summarize(user_text)
        #luhn_summary =summarize.luhn_summarize(user_text)

        #print(user_text)
        #print(t5_summary)
        #print(lsa_summary)
        #print(luhn_summary)

        return str(lsa_summary)
        


    def create_final_dict(self, dic,week_num = current_week):
        col = ['day', 'week_of','user', 'sum_text']
        final_df = pd.DataFrame(columns=col)
        final_dic = {}
        
        dic = self.filter_by_week(dic,week_num)
       #print(dic)
        
        for coll in dic:
            df = dic[coll]
            users = df['user'].unique()

            #print(df)

            rows = []
            for day in df['day_name'].unique():
                day_df = df[df['day_name'] == day]
                #print('----------------Day Filter-----------------------')
                #print(day_df)
                for user in users:
                    user_df = day_df[day_df['user'] == user]
                    #print('----------------User Filter-----------------------')
                    #print(user)
                    #print(user_df)

                    rows.append({
                        'day': day,
                        'week_of':week_num,
                        'user': user,
                        'sum_text': self.create_user_summary(user_df,user,coll)        
                    })
        
            final_df = pd.DataFrame(rows, columns=col)
            #print(final_df)
            final_dic[f'{coll}_S'] = final_df

            #print(final_dic)

            
        return final_dic



        #final_df['channel_name'] = 
