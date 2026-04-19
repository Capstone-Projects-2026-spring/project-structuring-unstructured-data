from MongoConnect import MongoConnect
from Summarizer import Summarizer
from DataProcess import DataProcess
from dotenv import load_dotenv
import os
import pandas as pd
import sys
import json
from datetime import datetime, timezone, timedelta

def parse_args(argv):
    db_name = 'slack'  # default database name
    week_num = None  # derive from data unless explicitly provided
    week_start = None

    i = 1
    while i < len(argv):
        arg = argv[i]

        if arg == '--week' and i + 1 < len(argv):
            try:
                week_num = int(argv[i + 1])
            except ValueError:
                print(f"Invalid week value: {argv[i + 1]}. Falling back to week {week_num}.")
            i += 1
        elif arg == '--week-start' and i + 1 < len(argv):
            week_start = argv[i + 1]
            i += 1
        elif arg.startswith('--week='):
            try:
                week_num = int(arg.split('=', 1)[1])
            except ValueError:
                print(f"Invalid week value: {arg.split('=', 1)[1]}. Falling back to week {week_num}.")
        elif arg.startswith('--week-start='):
            week_start = arg.split('=', 1)[1]
        elif not arg.startswith('--'):
            db_name = arg

        i += 1

    return db_name, week_num, week_start

def build_user_summary(full_df, user_list, db_name, summarizer, data_process, member_lookup={}):
    user_summaries = []

    for user_id in user_list:
        # Week-specific metrics
        

        # ALL messages ever for the summary text
        user_all_df = data_process.filter_by_user(full_df, user_id)

        real_name = member_lookup.get(user_id, user_id)
        message_count = int(len(user_all_df))

        # Use all messages for the summary
        user_text = ' '.join(user_all_df['text'].dropna().astype(str).tolist())
        if not user_text.strip():
            continue

        
        summary_text = summarizer.user_summarize(user_text)

        user_summaries.append({
            'user_id': user_id,
            'real_name': real_name,
            'channel_db': db_name,
            'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'message_count': message_count,
            'summary_text': summary_text,
            'status': 'ok',
        })

    return user_summaries


# Import arguments from command line
dbName, week_num, week_start_arg = parse_args(sys.argv)

# Connect and extract collections
load_dotenv()
mongo_user = os.getenv('MONGODB_USER')
mongo_password = os.getenv('MONGODB_PASSWORD')
ext_db = dbName

# Creating mongo connection instance
inst = MongoConnect(mongo_user,mongo_password)
chan_df = inst.extract(ext_db,'raw_messages',['user', 'type', 'text', 'ts'])
mem_df = inst.extract(ext_db,'members',['member_id','team_id','name','real_name'])

# Summarizer initalizer
sum_inst = Summarizer()


required_cols = {'text', 'ts'}
missing_cols = required_cols - set(chan_df.columns)
if missing_cols:
    print(f"Missing required columns from extracted data: {sorted(missing_cols)}")
    sys.exit(1)

# Preprocessing Data
dp_inst = DataProcess()
proc_df = dp_inst.normal_preprocess(chan_df)

#----------USER SUMMARIES-------------------------------------
user_list = dp_inst.user_list(proc_df)

# Fetch member lookup — use the channel-specific DB name
member_lookup = inst.get_member_lookup(dbName)


user_summaries = build_user_summary(
    proc_df,
    user_list,
    dbName,
    sum_inst,
    dp_inst,
    member_lookup
)

for doc in user_summaries:
    print(f"\n--- {doc['real_name']} ({doc['user_id']}) ---")
    #print(f"Messages: {doc['message_count']} | Active days: {doc['active_days']}")
    print(doc['summary_text'])


inst.send_user_summaries(dbName,user_summaries)