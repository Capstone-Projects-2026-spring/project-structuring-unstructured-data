from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo.database import Database
from dotenv import load_dotenv
import os
import json

class MongoConnect:

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


    def extract(self,database):
        '''
        Maps a collection name to all of the messages 
        within the corresponding channel
        '''
        # Establishes connection
        client = self.connect(self.user,self.password)

        # Extracts all collections within the database
        db_inst = Database(client,database)
        coll_names = db_inst.list_collection_names()

        # Writes documents into corresponding collection files
        for collection in coll_names:
            temp = db_inst.get_collection(collection)
            #print(temp)
            #print(temp.count_documents({}))
            if temp.count_documents({}) == 0:
                
                continue
            file = open(f'collections\{collection}.json','w')
            with temp.find() as cursor:
                for doc in cursor:
                    doc.pop('_id')
                    file.write(json.dumps(doc) + '\n')
        return 1

    def send(self, dic, time):
     client = self.connect(self.user, self.password)

     for db in dic:
        df = dic[db]
        db_inst = Database(client, f'{db}_{time}')

        for day in df['day'].unique():
            filt_df = df[df['day'] == day].drop('day', axis=1, errors='ignore')

            if filt_df.empty:
                continue  # skip empty DataFrames

            db_inst[day].insert_many(filt_df.to_dict('records'))  # add 'records'

     return 1


    def clear_folder(self):
        '''
        Clears collections folder
        '''
        for file in os.listdir('collections'):
            os.remove(f'collections\{file}')
        return 1
        
'''
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
'''