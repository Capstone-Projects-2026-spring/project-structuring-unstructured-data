from datetime import datetime as dt
from calendar import day_name
from Summarizer import Summarizer

import pandas as pd
import time

class DataProcess:
    dt = dt.now()
    current_week = int(dt.strftime('%U'))

    def __init__(self):
        pass

    def _normalize_ts(self, df):
        # Slack timestamps often come in as strings like 1774895194.086679.
        # Convert them to numeric epoch seconds first, then to datetime.
        ts_numeric = pd.to_numeric(df['ts'], errors='coerce')
        df['ts'] = pd.to_datetime(ts_numeric, unit='s', errors='coerce')
        return df
    
    def create_links_df(self,df):

        link_re = r'<https?://[^\s<>"{}|\\^`\[\]]+>'

        link_df = df[df['text'].str.contains(link_re,regex = True)]

        return link_df

    def extract_links(self,df):

        link_re = r'<https?://[^\s<>"{}|\\^`\[\]]+>'

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
    
    def normal_preprocess(self,df):

        df = self.extract_channel_joins(df)
        df = self.extract_links(df)
        df = self.delete_emojis(df)
        df = self.add_day_of_week(df)
        df = self.add_week_of(df)

        return df

    def add_day_of_week(self, df):
        df = self._normalize_ts(df)

        df['day_name'] = df['ts'].dt.day_name()

        return df
    
    def add_week_of(self, df):
        if not pd.api.types.is_datetime64_any_dtype(df['ts']):
            df = self._normalize_ts(df)

        df['week_of'] = df['ts'].dt.strftime('%U')

        df['week_of'] = df['week_of'].astype(int)

        #print(self.current_week)

        return df

    def infer_week_of(self, df):
        if df.empty:
            return None

        if 'week_of' not in df.columns:
            df = self.add_week_of(df.copy())

        week_values = pd.to_numeric(df['week_of'], errors='coerce').dropna().astype(int)
        if week_values.empty:
            return None

        unique_weeks = week_values.unique()
        if len(unique_weeks) == 1:
            return int(unique_weeks[0])

        # If the slice spans multiple weeks, use the most common week so the
        # summary stays anchored to the dominant timestamp group.
        return int(week_values.mode().iloc[0])
    
    def display_collection_df(self,):
        pass

    def filter_by_week(self,df,week_num=current_week):
        df = df[df['week_of'] == week_num]

        return df
    
    def create_user_summary(self,df,user,coll):

        summarize = Summarizer()

        user_text = '.'.join(df['text'])

        #Gemini LLM
        summary = summarize.gemini_summarize(user_text)

        #print(user_text)
        #print(t5_summary)
        #print(lsa_summary)
        #print(luhn_summary)

        return str(summary)
        


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
    
    def filter_by_day(self,df,day):
        df = df[df['day_name'] == day]

        return df
    
    def filter_by_user(self,df,user):
        df = df[df['user'] == user]

        return df
    
    def chunk_by_day(self, df):
        # Build one string with all days
        chunks = []
        for day, group in df.groupby('day_name'):
            text = '\n'.join(group['text'].dropna().astype(str).tolist())
            if text.strip():
                chunks.append(f"--- {day} ---\n{text}")

        # Combine all days into one string
        full_text = '\n\n'.join(chunks)

        if not full_text.strip():
            return 'Nothing to chunk'

        
        return full_text

    def chunk_text_by_day(self, df):
        if df.empty or 'day_name' not in df.columns:
            return {}

        # Keep day order stable (Monday..Sunday), then append any unexpected labels.
        day_order = {name: idx for idx, name in enumerate(day_name)}
        grouped = []
        for day, group in df.groupby('day_name'):
            text = '\n'.join(group['text'].dropna().astype(str).tolist()).strip()
            if text:
                grouped.append((day, text))

        grouped.sort(key=lambda item: day_order.get(item[0], 99))
        return {day: text for day, text in grouped}

    
    

    

    #def UID_to_UName(self,dic):



        #final_df['channel_name'] = 
