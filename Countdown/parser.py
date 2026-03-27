# =============================================================================
# parser.py — Excel Schedule Parser
# =============================================================================
# This file is responsible for:
#   1. Reading the uploaded Excel (.xlsx) file
#   2. Validating that it has the required columns
#   3. Cleaning and normalizing each row of data
#   4. Returning clean, structured data (or helpful error messages)
#
# Think of this as the "gatekeeper" — it checks the data before it reaches
# the calculation engine.
# =============================================================================

import pandas as pd
from datetime import datetime

# --- Column definitions ---

# These column names MUST exist in the Excel file (case-insensitive)
REQUIRED_COLUMNS = ["professor_name", "course_name", "day_of_week", "start_time", "end_time"]

# These are optional — missing values are just stored as empty strings
OPTIONAL_COLUMNS = ["location", "notes"]

# Valid weekday names (we normalize capitalization, so "monday" → "Monday")
VALID_DAYS = {
    "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday", "sunday"
}


# =============================================================================
# Main entry point
# =============================================================================

def parse_schedule(filepath):
    """
    Read and validate an Excel schedule file.

    Args:
        filepath (str): Path to the uploaded .xlsx file.

    Returns:
        dict with:
          - rows (list):        List of clean row dicts, one per class slot
          - professors (list):  Sorted list of unique professor name strings
          - warnings (list):    Non-fatal warning messages (e.g. skipped rows)
          - error (str|None):   Fatal error message, or None if parsing succeeded
    """
    result = {
        "rows":       [],
        "professors": [],
        "warnings":   [],
        "error":      None
    }

    # --- Step 1: Load the file ---
    try:
        df = pd.read_excel(filepath, engine="openpyxl")
    except Exception as e:
        result["error"] = f"Could not open the Excel file: {e}"
        return result

    if df.empty:
        result["error"] = "The Excel file is empty."
        return result

    # --- Step 2: Normalize column names ---
    # Convert "Professor Name", "PROFESSOR_NAME", etc. → "professor_name"
    df.columns = [
        str(c).strip().lower().replace(" ", "_")
        for c in df.columns
    ]

    # --- Step 3: Check required columns ---
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        result["error"] = (
            f"Missing required column(s): {', '.join(missing_cols)}.\n"
            f"Your file must include: {', '.join(REQUIRED_COLUMNS)}"
        )
        return result

    # --- Step 4: Parse each row ---
    rows = []
    seen = set()  # used to detect and skip duplicate rows

    for idx, row in df.iterrows():
        row_num = idx + 2  # Excel row number (1-indexed, +1 for header row)

        # Extract all values as strings, strip whitespace
        prof    = _str(row.get("professor_name"))
        course  = _str(row.get("course_name"))
        day_raw = _str(row.get("day_of_week"))
        start   = _clean_time(row.get("start_time"))
        end     = _clean_time(row.get("end_time"))
        location = _str(row.get("location")) if "location" in df.columns else ""
        notes    = _str(row.get("notes"))    if "notes"    in df.columns else ""

        # Skip completely blank rows silently
        if not prof and not course:
            continue

        # Validate required fields — warn and skip bad rows
        if not prof:
            result["warnings"].append(f"Row {row_num}: Missing professor_name — row skipped.")
            continue
        if not course:
            result["warnings"].append(f"Row {row_num}: Missing course_name — row skipped.")
            continue

        # Normalize day of week: "MONDAY" → "Monday", "mon" → skip
        day = day_raw.strip().capitalize()
        if day.lower() not in VALID_DAYS:
            result["warnings"].append(
                f"Row {row_num}: '{day_raw}' is not a valid day of week — row skipped. "
                f"Use: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday"
            )
            continue

        if not start:
            result["warnings"].append(f"Row {row_num}: Could not read start_time — row skipped.")
            continue
        if not end:
            result["warnings"].append(f"Row {row_num}: Could not read end_time — row skipped.")
            continue

        # Deduplicate: same professor + course + day + start time = duplicate
        dedup_key = (prof.lower(), course.lower(), day.lower(), start)
        if dedup_key in seen:
            result["warnings"].append(
                f"Row {row_num}: Duplicate entry for {prof} / {course} on {day} at {start} — skipped."
            )
            continue
        seen.add(dedup_key)

        # Store the clean row
        rows.append({
            "professor_name": prof,
            "course_name":    course,
            "day_of_week":    day,
            "start_time":     start,
            "end_time":       end,
            "location":       location,
            "notes":          notes
        })

    # --- Step 5: Final check ---
    if not rows:
        result["error"] = (
            "No valid schedule rows were found. "
            "Please check that your file uses the correct column names and has at least one data row."
        )
        return result

    result["rows"]       = rows
    result["professors"] = sorted(set(r["professor_name"] for r in rows))
    return result


# =============================================================================
# Internal helpers
# =============================================================================

def _str(value):
    """
    Convert any value to a clean string.
    Returns empty string for None, NaN, "nan", "None", etc.
    """
    if value is None:
        return ""
    s = str(value).strip()
    if s.lower() in ("nan", "none", "nat", ""):
        return ""
    return s


def _clean_time(value):
    """
    Normalize a time value to "HH:MM" string format.

    Handles the many ways Excel can store times:
      - String: "9:00", "09:00", "9:00 AM", "14:30:00"
      - Python time/datetime object (from pandas parsing)
      - Float fraction of a day (Excel's internal time format, e.g. 0.375 = 09:00)

    Returns None if the value cannot be recognized as a time.
    """
    if value is None:
        return None

    # pandas/Python time or datetime objects already have .hour and .minute
    if hasattr(value, "hour"):
        return f"{value.hour:02d}:{value.minute:02d}"

    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "nat"):
        return None

    # Try common string formats
    for fmt in ("%H:%M", "%I:%M %p", "%H:%M:%S", "%I:%M:%S %p"):
        try:
            t = datetime.strptime(s, fmt)
            return f"{t.hour:02d}:{t.minute:02d}"
        except ValueError:
            continue

    # Try Excel numeric time format (float fraction of 24 hours)
    # e.g. 0.375 → 9:00,  0.625 → 15:00
    try:
        frac = float(s)
        if 0.0 <= frac < 1.0:
            total_minutes = round(frac * 24 * 60)
            hours   = total_minutes // 60
            minutes = total_minutes % 60
            return f"{hours:02d}:{minutes:02d}"
    except (ValueError, TypeError):
        pass

    return None
