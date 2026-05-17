TAG_RULES = [

    {
        "tag": "Authentication Failure",
        "category": "Identity",
        "severity": "medium",
        "mitre": ["T1110"],
        "patterns": [
            "fail",
            "failed",
            "invalid",
            "authentication",
            "login",
            "password",
            "denied",
            "unauthorized",
        ],
    },

    {
        "tag": "SQL Injection",
        "category": "Web Attack",
        "severity": "high",
        "mitre": ["T1190"],
        "patterns": [
            "union select",
            "or 1=1",
            "drop table",
            "select * from",
            "sql",
            "injection",
        ],
    },

    {
        "tag": "Suspicious PowerShell",
        "category": "Endpoint",
        "severity": "critical",
        "mitre": ["T1059.001"],
        "patterns": [
            "powershell",
            "-enc",
            "invoke",
            "mimikatz",
            "iex",
        ],
    },

    {
        "tag": "VPN Activity",
        "category": "Network",
        "severity": "low",
        "mitre": ["T1133"],
        "patterns": [
            "vpn",
            "remote access",
            "tunnel",
        ],
    },

    {
        "tag": "Data Exfiltration",
        "category": "Exfiltration",
        "severity": "critical",
        "mitre": ["T1041"],
        "patterns": [
            "upload",
            "download",
            "transfer",
            "outbound",
            "external",
        ],
    },

]