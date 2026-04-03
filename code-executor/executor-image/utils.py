# write to file with its extension, catching error if langauge is not implemented.
# returns None if langauge is not implemented or the filename written to
import random
import string

from  models import *

class Languages:
    map = {
        "javascript": "js",
        # "python": ".py",
    }

    @classmethod
    def is_supported(cls, language: str) -> bool:
        return language in cls.map

def write_code_to_file(content: str, language: str, testCase: TestableCase = None):
    try:
        lang_ext = Languages.map[language]
    except KeyError:
        return None
    name = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    with open(f"/tmp/{name}.{lang_ext}", "w+") as f:
        f.write(content)
    # TODO: add langauge specific solution(PARAM) invocation here
    return f"/tmp/{name}.{lang_ext}"

def normalize_javascript_params(testCase: List[str]):
    print("hi")