from MongoConnect import MongoConnect
from Summarizer import Summarizer
from DataProcess import DataProcess
from dotenv import load_dotenv
import os
import pandas as pd
# Type py -3.14 model.py to run



# Connect and extract collections
load_dotenv()
mongo_user = os.getenv('MONGODB_USER')
mongo_password = os.getenv('MONGODB_PASSWORD')
ext_db = 'slack'

# Creating mongo connection instance
inst = MongoConnect(mongo_user,mongo_password)
inst.extract(ext_db)

dp_inst = DataProcess()


coll_dict = {}

# Main message dictionary
base_dir = os.path.dirname(os.path.abspath(__file__))
collections_path = os.path.join(base_dir, 'collections')


# Load data into dataframes
cols = ['user', 'type', 'text', 'ts']

# File loading
for file in os.listdir(collections_path):
    filepath = os.path.join(collections_path, file)
    
    df = pd.read_json(filepath, lines=True)

    # Filter out bot messages before selecting cols
    if 'subtype' in df.columns:
        df = df[df['subtype'] != 'bot_message']

    # Skip if any required column is missing
    if not all(c in df.columns for c in cols):
        print(f'Skipping {file} - missing required columns')
        continue

    df = df[cols]
    df = df[df['user'].notna()]  # drop rows without a user

    coll_dict[file.replace('.json', '')] = df

#------Preprocessing---------
coll_dict = dp_inst.normal_preprocess(coll_dict)

#print(coll_dict)
#print(dp_inst.filter_by_week(coll_dict,11))

# Create final summarized dataframe for each user for the current week
curr = dp_inst.create_final_dict(coll_dict,dp_inst.current_week)

# Create final summarized dataframe for the past week
# Will integrate storage for this, but this is for the demo
#print(str(int(dp_inst.current_week)-1))
past = dp_inst.create_final_dict(coll_dict,dp_inst.current_week-1)

print(past)
inst.send(curr,'cw')
inst.send(past,'pw')
#us_ls = dp_inst.user_list('all-structuring-data',coll_dict)

#dp_inst.create_user_summary(coll_dict,us_ls[1],'all-structuring-data')
#df = pre_inst.add_day_of_week(coll_dict['social'])
#df = pre_inst.add_week_of(coll_dict['social'])

#print(coll_dict)


# Clear collections folder at the end of the program
inst.clear_folder()