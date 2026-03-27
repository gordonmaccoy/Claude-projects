# =============================================================================
# app.py — Sejong University Professor Schedule Dashboard
# =============================================================================

import os
import re
import json
from datetime import date, datetime

from flask import (
    Flask, render_template, request, redirect,
    url_for, session, flash, send_file
)
from werkzeug.utils import secure_filename

import parser as schedule_parser
import calculator

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "sejong-professor-dashboard-secret-key")

# DATA_DIR: set to a Railway persistent volume path in production (e.g. /data).
# Falls back to the local app directory so local dev requires no changes.
_APP_DIR  = os.path.dirname(__file__)
_DATA_DIR = os.environ.get("DATA_DIR", _APP_DIR)

UPLOAD_FOLDER    = os.path.join(_DATA_DIR, "uploads")
CONFIG_FILE      = os.path.join(_DATA_DIR, "config.json")
SCHEDULE_CACHE   = os.path.join(_DATA_DIR, "uploads", "schedule_cache.json")
PHOTOS_FOLDER    = os.path.join(_APP_DIR, "static", "images", "professors")
ALLOWED_EXTENSIONS = {"xlsx", "xls"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PHOTOS_FOLDER, exist_ok=True)


# =============================================================================
# Helpers
# =============================================================================

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def load_config():
    """Load settings from config.json, with safe defaults."""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            cfg = json.load(f)
        # Ensure new fields exist in older config files
        cfg.setdefault("last_schedule_file", "")
        return cfg
    return {
        "semester_start":     "2026-03-02",
        "semester_end":       "2026-06-20",
        "holidays":           [],
        "last_schedule_file": ""
    }


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_professor_photo(name):
    """
    Look for a photo for this professor in static/images/professors/.

    Naming rule: "Dr. Kim" → looks for dr_kim.jpg / dr_kim.png / etc.
    Returns a static URL string if found, or None.
    """
    safe_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    for ext in ('jpg', 'jpeg', 'png', 'webp'):
        filename = f"{safe_name}.{ext}"
        if os.path.exists(os.path.join(PHOTOS_FOLDER, filename)):
            return url_for('static', filename=f'images/professors/{filename}')
    return None


def load_schedule_cache():
    """
    Load the parsed schedule from the on-disk cache file.
    Returns a dict with keys: rows, professors, filename — or empty values if not found.

    WHY a file instead of the Flask session?
    Flask sessions are stored in a browser cookie, which has a hard 4KB size limit.
    A schedule with 12+ professors easily exceeds this, causing the session to silently
    fail and the app to show stale data. A local JSON file has no such limit.
    """
    if os.path.exists(SCHEDULE_CACHE):
        with open(SCHEDULE_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"rows": [], "professors": [], "filename": ""}


def save_schedule_cache(rows, professors, filename):
    """Write the parsed schedule to the on-disk cache file."""
    with open(SCHEDULE_CACHE, "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "professors": professors, "filename": filename}, f, ensure_ascii=False)


def clear_schedule_cache():
    """Delete the schedule cache file."""
    if os.path.exists(SCHEDULE_CACHE):
        os.remove(SCHEDULE_CACHE)


# =============================================================================
# Routes
# =============================================================================

@app.route("/")
def index():
    """Homepage — loads professor list from the on-disk cache and renders cards."""
    cache = load_schedule_cache()
    professors = cache["professors"]
    prof_photos = {p: get_professor_photo(p) for p in professors}

    return render_template(
        "index.html",
        professors=professors,
        prof_photos=prof_photos
    )


@app.route("/upload", methods=["POST"])
def upload():
    """Accept a new Excel file, parse it, save the filename to config, return to homepage."""
    if "file" not in request.files:
        flash("No file selected.", "error")
        return redirect(url_for("settings"))

    file = request.files["file"]
    if file.filename == "":
        flash("No file selected.", "error")
        return redirect(url_for("settings"))

    if not allowed_file(file.filename):
        flash("Please upload an Excel file (.xlsx or .xls).", "error")
        return redirect(url_for("settings"))

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    result = schedule_parser.parse_schedule(filepath)
    if result["error"]:
        flash(f"Could not read file: {result['error']}", "error")
        return redirect(url_for("settings"))

    # Save to on-disk cache (no session size limit)
    save_schedule_cache(result["rows"], result["professors"], filename)

    # Also record the filename in config for reference
    config = load_config()
    config["last_schedule_file"] = filename
    save_config(config)

    if result["warnings"]:
        for w in result["warnings"]:
            flash(w, "warning")

    flash(f"Schedule loaded — {len(result['professors'])} professor(s) found.", "success")
    return redirect(url_for("index"))


@app.route("/dashboard", methods=["POST"])
def dashboard():
    """Run calculations for the selected professor and render the dashboard."""
    cache = load_schedule_cache()
    if not cache["rows"]:
        flash("No schedule loaded. Please upload a file in Settings.", "error")
        return redirect(url_for("index"))

    professor_name = request.form.get("professor_name", "").strip()
    if not professor_name:
        flash("No professor selected.", "error")
        return redirect(url_for("index"))

    config    = load_config()
    prof_rows = [r for r in cache["rows"] if r["professor_name"] == professor_name]

    now          = datetime.now()
    today_str    = str(date.today())
    now_time_str = now.strftime("%H:%M")

    # Merge holidays from Settings with built-in semester holidays.
    # Edit SEMESTER_HOLIDAYS in calculator.py to change the built-in list.
    all_holidays = list(set(config.get("holidays", []) + calculator.SEMESTER_HOLIDAYS))

    stats = calculator.calculate_stats(
        schedule_rows=prof_rows,
        semester_start=config["semester_start"],
        semester_end=config["semester_end"],
        holidays=all_holidays,
        today=today_str
    )

    semester_week = calculator.calculate_semester_week(
        config["semester_start"],
        config["semester_end"],
        today_str
    )

    timetable = calculator.build_timetable_data(prof_rows, today_str, now_time_str, config["semester_start"])

    # New supplementary metrics for the enhanced dashboard
    insights = calculator.calculate_insights(
        schedule_rows=prof_rows,
        semester_start_str=config["semester_start"],
        today_str=today_str,
        now_time_str=now_time_str,
    )

    photo_url = get_professor_photo(professor_name)

    return render_template(
        "dashboard.html",
        professor=professor_name,
        photo_url=photo_url,
        stats=stats,
        config=config,
        filename=cache["filename"],
        semester_week=semester_week,
        timetable=timetable,
        insights=insights,
    )


@app.route("/settings", methods=["GET"])
def settings():
    """Settings / admin page — upload, semester dates, holidays."""
    config   = load_config()
    cache    = load_schedule_cache()
    filename = cache["filename"] or config.get("last_schedule_file", "")
    return render_template("settings.html", config=config, filename=filename)


@app.route("/settings", methods=["POST"])
def save_settings():
    """Save semester dates and holidays to config.json."""
    semester_start = request.form.get("semester_start", "").strip()
    semester_end   = request.form.get("semester_end",   "").strip()
    holidays_raw   = request.form.get("holidays", "")

    holidays = [h.strip() for h in holidays_raw.splitlines() if h.strip()]

    config = load_config()
    config["semester_start"] = semester_start
    config["semester_end"]   = semester_end
    config["holidays"]       = holidays
    save_config(config)

    flash("Settings saved.", "success")
    return redirect(url_for("settings"))


@app.route("/clear_schedule", methods=["POST"])
def clear_schedule():
    """Remove the current schedule so a new file can be uploaded."""
    clear_schedule_cache()
    config = load_config()
    config["last_schedule_file"] = ""
    save_config(config)
    flash("Schedule cleared.", "success")
    return redirect(url_for("settings"))


@app.route("/department")
def department():
    """Department-wide dashboard — aggregates stats across all professors."""
    cache = load_schedule_cache()
    if not cache["rows"]:
        flash("No schedule loaded. Please upload a file in Settings.", "error")
        return redirect(url_for("settings"))

    config       = load_config()
    today_str    = str(date.today())
    all_holidays = list(set(config.get("holidays", []) + calculator.SEMESTER_HOLIDAYS))

    dept = calculator.calculate_department_stats(
        all_rows       = cache["rows"],
        professors     = cache["professors"],
        semester_start = config["semester_start"],
        semester_end   = config["semester_end"],
        holidays       = all_holidays,
        today          = today_str,
    )

    prof_photos   = {p: get_professor_photo(p) for p in cache["professors"]}
    semester_week = calculator.calculate_semester_week(
        config["semester_start"], config["semester_end"], today_str
    )

    return render_template(
        "department.html",
        dept          = dept,
        prof_photos   = prof_photos,
        config        = config,
        semester_week = semester_week,
    )


@app.route("/reset", methods=["POST"])
def reset():
    session.clear()
    return redirect(url_for("index"))


@app.route("/sample")
def download_sample():
    """Serve a sample Excel file showing the expected format."""
    import pandas as pd
    sample_data = {
        "professor_name": ["Dr. Kim", "Dr. Kim", "Dr. Kim", "Dr. Park", "Dr. Park", "Prof. Lee"],
        "course_name":    ["Intro to Economics", "Intro to Economics", "Business Stats",
                           "Marketing Basics", "Marketing Basics", "Financial Accounting"],
        "day_of_week":    ["Monday", "Wednesday", "Tuesday", "Thursday", "Tuesday", "Friday"],
        "start_time":     ["09:00", "09:00", "14:00", "10:00", "10:00", "13:00"],
        "end_time":       ["10:30", "10:30", "15:30", "11:30", "11:30", "14:30"],
        "location":       ["Room 301", "Room 301", "Room 205", "Room 102", "Room 102", "Room 410"],
        "notes":          ["", "", "", "", "", ""]
    }
    df = pd.DataFrame(sample_data)
    sample_path = os.path.join(UPLOAD_FOLDER, "sample_schedule.xlsx")
    df.to_excel(sample_path, index=False)
    return send_file(sample_path, as_attachment=True, download_name="sample_schedule.xlsx")


# =============================================================================
# Run
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  Sejong University — Professor Schedule Dashboard")
    print("  Open your browser at: http://localhost:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
