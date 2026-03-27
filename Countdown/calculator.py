# =============================================================================
# calculator.py — Semester Countdown Engine
# =============================================================================
# This file contains all the logic for calculating:
#   - Total class sessions in the semester
#   - Completed class sessions (dates in the past)
#   - Remaining class sessions (today and future)
#   - Remaining on-campus days (unique dates with at least one class)
#   - Calendar days until semester end
#   - Per-course session breakdown
#   - Weekly schedule summary
#
# The core idea:
#   1. Walk every calendar date from semester start → end
#   2. On each date, check if the professor has a class (based on weekday)
#   3. Skip holidays
#   4. Count up occurrences before vs. on/after today
# =============================================================================

import math
from datetime import date, timedelta, datetime

# Map day-of-week names to Python's date.weekday() integers
# (Monday = 0, Sunday = 6)
WEEKDAY_MAP = {
    "Monday":    0,
    "Tuesday":   1,
    "Wednesday": 2,
    "Thursday":  3,
    "Friday":    4,
    "Saturday":  5,
    "Sunday":    6,
}

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# =============================================================================
# Business Rule Constants — edit these to change app behavior
# =============================================================================

# Exam weeks: semester week number → label shown on dashboard
# Edit the week numbers here if your exam weeks change
EXAM_WEEKS = {8: "Midterm Exam Week", 16: "Finals Exam Week"}

# Which weeks cancel SEZ Free-Talking classes
SEZ_CANCEL_WEEKS = {8, 16}

# Substring to match SEZ Free-Talking course names (case-insensitive)
# Change this if the course name in your Excel file is slightly different
SEZ_COURSE_PATTERN = "sez free-talking"

# Semester-specific holidays (merged with any holidays entered in Settings)
# Add or remove dates here — format must be "YYYY-MM-DD"
SEMESTER_HOLIDAYS = [
    "2026-05-05",   # Children's Day
    "2026-05-25",   # Buddha's Birthday
    "2026-06-03",   # Election Day
]

# Energy score: time-of-day thresholds (24-hour format)
MORNING_END_HOUR   = 12    # classes starting before 12:00 = morning  (load × 1.2)
EVENING_START_HOUR = 17    # classes starting at/after 17:00 = evening (load × 1.4)
MAX_ENERGY_RAW     = 14.0  # raw score ceiling used to normalize to 0–10 scale

# Donut chart geometry (SVG units)
_DONUT_RADIUS        = 45
_DONUT_CIRCUMFERENCE = round(2 * math.pi * _DONUT_RADIUS, 2)  # ≈ 282.74


# =============================================================================
# Main entry point
# =============================================================================

def calculate_stats(schedule_rows, semester_start, semester_end, holidays, today):
    """
    Calculate all countdown statistics for one professor.

    Args:
        schedule_rows (list): Row dicts from parser.py for a single professor.
        semester_start (str): "YYYY-MM-DD" — first day of semester.
        semester_end   (str): "YYYY-MM-DD" — last day of semester.
        holidays       (list): List of "YYYY-MM-DD" strings for no-class dates.
        today          (str): "YYYY-MM-DD" — today's date (passed in for testability).

    Returns:
        dict with all calculated stats, or an error dict if inputs are invalid.
    """

    # --- Parse all date strings ---
    start      = _parse_date(semester_start)
    end        = _parse_date(semester_end)
    today_date = _parse_date(today)

    if start is None or end is None:
        return _empty_stats("Invalid semester dates. Please check your settings.")
    if today_date is None:
        return _empty_stats("Could not determine today's date.")
    if end < start:
        return _empty_stats("Semester end date is before the start date. Please fix your settings.")

    # Build a set of holiday dates for fast O(1) lookups
    holiday_set = set()
    for h in holidays:
        d = _parse_date(h)
        if d:
            holiday_set.add(d)

    # --- Generate every class occurrence in the semester ---
    # An "occurrence" = one class session on one specific date
    all_occurrences = _generate_occurrences(schedule_rows, start, end, holiday_set)

    # --- Split into completed (past) vs remaining (today + future) ---
    # We count today's classes as "remaining" — they haven't happened yet today
    completed = [o for o in all_occurrences if o["date"] <  today_date]
    remaining = [o for o in all_occurrences if o["date"] >= today_date]

    # --- On-campus days = count of unique dates in the remaining list ---
    # If a professor has 3 classes on Monday, that's still just 1 campus day
    remaining_campus_dates = sorted(set(o["date"] for o in remaining))

    # --- Calendar days until semester end ---
    # min of 0 so we never show negative numbers
    calendar_days_remaining = max(0, (end - today_date).days)

    # --- Per-course session counts (remaining only) ---
    course_counts = {}
    for o in remaining:
        key = o["course"]
        course_counts[key] = course_counts.get(key, 0) + 1

    # --- Weekly recurring schedule summary ---
    weekly_schedule = _build_weekly_schedule(schedule_rows)

    # --- Determine semester status ---
    if today_date < start:
        status       = "not_started"
        status_label = "Semester hasn't started yet"
    elif today_date > end:
        status       = "ended"
        status_label = "Semester has ended"
    else:
        status       = "ongoing"
        status_label = "Semester in progress"

    # --- Find the next upcoming class (by date + start time) ---
    # Sort remaining by (date, start_time) so we find the truly next class
    now = datetime.now()
    today_time_str = now.strftime("%H:%M")
    remaining_sorted = sorted(remaining, key=lambda o: (o["date"], o["start_time"]))

    next_class_info = None
    for occ in remaining_sorted:
        # Accept if: it's a future date, OR it's today and class hasn't started yet
        if occ["date"] > today_date or (occ["date"] == today_date and occ["start_time"] > today_time_str):
            # Calculate how long until this class starts
            class_dt = datetime.combine(occ["date"], datetime.strptime(occ["start_time"], "%H:%M").time())
            delta = class_dt - now
            total_secs = int(delta.total_seconds())

            if total_secs <= 60:
                time_remaining = "Starting now"
            elif delta.days == 0:
                hours, rem = divmod(total_secs, 3600)
                minutes = rem // 60
                if hours > 0:
                    time_remaining = f"In {hours}h {minutes}m"
                else:
                    time_remaining = f"In {minutes} min"
            elif delta.days == 1:
                time_remaining = f"Tomorrow at {occ['start_time']}"
            else:
                time_remaining = f"In {delta.days} days"

            d = occ["date"]
            next_class_info = {
                "date_iso":       str(d),
                "date_nice":      f"{d.strftime('%A, %B')} {d.day}",
                "course":         occ["course"],
                "start_time":     occ["start_time"],
                "end_time":       occ["end_time"],
                "location":       occ["location"],
                "time_remaining": time_remaining,
            }
            break

    # Exam week label (e.g. "Midterm Exam Week") shown on dashboard during exam weeks
    week_num_today   = ((today_date - start).days // 7) + 1 if (start <= today_date <= end) else None
    exam_week_label  = EXAM_WEEKS.get(week_num_today) if week_num_today else None

    return {
        "status":                  status,
        "status_label":            status_label,
        "total_sessions":          len(all_occurrences),
        "completed_sessions":      len(completed),
        "remaining_sessions":      len(remaining),
        "remaining_campus_days":   len(remaining_campus_dates),
        "calendar_days_remaining": calendar_days_remaining,
        "next_class":              next_class_info,
        "weekly_schedule":         weekly_schedule,
        "course_counts":           course_counts,
        "holidays_in_semester":    len([h for h in holiday_set if start <= h <= end]),
        "semester_start":          str(start),
        "semester_end":            str(end),
        "today":                   str(today_date),
        "exam_week_label":         exam_week_label,
        "error":                   None
    }


# =============================================================================
# Internal helpers
# =============================================================================

def _is_sez_cancel(course_name, week_num):
    """
    Return True if this class should be cancelled for this week.
    SEZ Free-Talking classes are cancelled during exam weeks (Week 8 and Week 16).
    Edit SEZ_CANCEL_WEEKS and SEZ_COURSE_PATTERN at the top of this file to change the rule.
    """
    return week_num in SEZ_CANCEL_WEEKS and SEZ_COURSE_PATTERN in course_name.lower()


def _generate_occurrences(schedule_rows, start, end, holiday_set):
    """
    Walk every calendar date from `start` to `end` (inclusive).
    For each date:
      - Skip if it's in holiday_set
      - Skip SEZ Free-Talking classes during exam cancel weeks
      - Check if any of the professor's classes fall on that weekday
      - If yes, record an occurrence for each matching class

    Returns a list of occurrence dicts.
    """

    # Pre-group schedule rows by weekday number for fast lookup
    # e.g. { 0: [row_monday_class1, row_monday_class2], 2: [row_wednesday_class1] }
    by_weekday = {}
    for row in schedule_rows:
        wday = WEEKDAY_MAP.get(row["day_of_week"])
        if wday is None:
            continue  # invalid day already filtered by parser
        by_weekday.setdefault(wday, []).append(row)

    occurrences = []
    current = start

    while current <= end:
        if current not in holiday_set:
            wday = current.weekday()  # 0 = Monday, 6 = Sunday
            # Which semester week does this date fall in?
            week_num = (current - start).days // 7 + 1
            if wday in by_weekday:
                for row in by_weekday[wday]:
                    # Skip SEZ Free-Talking classes during exam cancel weeks
                    if _is_sez_cancel(row["course_name"], week_num):
                        continue
                    occurrences.append({
                        "date":        current,
                        "course":      row["course_name"],
                        "day_of_week": row["day_of_week"],
                        "start_time":  row["start_time"],
                        "end_time":    row["end_time"],
                        "location":    row["location"],
                    })
        current += timedelta(days=1)

    return occurrences


def _build_weekly_schedule(schedule_rows):
    """
    Build a clean, sorted summary of the professor's recurring weekly schedule.
    Deduplicates entries and sorts by day-of-week order, then start time.

    Returns a list of dicts.
    """
    seen = {}
    for row in schedule_rows:
        key = (row["day_of_week"], row["course_name"], row["start_time"])
        if key not in seen:
            seen[key] = {
                "day_of_week":  row["day_of_week"],
                "course_name":  row["course_name"],
                "start_time":   row["start_time"],
                "end_time":     row["end_time"],
                "location":     row["location"],
            }

    return sorted(
        seen.values(),
        key=lambda x: (DAY_ORDER.index(x["day_of_week"]), x["start_time"])
    )


def _parse_date(date_str):
    """
    Parse a "YYYY-MM-DD" string into a Python date object.
    Returns None if the input is invalid or empty.
    """
    if not date_str:
        return None
    try:
        return date.fromisoformat(str(date_str).strip())
    except ValueError:
        return None


def _empty_stats(error_message):
    """
    Return a zeroed-out stats dict with an error message.
    Used when inputs are invalid so the template always has the same structure.
    """
    return {
        "status":                  "error",
        "status_label":            error_message,
        "total_sessions":          0,
        "completed_sessions":      0,
        "remaining_sessions":      0,
        "remaining_campus_days":   0,
        "calendar_days_remaining": 0,
        "next_class":              None,
        "weekly_schedule":         [],
        "course_counts":           {},
        "holidays_in_semester":    0,
        "semester_start":          None,
        "semester_end":            None,
        "today":                   None,
        "error":                   error_message,
    }


# =============================================================================
# Dashboard insights calculator
# =============================================================================

def calculate_insights(schedule_rows, semester_start_str, today_str, now_time_str):
    """
    Calculate supplementary dashboard metrics for one professor.

    Args:
        schedule_rows (list): The professor's recurring schedule rows from parser.py.
        semester_start_str (str): "YYYY-MM-DD" — semester start date.
        today_str (str): "YYYY-MM-DD" — today's date.
        now_time_str (str): "HH:MM" — current time (for completed-this-week logic).

    Returns a dict with:
        weekly_workload  — hours total / completed / remaining this week
        heavy_days       — days with 3+ classes or 4+ teaching hours
        energy_score     — 0–10 load score based on time-of-day and back-to-back classes
        course_load      — distinct course count and section count
        week_num         — current semester week number (0 if before semester)
    """
    semester_start = _parse_date(semester_start_str)
    today_date     = _parse_date(today_str)

    # Compute current semester week number
    if semester_start and today_date and today_date >= semester_start:
        week_num = (today_date - semester_start).days // 7 + 1
    else:
        week_num = 0

    # ── Deduplicate recurring slots ───────────────────────────────────────────
    # Each unique (day, course, start_time) = one weekly class slot.
    # This avoids double-counting if the parser produced duplicates.
    seen_keys = set()
    slots = []
    for row in schedule_rows:
        key = (row["day_of_week"], row["course_name"], row["start_time"])
        if key not in seen_keys:
            seen_keys.add(key)
            slots.append(row)

    # During exam weeks, exclude cancelled SEZ Free-Talking from workload
    if week_num in SEZ_CANCEL_WEEKS:
        slots = [s for s in slots if SEZ_COURSE_PATTERN not in s["course_name"].lower()]

    # ── Helper: duration of one slot in minutes ───────────────────────────────
    def slot_min(row):
        return max(0, _time_to_minutes(row["end_time"]) - _time_to_minutes(row["start_time"]))

    # ── Weekly Workload ────────────────────────────────────────────────────────
    total_minutes = sum(slot_min(s) for s in slots)

    completed_minutes = sum(
        slot_min(s) for s in slots
        if _is_completed_this_week(
            s["day_of_week"], s["end_time"], today_str, now_time_str, semester_start_str
        )
    )
    remaining_minutes = total_minutes - completed_minutes

    # SVG donut chart arc lengths (stroke-dasharray values)
    if total_minutes > 0:
        completed_arc = round((completed_minutes / total_minutes) * _DONUT_CIRCUMFERENCE, 2)
    else:
        completed_arc = 0.0
    remaining_arc = round(_DONUT_CIRCUMFERENCE - completed_arc, 2)

    weekly_workload = {
        "total_minutes":       total_minutes,
        "completed_minutes":   completed_minutes,
        "remaining_minutes":   remaining_minutes,
        "total_hours":         round(total_minutes     / 60, 1),
        "completed_hours":     round(completed_minutes / 60, 1),
        "remaining_hours":     round(remaining_minutes / 60, 1),
        "donut_total":         _DONUT_CIRCUMFERENCE,
        "donut_completed_arc": completed_arc,
        "donut_remaining_arc": remaining_arc,
    }

    # ── Heavy Days ─────────────────────────────────────────────────────────────
    # A day is "heavy" if it has 3+ classes OR 4+ hours of teaching.
    day_groups = {}
    for s in slots:
        day_groups.setdefault(s["day_of_week"], []).append(s)

    heavy_days = []
    for day, classes in day_groups.items():
        count = len(classes)
        hours = sum(slot_min(c) for c in classes) / 60
        if count >= 3 or hours >= 4.0:
            heavy_days.append({"day": day, "count": count, "hours": round(hours, 1)})

    # Sort heaviest (most hours) first
    heavy_days.sort(key=lambda x: x["hours"], reverse=True)

    # ── Energy Load Score ──────────────────────────────────────────────────────
    # Score each class by time-of-day:
    #   Morning   (start < 12:00)  → 1.2 load
    #   Afternoon (12:00–16:59)    → 1.0 load
    #   Evening   (start ≥ 17:00)  → 1.4 load
    # Back-to-back bonus: same day, gap ≤ 10 minutes between end and next start → +0.5
    # Final score is normalized to 0–10 using MAX_ENERGY_RAW as the ceiling.
    # Edit MORNING_END_HOUR, EVENING_START_HOUR, MAX_ENERGY_RAW at the top to tune this.
    sorted_slots = sorted(
        slots,
        key=lambda s: (
            DAY_ORDER.index(s["day_of_week"]) if s["day_of_week"] in DAY_ORDER else 99,
            s["start_time"]
        )
    )

    raw_score = 0.0
    for i, s in enumerate(sorted_slots):
        hour = int(s["start_time"].split(":")[0]) if s["start_time"] else 12
        if hour < MORNING_END_HOUR:
            raw_score += 1.2   # morning premium
        elif hour >= EVENING_START_HOUR:
            raw_score += 1.4   # evening premium
        else:
            raw_score += 1.0   # standard afternoon

        # Back-to-back bonus: same day, no meaningful break between classes
        if i > 0:
            prev = sorted_slots[i - 1]
            if prev["day_of_week"] == s["day_of_week"]:
                gap = _time_to_minutes(s["start_time"]) - _time_to_minutes(prev["end_time"])
                if 0 <= gap <= 10:
                    raw_score += 0.5

    energy_score = round(min(raw_score / MAX_ENERGY_RAW * 10, 10.0), 1)

    # ── Course Load ────────────────────────────────────────────────────────────
    # courses  = unique course names (different subjects)
    # sections = unique (course_name, location) pairs
    #            Different rooms = different student groups = different sections.
    #            If location is empty, each unique (course, day) is counted separately.
    unique_courses  = set(s["course_name"] for s in slots)
    unique_sections = set(
        (s["course_name"], s.get("location", "") or s["day_of_week"])
        for s in slots
    )

    course_load = {
        "courses":  len(unique_courses),
        "sections": len(unique_sections),
    }

    return {
        "weekly_workload": weekly_workload,
        "heavy_days":      heavy_days,
        "energy_score":    energy_score,
        "course_load":     course_load,
        "week_num":        week_num,
    }


# =============================================================================
# Semester week calculator
# =============================================================================

def calculate_semester_week(semester_start, semester_end, today):
    """
    Return which week of the semester we are currently in.

    Week 1 = the 7-day block starting on semester_start.
    Week 2 = days 8–14, etc.

    Returns a dict:
      week_num    (int|None)  — 1-based week number, or None if outside semester
      total_weeks (int)       — total weeks in the semester
      label       (str)       — human-readable string for display
    """
    start      = _parse_date(semester_start)
    end        = _parse_date(semester_end)
    today_date = _parse_date(today)

    if start is None or end is None or today_date is None:
        return {"week_num": None, "total_weeks": None, "label": "—"}

    total_weeks = ((end - start).days // 7) + 1

    if today_date < start:
        return {"week_num": 0, "total_weeks": total_weeks, "label": "Semester not yet started"}
    if today_date > end:
        return {"week_num": total_weeks, "total_weeks": total_weeks, "label": "Semester complete"}

    week_num = ((today_date - start).days // 7) + 1
    return {
        "week_num":    week_num,
        "total_weeks": total_weeks,
        "label":       f"Week {week_num} of {total_weeks}"
    }


# =============================================================================
# Visual timetable builder
# =============================================================================

# Column index for each weekday (column 1 = time axis, columns 2-6 = Mon-Fri)
_DAY_COL = {"Monday": 2, "Tuesday": 3, "Wednesday": 4, "Thursday": 5, "Friday": 6}

# Granularity: each grid row = SLOT_MIN minutes
_SLOT_MIN = 10


def _time_to_minutes(time_str):
    """Convert 'HH:MM' to total minutes since midnight. Returns 0 on error."""
    try:
        h, m = map(int, time_str.strip().split(":"))
        return h * 60 + m
    except (ValueError, AttributeError):
        return 0


def _is_completed_this_week(day_of_week, end_time_str, today_str, now_time_str, semester_start_str):
    """
    Return True if this recurring class has already ended during the CURRENT week.

    Weeks are anchored to the semester start weekday (not calendar Monday).
    For example, if the semester starts on Tuesday, weeks run Tue→Mon.

    Rules:
      - Find the actual calendar date of this class within the current semester week
      - If that date is BEFORE today → completed
      - If that date IS today and end_time <= now_time → completed
      - If that date is AFTER today → not yet completed
    """
    today_date = _parse_date(today_str)
    semester_start = _parse_date(semester_start_str)
    if today_date is None or semester_start is None:
        return False

    # How many days into the current semester week are we?
    days_since_start = (today_date - semester_start).days
    days_into_week = days_since_start % 7
    current_week_start = today_date - timedelta(days=days_into_week)

    # What calendar date does this class fall on within this semester week?
    class_weekday = WEEKDAY_MAP.get(day_of_week)
    semester_start_weekday = semester_start.weekday()
    if class_weekday is None:
        return False
    class_offset = (class_weekday - semester_start_weekday) % 7
    class_date_this_week = current_week_start + timedelta(days=class_offset)

    if class_date_this_week < today_date:
        return True
    elif class_date_this_week == today_date:
        return end_time_str <= now_time_str
    else:
        return False


def build_timetable_data(schedule_rows, today_str, now_time_str, semester_start_str=""):
    """
    Compute CSS-Grid positioning for the visual weekly timetable.

    Returns a dict the template uses to render the timetable, or None if
    there are no schedule rows.

    Grid layout:
      Column 1       = time-axis labels
      Columns 2–6    = Monday–Friday
      Row 1          = day-header row
      Rows 2–(N+1)   = time slots, each SLOT_MIN minutes wide

    All start/end row numbers are 1-indexed and ready to drop straight
    into  grid-row: start / end  CSS.
    """
    if not schedule_rows:
        return None

    # ---- Determine current semester week for cancellation logic ----
    today_date   = _parse_date(today_str)
    sem_start    = _parse_date(semester_start_str)
    if sem_start and today_date and today_date >= sem_start:
        current_week_num = (today_date - sem_start).days // 7 + 1
    else:
        current_week_num = 0

    # ---- Determine the time range from the actual data ----
    all_starts = [_time_to_minutes(r["start_time"]) for r in schedule_rows]
    all_ends   = [_time_to_minutes(r["end_time"])   for r in schedule_rows]

    # Round down to nearest 30 min for the top of the grid,
    # round up to nearest 30 min for the bottom.
    base_min = (min(all_starts) // 30) * 30
    top_min  = ((max(all_ends) + 29) // 30) * 30
    total_slots = (top_min - base_min) // _SLOT_MIN

    # ---- Identify today's weekday name for column highlighting ----
    today_date = _parse_date(today_str)
    today_day  = list(WEEKDAY_MAP.keys())[today_date.weekday()] if today_date else None

    # ---- Build time-axis labels (one per hour) ----
    time_labels = []
    for m in range(base_min, top_min + 1, 60):
        row = (m - base_min) // _SLOT_MIN + 2   # +2 because row 1 is the header
        h, mn = divmod(m, 60)
        time_labels.append({"label": f"{h}:{mn:02d}", "row": row})

    # ---- Build class blocks with grid positions ----
    # Deduplicate: same professor can have the same row twice if the parser
    # produced duplicate entries (shouldn't happen, but be safe).
    seen_keys = set()
    blocks = []

    for row in schedule_rows:
        key = (row["day_of_week"], row["start_time"], row["course_name"])
        if key in seen_keys:
            continue
        seen_keys.add(key)

        col = _DAY_COL.get(row["day_of_week"])
        if col is None:
            continue   # Saturday / Sunday — skip for now

        start_m = _time_to_minutes(row["start_time"])
        end_m   = _time_to_minutes(row["end_time"])

        row_start = (start_m - base_min) // _SLOT_MIN + 2
        row_end   = (end_m   - base_min) // _SLOT_MIN + 2

        completed  = _is_completed_this_week(
            row["day_of_week"], row["end_time"], today_str, now_time_str, semester_start_str
        )
        # Mark as cancelled (not just completed) if it's a SEZ class during an exam week
        cancelled  = _is_sez_cancel(row["course_name"], current_week_num)

        blocks.append({
            "course":     row["course_name"],
            "location":   row.get("location", ""),
            "start_time": row["start_time"],
            "end_time":   row["end_time"],
            "day":        row["day_of_week"],
            "col":        col,
            "row_start":  row_start,
            "row_end":    row_end,
            "completed":  completed,
            "cancelled":  cancelled,
        })

    return {
        "days":         ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "total_slots":  total_slots,
        "time_labels":  time_labels,
        "blocks":       blocks,
        "today_day":    today_day,
    }


# =============================================================================
# Department-level analytics
# =============================================================================

def _summarize_time_leader(prof_counts):
    """
    Find the professor(s) with the highest count in a {name: count} dict.

    Returns a dict with:
        names   — list of leader name strings (may be multiple if tied)
        count   — winning count
        tied    — True if multiple professors share the top count
        display — human-readable string, e.g. "Dr. Kim" or "Dr. Kim & Prof. Lee"
    Returns None if prof_counts is empty.
    """
    if not prof_counts:
        return None
    max_count = max(prof_counts.values())
    leaders   = sorted(p for p, c in prof_counts.items() if c == max_count)
    if len(leaders) <= 2:
        display = " & ".join(leaders)
    else:
        display = f"{leaders[0]} +{len(leaders) - 1} others"
    return {
        "names":   leaders,
        "count":   max_count,
        "tied":    len(leaders) > 1,
        "display": display,
    }


def calculate_department_stats(all_rows, professors, semester_start, semester_end, holidays, today):
    """
    Aggregate department-wide analytics across ALL professors.

    Reuses the same business rules as individual professor dashboards:
      - _generate_occurrences() automatically excludes holidays and cancels SEZ
        Free-Talking sessions in exam weeks (EXAM_WEEKS / SEZ_CANCEL_WEEKS constants).
      - MORNING_END_HOUR / EVENING_START_HOUR thresholds match the insight score logic.

    Args:
        all_rows (list):      All schedule rows from the cache (every professor).
        professors (list):    Sorted list of unique professor name strings.
        semester_start (str): "YYYY-MM-DD"
        semester_end   (str): "YYYY-MM-DD"
        holidays (list):      "YYYY-MM-DD" strings (already merged with SEMESTER_HOLIDAYS).
        today (str):          "YYYY-MM-DD" today's date.

    Returns:
        dict of aggregated stats, or {"error": msg, ...} on bad inputs.
    """
    start      = _parse_date(semester_start)
    end        = _parse_date(semester_end)
    today_date = _parse_date(today)

    if start is None or end is None:
        return {"error": "Invalid semester dates.", "horse_race": [], "course_directory": [],
                "college_english": {}, "sessions_by_day_chart": [], "time_dist_chart": [],
                "profs_per_day_chart": [], "most_9am": None, "most_4pm": None,
                "most_diverse": None, "total_sessions": 0, "remaining_sessions": 0,
                "completed_sessions": 0, "professor_count": 0, "busiest_day": None}
    if today_date is None:
        return {"error": "Could not determine today's date.", "horse_race": [],
                "course_directory": [], "college_english": {}, "sessions_by_day_chart": [],
                "time_dist_chart": [], "profs_per_day_chart": [], "most_9am": None,
                "most_4pm": None, "most_diverse": None, "total_sessions": 0,
                "remaining_sessions": 0, "completed_sessions": 0, "professor_count": 0,
                "busiest_day": None}

    # Build holiday set (same logic as calculate_stats)
    holiday_set = set()
    for h in holidays:
        d = _parse_date(h)
        if d:
            holiday_set.add(d)

    # ── Group rows by professor ────────────────────────────────────────────────
    rows_by_prof = {}
    for row in all_rows:
        rows_by_prof.setdefault(row["professor_name"], []).append(row)

    # ── Generate semester occurrences per professor ────────────────────────────
    # _generate_occurrences respects holidays and SEZ cancellations automatically.
    prof_occurrences = {}
    for prof in professors:
        prof_rows = rows_by_prof.get(prof, [])
        prof_occurrences[prof] = _generate_occurrences(prof_rows, start, end, holiday_set)

    # ── Tag all occurrences with professor name ────────────────────────────────
    all_occ = []
    for prof, occs in prof_occurrences.items():
        for occ in occs:
            tagged = dict(occ)
            tagged["professor"] = prof
            all_occ.append(tagged)

    # ── Per-professor stats (for horse race + totals) ─────────────────────────
    prof_stats_list = []
    for prof in professors:
        occs      = prof_occurrences[prof]
        total     = len(occs)
        completed = sum(1 for o in occs if o["date"] < today_date)
        remaining = total - completed
        pct       = round(completed / total * 100, 1) if total > 0 else 0.0
        prof_stats_list.append({
            "name":               prof,
            "total_sessions":     total,
            "completed_sessions": completed,
            "remaining_sessions": remaining,
            "progress_pct":       pct,
        })

    total_sessions     = sum(p["total_sessions"]     for p in prof_stats_list)
    completed_sessions = sum(p["completed_sessions"] for p in prof_stats_list)
    remaining_sessions = sum(p["remaining_sessions"] for p in prof_stats_list)

    # ── Sessions by day of week ────────────────────────────────────────────────
    _days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    sessions_by_day = {d: 0 for d in _days}
    for occ in all_occ:
        d = occ["day_of_week"]
        if d in sessions_by_day:
            sessions_by_day[d] += 1

    busiest_day   = max(sessions_by_day, key=sessions_by_day.get)
    max_day_count = max(sessions_by_day.values()) or 1

    # Pre-compute SVG bar chart geometry (viewBox "0 0 260 106")
    # 5 bars: width=36, gap=12, left-padding=16 → bar_x = 16 + i*48
    # Max bar height = 72px, top padding = 12px → bar_y = 12 + (72 - bar_height)
    sessions_by_day_chart = [
        {
            "day":        d,
            "short":      d[:3].upper(),
            "count":      sessions_by_day[d],
            "pct":        round(sessions_by_day[d] / max_day_count * 100),
            "bar_height": max(2, round(sessions_by_day[d] / max_day_count * 72)),
            "bar_y":      12 + (72 - max(2, round(sessions_by_day[d] / max_day_count * 72))),
            "bar_x":      16 + i * 48,
        }
        for i, d in enumerate(_days)
    ]

    # ── Time of day distribution ───────────────────────────────────────────────
    # Buckets by END time so a class that runs until 17:45 counts as "evening"
    # even though it started before 17:30.
    # Thresholds (in minutes since midnight):
    #   Morning   = end_time <= 720  (ends by 12:00)
    #   Evening   = end_time > 1050  (ends after 17:30)
    #   Afternoon = everything else
    _MORNING_END_MIN  = MORNING_END_HOUR * 60        # 720
    _EVENING_END_MIN  = EVENING_START_HOUR * 60 + 30  # 1050
    time_dist = {"morning": 0, "afternoon": 0, "evening": 0}
    for occ in all_occ:
        end_min = _time_to_minutes(occ["end_time"]) if occ.get("end_time") else _MORNING_END_MIN
        if end_min <= _MORNING_END_MIN:
            time_dist["morning"] += 1
        elif end_min > _EVENING_END_MIN:
            time_dist["evening"] += 1
        else:
            time_dist["afternoon"] += 1

    total_time    = sum(time_dist.values()) or 1
    time_dist_chart = [
        {"label": "Morning",   "key": "morning",   "icon": "🌅",
         "count": time_dist["morning"],   "pct": round(time_dist["morning"]   / total_time * 100)},
        {"label": "Afternoon", "key": "afternoon", "icon": "☀️",
         "count": time_dist["afternoon"], "pct": round(time_dist["afternoon"] / total_time * 100)},
        {"label": "Evening",   "key": "evening",   "icon": "🌙",
         "count": time_dist["evening"],   "pct": round(time_dist["evening"]   / total_time * 100)},
    ]

    # ── 9 AM and 4 PM champions ────────────────────────────────────────────────
    # Counts semester-wide occurrences (not just weekly slots) starting in that hour.
    prof_9am = {}
    prof_4pm = {}
    for occ in all_occ:
        st   = occ.get("start_time", "")
        prof = occ["professor"]
        if st.startswith("09:"):
            prof_9am[prof] = prof_9am.get(prof, 0) + 1
        if st.startswith("16:"):
            prof_4pm[prof] = prof_4pm.get(prof, 0) + 1

    # ── Professor with most distinct courses ──────────────────────────────────
    # "Diversity" = unique course names taught, regardless of number of sections.
    # A professor teaching 5 subjects scores higher than one teaching 10 sections
    # of the same subject.
    prof_diversity = {}
    for prof in professors:
        courses = sorted(set(r["course_name"] for r in rows_by_prof.get(prof, [])))
        prof_diversity[prof] = {"count": len(courses), "courses": courses}

    if prof_diversity:
        max_div   = max(v["count"] for v in prof_diversity.values())
        div_leads = sorted(p for p, v in prof_diversity.items() if v["count"] == max_div)
        most_diverse = {
            "names":   div_leads,
            "count":   max_div,
            "courses": prof_diversity[div_leads[0]]["courses"],
            "tied":    len(div_leads) > 1,
            "display": " & ".join(div_leads[:2]) + (" +more" if len(div_leads) > 2 else ""),
        }
    else:
        most_diverse = None

    # ── Professors per campus day (recurring weekly schedule) ─────────────────
    # Counts distinct professors who have at least one recurring class each weekday.
    # Uses all_rows (not occurrences) since this describes the weekly template.
    profs_per_day = {d: set() for d in _days}
    for row in all_rows:
        d = row["day_of_week"]
        if d in profs_per_day:
            profs_per_day[d].add(row["professor_name"])

    max_profs_day = max(len(s) for s in profs_per_day.values()) or 1
    profs_per_day_chart = [
        {
            "day":   d,
            "short": d[:3].upper(),
            "count": len(profs_per_day[d]),
            "pct":   round(len(profs_per_day[d]) / max_profs_day * 100),
        }
        for d in _days
    ]

    # ── Course directory ───────────────────────────────────────────────────────
    # Groups all recurring schedule rows by course name.
    #
    # Section counting assumption:
    #   section = unique (professor_name, location) per course.
    #   Different rooms = different student groups = different sections.
    #   If no location is recorded, fall back to (professor, day_of_week) as the
    #   distinguisher to avoid incorrectly merging different-day slots.
    course_dir = {}
    for row in all_rows:
        cname = row["course_name"]
        loc   = row.get("location", "").strip()
        prof  = row["professor_name"]
        if cname not in course_dir:
            course_dir[cname] = {"professors": set(), "sections": set(), "prof_sections": {}}
        course_dir[cname]["professors"].add(prof)
        sec_key = (prof, loc) if loc else (prof, row["day_of_week"])
        course_dir[cname]["sections"].add(sec_key)
        course_dir[cname]["prof_sections"].setdefault(prof, set()).add(sec_key)

    course_directory = sorted(
        [
            {
                "course_name":   k,
                "professors":    sorted(v["professors"]),
                "section_count": len(v["sections"]),
                "prof_sections": {p: len(s) for p, s in v["prof_sections"].items()},
            }
            for k, v in course_dir.items()
        ],
        key=lambda x: x["course_name"]
    )

    # ── College English level breakdown ───────────────────────────────────────
    # Identifies courses containing "(Low)", "(Int)", or "(Upper)" in the name.
    # Edit the `ce_levels` list below to track different level markers.
    ce_levels = ["Low", "Int", "Upper"]
    ce_raw    = {lv: {"professors": set(), "sections": set(), "prof_sections": {}} for lv in ce_levels}

    for row in all_rows:
        cname = row["course_name"]
        loc   = row.get("location", "").strip()
        prof  = row["professor_name"]
        for lv in ce_levels:
            if f"({lv})" in cname:
                ce_raw[lv]["professors"].add(prof)
                sec_key = (prof, loc) if loc else (prof, row["day_of_week"])
                ce_raw[lv]["sections"].add(sec_key)
                ce_raw[lv]["prof_sections"].setdefault(prof, set()).add(sec_key)

    college_english = {
        lv: {
            "professors":      sorted(ce_raw[lv]["professors"]),
            "professor_count": len(ce_raw[lv]["professors"]),
            "section_count":   len(ce_raw[lv]["sections"]),
            "prof_sections":   {p: len(s) for p, s in ce_raw[lv]["prof_sections"].items()},
        }
        for lv in ce_levels
    }

    # ── Horse race: sorted by progress, leader first ──────────────────────────
    horse_race = sorted(prof_stats_list, key=lambda x: x["progress_pct"], reverse=True)

    return {
        "total_sessions":        total_sessions,
        "completed_sessions":    completed_sessions,
        "remaining_sessions":    remaining_sessions,
        "professor_count":       len(professors),
        "sessions_by_day":       sessions_by_day,
        "sessions_by_day_chart": sessions_by_day_chart,
        "busiest_day":           busiest_day,
        "time_dist_chart":       time_dist_chart,
        "most_9am":              _summarize_time_leader(prof_9am),
        "most_4pm":              _summarize_time_leader(prof_4pm),
        "most_diverse":          most_diverse,
        "profs_per_day_chart":   profs_per_day_chart,
        "course_directory":      course_directory,
        "college_english":       college_english,
        "horse_race":            horse_race,
        "error":                 None,
    }
