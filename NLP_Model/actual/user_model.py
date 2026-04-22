from MongoConnect import MongoConnect
from Summarizer import Summarizer
from DataProcess import DataProcess
from dotenv import load_dotenv
import os
import sys
from datetime import datetime, timezone
# Type `py -3.14 user_model.py {channelKey}` to run

def parse_args(argv):
    db_name = 'slack'

    for arg in argv[1:]:
        if not arg.startswith('--'):
            db_name = arg

    return db_name


def extract_all_channel_messages(inst, db_name):
    message_cols = ['user', 'type', 'text', 'ts']
    raw_df = inst.extract(db_name, 'raw_messages', message_cols)

    required_cols = {'user', 'text', 'ts'}
    missing_cols = required_cols - set(raw_df.columns)
    if missing_cols:
        print(f"Missing required columns from raw_messages: {sorted(missing_cols)}")
        sys.exit(1)

    if 'type' in raw_df.columns:
        raw_df = raw_df[raw_df['type'].fillna('') == 'message']

    raw_df = raw_df.dropna(subset=['user', 'text'])
    return raw_df


def get_distinct_users(df):
    if df.empty or 'user' not in df.columns:
        return []

    users = df['user'].dropna().astype(str).str.strip()
    users = users[users != '']
    return users.unique().tolist()


def build_user_summary(full_df, user_list, db_name, summarizer, data_process, member_lookup=None):
    if member_lookup is None:
        member_lookup = {}

    user_summaries = []

    for user_id in user_list:
        # Week-specific metrics
        

        # ALL messages ever for the summary text
        user_all_df = data_process.filter_by_user(full_df, user_id)
        if user_all_df.empty:
            continue

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
            'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'message_count': message_count,
            'summary_text': summary_text,
            'status': 'ok',
        })

    return user_summaries


# Import arguments from command line
dbName = parse_args(sys.argv)

# Connect and extract collections
load_dotenv()
mongo_user = os.getenv('MONGODB_USER')
mongo_password = os.getenv('MONGODB_PASSWORD')
ext_db = dbName

# Creating mongo connection instance
inst = MongoConnect(mongo_user, mongo_password)
chan_df = extract_all_channel_messages(inst, ext_db)

# Summarizer initalizer
sum_inst = Summarizer()

# Preprocessing Data
dp_inst = DataProcess()
proc_df = dp_inst.normal_preprocess(chan_df)

#----------USER SUMMARIES-------------------------------------
user_list = get_distinct_users(proc_df)

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


inst.send_user_summaries(dbName, user_summaries)