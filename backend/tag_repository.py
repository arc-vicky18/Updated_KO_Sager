import json
import aiosqlite

DB_PATH = "knowbot.db"


# =========================================
# CREATE / UPDATE TAG
# =========================================

async def ensure_tag_exists(tag_data):

    async with aiosqlite.connect(DB_PATH) as db:

        await db.execute("""

        INSERT OR REPLACE INTO tags (

            id,
            name,
            category,
            severity,
            count,
            data

        )

        VALUES (?, ?, ?, ?, ?, ?)

        """,

        (

            tag_data["tag"],

            tag_data["tag"],

            tag_data.get(
                "category",
                "Security"
            ),

            tag_data.get(
                "severity",
                "medium"
            ),

            1,

            json.dumps(tag_data)

        )

        )

        await db.commit()


# =========================================
# GET TAGS
# =========================================

async def get_all_tags():

    async with aiosqlite.connect(DB_PATH) as db:

        cursor = await db.execute(

            """

            SELECT

                name,
                category,
                severity,
                count

            FROM tags

            ORDER BY count DESC

            """

        )

        rows = await cursor.fetchall()

        tags = []

        for row in rows:

            tags.append({

                "name": row[0],

                "category": row[1],

                "severity": row[2],

                "count": row[3],

            })

        return tags


# =========================================
# TAG RULES
# =========================================

async def get_all_tag_rules():

    return [

        {

            "tag": "Authentication Failure",

            "rule": [

                "failed password",
                "authentication failure",
                "login failed"

            ]

        },

        {

            "tag": "Brute Force",

            "rule": [

                "multiple failed",
                "brute force",
                "password spray"

            ]

        },

        {

            "tag": "Malware",

            "rule": [

                "malware",
                "trojan",
                "virus"

            ]

        }

    ]