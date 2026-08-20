import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "telemetry.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            engine_used TEXT,
            craters_found INTEGER,
            rocks_found INTEGER,
            top_safe_zone_id TEXT,
            raw_stats TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_assessment(engine: str, stats: dict, safe_zones: list):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        craters = stats.get('craters_detected', 0) if isinstance(stats.get('craters_detected'), int) else 0
        rocks = stats.get('rocks_detected', 0) if isinstance(stats.get('rocks_detected'), int) else 0
        top_zone = safe_zones[0]['id'] if len(safe_zones) > 0 else "NO_SAFE_ZONE"
        
        c.execute('''
            INSERT INTO audit_logs 
            (timestamp, engine_used, craters_found, rocks_found, top_safe_zone_id, raw_stats)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            engine,
            craters,
            rocks,
            top_zone,
            json.dumps(stats)
        ))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to log telemetry: {e}")

def get_audit_history(limit: int = 10) -> list[dict]:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?', (limit,))
        rows = c.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Failed to fetch telemetry history: {e}")
        return []
