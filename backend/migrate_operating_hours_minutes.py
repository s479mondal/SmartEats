import re
from pymongo import MongoClient
import dns.resolver

# Configure DNS resolver
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

def parse_time_to_minutes(time_str):
    if not time_str or not isinstance(time_str, str):
        return None
    cleaned = time_str.strip()
    if not cleaned:
        return None
    
    # Check HH:mm
    m_24 = re.match(r'^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$', cleaned)
    if m_24:
        return int(m_24.group(1)) * 60 + int(m_24.group(2))
    
    # Check 12-hour AM/PM: e.g. "10:00 AM", "2:00 PM", "10:00PM", "2 AM"
    m_12 = re.match(r'^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$', cleaned, re.IGNORECASE)
    if m_12:
        hours = int(m_12.group(1))
        minutes = int(m_12.group(2)) if m_12.group(2) is not None else 0
        ampm = m_12.group(3).upper()
        if hours < 1 or hours > 12:
            return None
        if ampm == 'PM' and hours < 12:
            hours += 12
        elif ampm == 'AM' and hours == 12:
            hours = 0
        return hours * 60 + minutes
    
    return None

def migrate():
    uri = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
    client = MongoClient(uri)
    db = client["smarteats_restaurant"]
    collection = db["restaurants"]

    restaurants = list(collection.find({}))
    print(f"Total restaurants in collection: {len(restaurants)}")

    migrated_count = 0
    already_valid_count = 0
    skipped_null_count = 0

    for r in restaurants:
        doc_id = r["_id"]
        name = r.get("name", "Unnamed")
        current_open_min = r.get("openingTimeMinutes")
        current_close_min = r.get("closingTimeMinutes")
        open_str = r.get("openingTime")
        close_str = r.get("closingTime")

        # Check if already migrated
        if current_open_min is not None and current_close_min is not None:
            print(f"[UNCHANGED] {name} ({doc_id}): already has minutes ({current_open_min} - {current_close_min})")
            already_valid_count += 1
            continue

        calc_open_min = parse_time_to_minutes(open_str)
        calc_close_min = parse_time_to_minutes(close_str)

        update_fields = {}
        if calc_open_min is not None:
            update_fields["openingTimeMinutes"] = calc_open_min
        if calc_close_min is not None:
            update_fields["closingTimeMinutes"] = calc_close_min

        if update_fields:
            collection.update_one({"_id": doc_id}, {"$set": update_fields})
            print(f"[MIGRATED] {name} ({doc_id}): open='{open_str}' -> {calc_open_min}, close='{close_str}' -> {calc_close_min}")
            migrated_count += 1
        else:
            print(f"[SKIPPED NULL] {name} ({doc_id}): open='{open_str}', close='{close_str}' (No valid time strings to migrate)")
            skipped_null_count += 1

    print("\n--- MIGRATION SUMMARY ---")
    print(f"Total processed: {len(restaurants)}")
    print(f"Migrated: {migrated_count}")
    print(f"Already had minutes: {already_valid_count}")
    print(f"Skipped (null/missing times): {skipped_null_count}")

if __name__ == "__main__":
    migrate()
