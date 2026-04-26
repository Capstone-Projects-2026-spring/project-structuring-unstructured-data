from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo.database import Database
from dotenv import load_dotenv
import pandas as pd
import os
import json

class MongoConnect:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    collections_path = os.path.join(base_dir, 'collections')

    def __init__(self,user, password):
        self.user = user
        self.password = password

    # Establishes connection to the mongo database
    def connect(self,user,password):
        uri = f"mongodb+srv://{user}:{password}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster"

        client = MongoClient(uri, server_api=ServerApi('1'))

        try:
            client.admin.command('ping')
            print("Pinged your deployment. You successfully connected to MongoDB!")
            return client
        except Exception as e:
            print(e)



    def extract(self,database,collection,col_filter):
        '''
        Maps a collection name to all of the messages 
        within the corresponding channel
        '''

        # Establishes connection
        client = self.connect(self.user,self.password)

        # Extracts collection of raw messages within the channel database
        db_inst = Database(client,database)
        coll_names = db_inst.list_collection_names()

        test = db_inst.get_collection(collection)

        docs = []
        with test.find() as cursor:
            for doc in cursor:
                doc.pop('_id')
                docs.append(doc)

        df = pd.DataFrame(docs)
    
        # Filter to only the columns you want
        cols = col_filter
        available_cols = [c for c in cols if c in df.columns]
    
        return df[available_cols]
    
    


        '''
        # Writes documents into corresponding collection files
        for collection in coll_names:
            temp = db_inst.get_collection(collection)
            #print(temp)
            #print(temp.count_documents({}))
            if temp.count_documents({}) == 0:
                
                continue
            file = open(os.path.join(self.collections_path, f'{collection}.json'), 'w')
            with temp.find() as cursor:
                for doc in cursor:
                    doc.pop('_id')
                    file.write(json.dumps(doc) + '\n')
        '''

    def send(self, dic, time):
     client = self.connect(self.user, self.password)

     for db in dic:
        df = dic[db]
        db_name = f'{db}_{time}'

        # Gets rid of the database if it exists

        client.drop_database(db_name)

        db_inst = Database(client, db_name)

        for day in df['day'].unique():
            filt_df = df[df['day'] == day].drop('day', axis=1, errors='ignore')

            if filt_df.empty:
                continue  # skip empty DataFrames

            db_inst[day].insert_many(filt_df.to_dict('records'))  # add 'records'

     return 1

    def upsert_day_summaries(self, database, summaries):
        client = self.connect(self.user, self.password)
        db_inst = Database(client, database)
        summaries_coll = db_inst.get_collection('summaries')

        upserted_count = 0
        for summary_doc in summaries:
            summary_day_utc = summary_doc.get('summary_day_utc')

            if summary_day_utc is None:
                continue

            # Remove all older duplicates for the same day, then store only the newest summary.
            summaries_coll.delete_many({'summary_day_utc': summary_day_utc})
            result = summaries_coll.insert_one(summary_doc)

            if result.inserted_id is not None:
                upserted_count += 1

        return upserted_count
    
    def send_user_summaries(self,database,summaries):
        client = self.connect(self.user, self.password)
        db_inst = Database(client, database)
        summaries_coll = db_inst.get_collection('user_summaries')

        upserted_count = 0
        for summary_doc in summaries:
            user_id = summary_doc.get('user_id')

            if user_id is None:
                continue

            result = summaries_coll.update_one(
                {'user_id': user_id},
                {'$set': summary_doc},
                upsert=True
            )

            if result.modified_count > 0 or result.upserted_id is not None:
                upserted_count += 1

        return upserted_count



    
    def get_member_lookup(self, database):
        '''Returns a dict mapping member_id -> real_name'''
        client = self.connect(self.user, self.password)
        db_inst = Database(client, database)
        members_coll = db_inst.get_collection('members')

        lookup = {}
        with members_coll.find({}, {'member_id': 1, 'real_name': 1}) as cursor:
            for doc in cursor:
                if doc.get('member_id') and doc.get('real_name'):
                    lookup[doc['member_id']] = doc['real_name']

        return lookup


    def clear_folder(self):
        '''
        Clears collections folder
        '''
        for collection in os.listdir(self.collections_path):
            os.remove(os.path.join(self.collections_path, f'{collection}'))
        return 1
        

if __name__ == '__main__':
    
    # Variable initialization
    ext_database = 'slack'
    send_database = 'slack_structured'
    # Loading environment variables
    load_dotenv()
    mongo_user = os.getenv('MONGODB_USER')
    mongo_password = os.getenv('MONGODB_PASSWORD')

    # Creating mongo connection instance
    inst = MongoConnect(mongo_user,mongo_password)

    print(inst.extract(ext_database))
