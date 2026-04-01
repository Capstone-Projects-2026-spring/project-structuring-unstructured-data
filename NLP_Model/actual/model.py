from MongoConnect import MongoConnect
from Summarizer import Summarizer
from DataProcess import DataProcess
from dotenv import load_dotenv
import os
import pandas as pd
import sys
# Type py -3.14 model.py to run


def parse_args(argv):
    db_name = 'slack'  # default database name
    week_num = 11
    test_mode = False

    i = 1
    while i < len(argv):
        arg = argv[i]

        if arg == '--test-mode':
            test_mode = True
        elif arg == '--week' and i + 1 < len(argv):
            try:
                week_num = int(argv[i + 1])
            except ValueError:
                print(f"Invalid week value: {argv[i + 1]}. Falling back to week {week_num}.")
            i += 1
        elif arg.startswith('--week='):
            try:
                week_num = int(arg.split('=', 1)[1])
            except ValueError:
                print(f"Invalid week value: {arg.split('=', 1)[1]}. Falling back to week {week_num}.")
        elif not arg.startswith('--'):
            db_name = arg

        i += 1

    return db_name, week_num, test_mode


def print_test_mode_output(db_name, week_num, chan_df, proc_df, cproc_df, text):
    print('[TEST MODE] Gemini call skipped.')
    print(f'[TEST MODE] Channel DB: {db_name}')
    print(f'[TEST MODE] Week: {week_num}')
    print(f'[TEST MODE] Messages extracted: {len(chan_df)}')
    print(f'[TEST MODE] Messages after preprocess: {len(proc_df)}')
    print(f'[TEST MODE] Messages in selected week: {len(cproc_df)}')

    day_chunks = cproc_df['day_name'].nunique() if 'day_name' in cproc_df.columns else 0
    print(f'[TEST MODE] Generated day chunks: {day_chunks}')

    if text and text != 'Nothing to chunk':
        preview = text[:700]
        print('[TEST MODE] Preview:')
        print(preview)

        users = cproc_df['user'].nunique() if 'user' in cproc_df.columns else 0
        print('[TEST MODE] Final summary output:')
        print(f'TEST SUMMARY for {db_name}')
        print(f'- Week: {week_num}')
        print(f'- Days with activity: {day_chunks}')
        print(f'- Distinct users: {users}')
        print(f'- Total messages processed: {len(cproc_df)}')
        print('- Status: pipeline executed successfully without LLM call')
    else:
        print('[TEST MODE] Final summary output:')
        print('No content found for the selected channel/week in test mode.')


# Import arguments from command line
dbName, week_num, test_mode = parse_args(sys.argv)

# Connect and extract collections
load_dotenv()
mongo_user = os.getenv('MONGODB_USER')
mongo_password = os.getenv('MONGODB_PASSWORD')
ext_db = dbName

# Creating mongo connection instance
inst = MongoConnect(mongo_user,mongo_password)
chan_df = inst.extract(ext_db)

required_cols = {'text', 'ts'}
missing_cols = required_cols - set(chan_df.columns)
if missing_cols:
    print(f"Missing required columns from extracted data: {sorted(missing_cols)}")
    sys.exit(1)

# Preprocessing Data
dp_inst = DataProcess()
proc_df = dp_inst.normal_preprocess(chan_df)
cproc_df = dp_inst.filter_by_week(proc_df,week_num)
#text = ' '.join(proc_df['text'].dropna().astype(str).tolist())

# Summarizer initalizer
sum_inst = Summarizer()



#--------------TOTAL SUMMARY----------------
text = dp_inst.chunk_by_day(cproc_df)
if test_mode:
    print_test_mode_output(dbName, week_num, chan_df, proc_df, cproc_df, text)
    sys.exit(0)

sum_text = sum_inst.gemini_summarize(text)

print(sum_text)

'''
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
'''