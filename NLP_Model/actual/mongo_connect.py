import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo.database import Database
from pymongo.collection import Collection
from dotenv import load_dotenv

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
        Returns a dictionary that maps a collection name to all of the messages 
        within the corresponding channel
        '''
        # Initialize resulting dictionary
        res = {}

        # Establishes connection
        client = self.connect(self.user,self.password)

        # Extracts all collections within the database
        db_inst = Database(client,database)
        coll_names = db_inst.list_collection_names()

        # Maps collection name to its messages
        for collection in coll_names:
            temp = db_inst.get_collection(collection)
            res[collection] = []
            with temp.find() as cursor:
                for doc in cursor:
                    res[collection].append(doc)

        return res

        

        '''
        print(db_inst.list_collection_names())
        print(db_inst.get_collection('all-structuring-data'))
        print(col_inst.find())
        with col_inst.find() as cursor:
            for doc in cursor:
                print(doc)
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
#mongo_user = os.getenv()
'''
uri = "mongodb+srv://<db_username>:<db_password>@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))
# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)
'''