from MongoConnect import MongoConnect
from Summarizer import Summarizer
from DataProcess import DataProcess
from dotenv import load_dotenv
import os
import pandas as pd
import sys
import json
from datetime import datetime, timezone, timedelta
# Type py -3.14 model.py to run

MODEL_RESULT_PREFIX = '__MODEL_RESULT__'


def emit_model_result(payload):
    print(f"{MODEL_RESULT_PREFIX}{json.dumps(payload)}")


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


def derive_summary_day_utc(day_df):
    if day_df.empty or 'ts' not in day_df.columns:
        return None

    ts_series = pd.to_datetime(day_df['ts'], errors='coerce').dropna()
    if ts_series.empty:
        return None

    first_ts = ts_series.min()
    if getattr(first_ts, 'tzinfo', None) is None:
        first_ts = first_ts.tz_localize('UTC')
    else:
        first_ts = first_ts.tz_convert('UTC')

    day_start = first_ts.floor('D')
    return day_start.isoformat().replace('+00:00', 'Z')


def week_start_from_summary_day(summary_day_utc):
    if not summary_day_utc:
        return None

    parsed = datetime.fromisoformat(summary_day_utc.replace('Z', '+00:00'))
    days_since_sunday = (parsed.weekday() + 1) % 7
    week_start = (parsed - timedelta(days=days_since_sunday)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return week_start.isoformat().replace('+00:00', 'Z')


def summary_day_label(summary_day_utc):
    if not summary_day_utc:
        return 'Unknown day'

    try:
        parsed = datetime.fromisoformat(summary_day_utc.replace('Z', '+00:00'))
    except ValueError:
        return 'Unknown day'

    return parsed.strftime('%A')


def resolve_week_num(data_process, proc_df, requested_week=None):
    if requested_week is not None:
        requested_week_df = data_process.filter_by_week(proc_df, requested_week)
        if not requested_week_df.empty:
            return requested_week

    if requested_week is None:
        latest_week = data_process.latest_week_of(proc_df)
        if latest_week is not None:
            return latest_week

    inferred_week = data_process.infer_week_of(proc_df)
    return inferred_week if inferred_week is not None else requested_week


def build_day_summary_docs(db_name, week_df, day_chunks, summarizer, data_process):
    summary_docs = []

    for day_name, day_text in day_chunks.items():
        day_df = week_df[week_df['day_name'] == day_name]
        summary_day_utc = derive_summary_day_utc(day_df)
        week_start_utc = week_start_from_summary_day(summary_day_utc)
        users = int(day_df['user'].nunique()) if 'user' in day_df.columns else 0
        message_count = int(len(day_df))

        prompt_text = f'--- {day_name} ---\n{day_text}'
        day_summary = summarizer.gemini_summarize(prompt_text)

        summary_docs.append(
            {
                'channel_db': db_name,
                'summary_day_utc': summary_day_utc,
                'week_start_utc': week_start_utc,
                'summary_text': day_summary,
                'message_count': message_count,
                'distinct_users': users,
                'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            }
        )

    return summary_docs


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
#print(mem_df)
#print("Columns:", chan_df.columns.tolist())  
#print("Shape:", chan_df.shape)               
#print(chan_df.head())   

required_cols = {'text', 'ts'}
missing_cols = required_cols - set(chan_df.columns)
if missing_cols:
    print(f"Missing required columns from extracted data: {sorted(missing_cols)}")
    sys.exit(1)

# Preprocessing Data
dp_inst = DataProcess()
proc_df = dp_inst.normal_preprocess(chan_df)

cproc_df = None
resolved_week_num = None

if week_start_arg is not None:
    cproc_df = dp_inst.filter_by_week_start(proc_df, week_start_arg)
    if cproc_df.empty:
        print(f'No content found for channel "{dbName}" in requested weekStart {week_start_arg}.')
        emit_model_result(
            {
                'saved_count': 0,
                'summary_count': 0,
                'week_start_utc': week_start_arg,
                'database': dbName,
                'status': 'no-content',
            }
        )
        sys.exit(0)
else:
    resolved_week_num = resolve_week_num(dp_inst, proc_df, week_num)
    if resolved_week_num is None:
        print('Unable to determine a week number from the available messages.')
        sys.exit(1)

    if week_num is not None and resolved_week_num != week_num:
        print(f'No messages found for requested week {week_num}; using inferred week {resolved_week_num} instead.')

    cproc_df = dp_inst.filter_by_week(proc_df, resolved_week_num)
#text = ' '.join(proc_df['text'].dropna().astype(str).tolist())

# Summarizer initalizer
sum_inst = Summarizer()



#--------------DAY SUMMARIES----------------
day_chunks = dp_inst.chunk_text_by_day(cproc_df)

if not day_chunks:
    if week_start_arg is not None:
        print(f'No content found for channel "{dbName}" in requested weekStart {week_start_arg}.')
        emit_model_result(
            {
                'saved_count': 0,
                'summary_count': 0,
                'week_start_utc': week_start_arg,
                'database': dbName,
                'status': 'no-content',
            }
        )
    else:
        print(f'No content found for channel "{dbName}" in week {resolved_week_num}.')
        emit_model_result(
            {
                'saved_count': 0,
                'summary_count': 0,
                'requested_week': resolved_week_num,
                'database': dbName,
                'status': 'no-content',
            }
        )
    sys.exit(0)

summary_docs = build_day_summary_docs(dbName, cproc_df, day_chunks, sum_inst, dp_inst)

for doc in summary_docs:
    print(f"\n--- {summary_day_label(doc.get('summary_day_utc'))} ({doc.get('summary_day_utc')}) ---")
    print(doc['summary_text'])

# Daily summaries are saved into the selected channel database under the `summaries` collection.
saved_count = inst.upsert_day_summaries(dbName, summary_docs)
print(f"\nSaved {saved_count} day summaries to '{dbName}.summaries'.")
emit_model_result(
    {
        'saved_count': saved_count,
        'summary_count': len(summary_docs),
        'week_start_utc': summary_docs[0].get('week_start_utc') if summary_docs else week_start_arg,
        'requested_week': resolved_week_num,
        'database': dbName,
        'status': 'ok',
    }
)



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