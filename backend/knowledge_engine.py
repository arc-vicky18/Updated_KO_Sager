from datetime import datetime


def generate_dashboard(tag_name: str):

    spl = f"""
search index=* "{tag_name}"
| timechart count by host
"""

    return {

        "id":
            f"dashboard-{tag_name.lower()}",

        "name":
            f"{tag_name} Dashboard",

        "description":
            "AI-generated dashboard from ingested logs",

        "created_at":
            datetime.utcnow().isoformat(),

        "spl":
            spl,

        "panels": [

            {
                "title": "Timeline",
                "type": "line_chart",
            },

            {
                "title": "Host Distribution",
                "type": "bar_chart",
            },

            {
                "title": "Severity Distribution",
                "type": "pie_chart",
            },

        ]

    }


def generate_alert(tag_name: str):

    spl = f"""
search index=* "{tag_name}"
| stats count by host
| where count > 5
"""

    return {

        "id":
            f"alert-{tag_name.lower()}",

        "name":
            f"{tag_name} Alert",

        "description":
            "AI-generated alert rule",

        "severity":
            "high",

        "created_at":
            datetime.utcnow().isoformat(),

        "trigger":
            "count > 5",

        "spl":
            spl,

    }


def generate_lookup(tag_name: str):

    return {

        "id":
            f"lookup-{tag_name.lower()}",

        "name":
            f"{tag_name}_lookup",

        "description":
            "AI-generated IOC lookup",

        "created_at":
            datetime.utcnow().isoformat(),

        "fields": [

            "ip",
            "host",
            "user",
            "severity",
            "timestamp",

        ],

    }