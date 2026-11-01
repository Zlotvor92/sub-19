---
name: strava-sync
description: Downloads and syncs training data from Strava using the connected Strava connector (mcp__Strava__* tools). This is ONE option for importing training data - athletes can also use manual logs, other platforms (Garmin, Apple Health), or provide data conversationally. Use this skill specifically when the athlete wants to sync from Strava, pull a period of their Strava history (one week, several weeks, a year), or when the running-coach indicates Strava as the chosen data source. Stores activities in the training-log folder as markdown summaries, one file per week, including lap details for workout runs.
---

# Strava Training Log Sync

## Overview

This skill downloads training data from Strava through the connected Strava connector (tools prefixed
`mcp__Strava__`) and creates weekly markdown summaries in the `training-log` folder. Each week is stored as a single
markdown file with activity summaries, including lap details for workouts, long runs and races.

**Note**: This is a Strava-specific data import tool. The running coach system also supports:
- Other platforms (Garmin Connect, Apple Health, Polar Flow, etc.) - athlete provides data
- Manual training logs - athlete creates markdown files directly
- Conversational input - athlete describes training verbally

The Strava connector is read-only and scoped to the authenticated athlete. It is authorized through the claude.ai
connector settings, not from inside this skill: there is no connect/login tool to call.

## Workflow

### 1. Determine What to Sync

Two modes:

- **Single training week** (used by running-coach): ask "Which training week would you like to sync? (e.g., 1, 2, 3)"
  if not given. File name: `week-{n}.md`. The date range is that plan week (from `training-plan.md`), or the last 7
  days if there is no plan.
- **Date range** (history, e.g. "last year", "since March"): resolve the range to concrete dates. Split it into
  ISO weeks (Monday–Sunday). File name per week: `{YYYY}-W{ww}.md` (e.g. `2026-W43.md`). Also write `summary.md`
  with the whole-period totals and the per-week table (see step 7).

All dates and times are the athlete's local time (Strava `start_local`). If a time must be shown in another zone,
use Europe/Belgrade.

### 2. Check Strava Access

Call `mcp__Strava__eligibility`.
- `eligible: true` → continue.
- Otherwise stop and tell the athlete: access needs an active Strava subscription and the Strava connector enabled in
  claude.ai connector settings. Do not retry in a loop.

Call `mcp__Strava__get_athlete_profile` once to read `measurement_preference` (Metric/Imperial) and `current_focus`
(the athlete's stated goal). Use the athlete's preferred units in the log.

### 3. Fetch Activities

Use `mcp__Strava__search_activities` (it filters by sport and date; `list_activities` cannot filter by sport):

- `start_date_min` / `start_date_max`: the range from step 1, ISO local datetime (`2026-10-26T00:00:00`,
  `2026-11-01T23:59:59`).
- `first: 100`, `use_preferred_units: true`, `include_tags: true`.
- Leave `sport_types` unset to get all activities (running + cross-training). For a running-only request pass
  `["Run", "TrailRun", "VirtualRun"]`.
- Pagination: while `has_next_page` is true, call again with `offset` = previous `offset` + number returned.
- A large page (roughly 100 activities) exceeds the tool output limit and is saved to a file; the tool result gives
  its path. Load that file with Python (`json.load`) and work from it instead of reading it into the conversation.
  Merge pages into one `activities.json` and check that activity ids are unique.

Each activity has: `id`, `name`, `description`, `sport_type`, `start_local`, `gear_id`, `summary` (distance,
moving_time, elapsed_time, elevation_gain, avg_speed, max_speed, avg_pace, avg_pace_display, avg_cadence,
total_calories, relative_effort, pr_count), `weather`, and with `include_tags` also `activity_tags`, `is_commute`,
`is_trainer`.

**Units**: the response carries one `value_units` map (e.g. distance in km, times in seconds, pace in seconds/km).
Present numbers as returned. Do NOT convert units yourself. Quote `avg_pace_display` for pace; compute with the
seconds value `avg_pace`. Ignore `max_pace` as a performance figure (5-second GPS window, often unrealistic).

### 4. Process Each Activity

For each activity extract: name, date/time (`start_local`), `sport_type`, distance, moving time (HH:MM:SS),
elevation gain, average pace (runs) or speed (rides), description/notes, relative effort, weather when present.

**Classify runs** (replaces the old `workout_type` field, which this connector does not return):
- `activity_tags` contains `RACE` → race
- `activity_tags` contains `WORKOUT` → workout
- `activity_tags` contains `LONG_RUN` → long run
- no tag → default run. If the name/description clearly says interval, tempo, threshold, fartlek, race, or similar,
  treat it as a workout and say in the log that this was inferred from the name/description.

**Heart rate and laps**: the activity list has no heart rate and no laps. Call
`mcp__Strava__get_activity_performance` with the activity `id`:
- Single-week mode: for every run (laps + HR).
- Date-range mode up to ~8 weeks: for every race, workout and long run.
- Date-range mode longer than ~8 weeks: for every race in the period, plus a small set of reference runs (the most
  recent easy runs and workouts, and one or two comparable easy runs from earlier, for HR-at-pace comparison) —
  about 10 calls. Each response also carries segment efforts and can be 5–15 KB, so a call per activity over a year is
  not practical.
Runs without performance data get "HR not fetched" in the log, and `summary.md` lists which activities have HR/laps.

From `get_activity_performance` use: `has_heartrate` (check before quoting HR), average/max heart rate, perceived
exertion, `best_efforts`, and `laps`. Values there are SI: distance in meters, speed in m/s, time in seconds. For laps,
convert m/s to pace with Python (`pace_s_per_km = 1000 / speed`), not by hand. A race lap's speed uses elapsed time.

Use `mcp__Strava__get_activity_streams` only when a question needs second-by-second detail (e.g. where the athlete
faded in an interval). Always pass `resolution`.

Optional context, once per sync:
- `mcp__Strava__get_athlete_zones` → HR zones (bpm) and run pace zones (m/s; convert with Python). Report whether
  they are set manually or estimated (`*_source`).
- `mcp__Strava__get_athlete_best_efforts` (sports `["Run"]`; pass `years` for a per-year view) → PRs. These are real
  efforts, not predictions.

### 5. Calculate Week Totals

**IMPORTANT**: Use Python (Bash) to calculate all totals. Do NOT calculate totals manually.

Save the fetched activities to a JSON file first, then run Python on it:

```python
import json
from collections import defaultdict
from datetime import date

activities = json.load(open('activities.json'))  # list of activity dicts from search_activities

def iso_week(a):
    y, w, _ = date.fromisoformat(a['start_local'][:10]).isocalendar()
    return f"{y}-W{w:02d}"

def hms(s):
    s = int(round(s)); return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"

weeks = defaultdict(lambda: defaultdict(list))
for a in activities:
    weeks[iso_week(a)][a['sport_type']].append(a)

for wk in sorted(weeks):
    print(wk)
    for sport, acts in weeks[wk].items():
        dist = sum(a['summary']['distance'] for a in acts)            # unit per value_units (km for Metric)
        mt = sum(a['summary']['moving_time'] for a in acts)            # seconds
        elev = sum(a['summary'].get('elevation_gain') or 0 for a in acts)
        line = f"  {sport}: {len(acts)} x, {dist:.2f} km, {hms(mt)}, {elev:.0f} m"
        if sport in ('Run', 'TrailRun', 'VirtualRun') and dist:
            p = mt / dist
            line += f", avg {int(p // 60)}:{int(p % 60):02d} /km"
        print(line)
```

Adapt the unit labels to `value_units` (km/m for Metric, mi/ft for Imperial). Overall totals across all types are the
same sums without the sport grouping.

### 6. Format as Markdown

One file per week, using the calculated totals:

```markdown
# Training Log: [Start Date] to [End Date]

## Week Summary

### Overall Totals
- **Total Activities**: [count from calculation]
- **Total Distance**: [distance from calculation] km
- **Total Time**: [duration from calculation]
- **Total Elevation**: [elevation from calculation] m

### By Activity Type

#### Run
- **Activities**: [count]
- **Distance**: [distance] km
- **Time**: [HH:MM:SS]
- **Elevation**: [elevation] m

[Include sections for each activity type present in the week]

## Activities

### [Date] - [Activity Name]

**Type**: [Run/Ride/Swim/etc.] ([race/workout/long run/default], [source: tag or inferred])
**Distance**: [distance] km
**Duration**: [HH:MM:SS]
**Pace**: [avg_pace_display]
**Elevation**: [elevation] m
**Heart Rate**: [avg bpm] (max: [max bpm]) — or "no HR" / "HR not fetched"
**Relative Effort**: [value]

[Activity description/notes if available]

#### Lap Details

| Lap | Distance | Time | Pace | HR | Elevation |
|-----|----------|------|------|-----|-----------|
| 1   | [dist]   | [time] | [pace] | [hr] | [elev] |

---

[Continue for each activity...]
```

### 7. Save to training-log Folder

1. Create the folder if it doesn't exist: `mkdir -p training-log`
2. Single-week mode: `training-log/week-{n}.md`.
   Date-range mode: `training-log/{YYYY}-W{ww}.md` per week, plus `training-log/summary.md` with:
   - period, number of runs, total running distance/time
   - per-week table: week, runs, km, time, avg pace, longest run, number of workouts/races
   - weeks with zero running listed explicitly (gaps matter for the coach)
   - PRs from `get_athlete_best_efforts` if fetched
3. Write the markdown content.

### 8. Provide Summary

After syncing, report:
- mode and period (or week number)
- number of activities synced, number of runs
- file locations
- which activities have lap/HR details and which do not
- confirmation that totals were calculated with Python

## Connector Tools Used

- `mcp__Strava__eligibility`: verify access (subscription + connector)
- `mcp__Strava__get_athlete_profile`: units preference, current focus
- `mcp__Strava__search_activities`: fetch activities by date range and sport, offset pagination
- `mcp__Strava__list_activities`: alternative fetch by date range (no sport filter, cursor pagination via `after`)
- `mcp__Strava__get_activity_performance`: HR, perceived exertion, laps, best efforts for one activity
- `mcp__Strava__get_activity_streams`: second-by-second detail, only when needed
- `mcp__Strava__get_athlete_zones`: HR and pace zones
- `mcp__Strava__get_athlete_best_efforts`: PRs

## Error Handling

- Not eligible / connector not available: tell the athlete what is missing (subscription or connector), stop.
- No activities in the period: say so; in date-range mode still list the empty weeks in `summary.md`.
- Lap or HR data unavailable (`has_heartrate` false, empty `laps`): write that in the log, don't estimate it.
- Partial failures (e.g. `failed_lookups` in best efforts): report them, don't hide them.

## Notes

- Workout detection uses `activity_tags` (RACE / WORKOUT / LONG_RUN); without tags, name/description inference must be
  labeled as inferred.
- Units follow the athlete's preference via `use_preferred_units` and the `value_units` map; never convert by hand.
- All times are local (`start_local`); use Europe/Belgrade if a zone must be named.
