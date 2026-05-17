import re

from tag_rules import TAG_RULES


def categorize_log(message: str):

    matched_tags = []

    lowered = message.lower()

    for rule in TAG_RULES:

        for pattern in rule["patterns"]:

            if re.search(
                pattern,
                lowered
            ):

                matched_tags.append({

                    "tag": rule["tag"],

                    "category": rule["category"],

                    "severity": rule["severity"],

                    "mitre": rule["mitre"],

                })

                break

    return matched_tags