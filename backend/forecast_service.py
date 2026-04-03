from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import pstdev
from typing import Dict, List

IST = timezone(timedelta(hours=5, minutes=30))


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _linear_slope(values: List[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0

    x_mean = (n - 1) / 2
    y_mean = sum(values) / n

    numerator = 0.0
    denominator = 0.0
    for i, y in enumerate(values):
        dx = i - x_mean
        numerator += dx * (y - y_mean)
        denominator += dx * dx

    return (numerator / denominator) if denominator else 0.0


def _weighted_mean(values: List[float]) -> float:
    if not values:
        return 0.0
    weights = list(range(1, len(values) + 1))
    denom = sum(weights)
    return sum(v * w for v, w in zip(values, weights)) / denom


def _build_ist_daily_series(rows: List[Dict], lookback_days: int) -> List[Dict]:
    today_ist = datetime.now(IST).date()
    start_day = today_ist - timedelta(days=lookback_days - 1)

    bucket = {}
    for row in rows:
        day_raw = str(row.get("day", ""))
        try:
            day = datetime.fromisoformat(day_raw).date()
        except ValueError:
            continue

        bucket[day] = {
            "date": day.isoformat(),
            "revenue": round(_safe_float(row.get("revenue")), 2),
            "bills": _safe_int(row.get("bills")),
        }

    series = []
    cursor = start_day
    while cursor <= today_ist:
        if cursor in bucket:
            series.append(bucket[cursor])
        else:
            series.append({"date": cursor.isoformat(), "revenue": 0.0, "bills": 0})
        cursor += timedelta(days=1)

    return series


def _compute_dow_factors(history: List[Dict]) -> Dict[int, float]:
    revenues = [d["revenue"] for d in history]
    global_avg = (sum(revenues) / len(revenues)) if revenues else 0.0
    if global_avg <= 0:
        return {i: 1.0 for i in range(7)}

    grouped = {i: [] for i in range(7)}
    for row in history:
        day = datetime.fromisoformat(row["date"]).date()
        grouped[day.weekday()].append(row["revenue"])

    factors = {}
    for i in range(7):
        vals = grouped[i]
        if len(vals) < 2:
            factors[i] = 1.0
        else:
            ratio = (sum(vals) / len(vals)) / global_avg
            factors[i] = _clamp(ratio, 0.65, 1.35)

    return factors


def generate_revenue_forecast(history: List[Dict], horizon_days: int = 30) -> Dict:
    if not history:
        return {
            "daily_forecast": [],
            "summary": {
                "next_7_days_revenue": 0.0,
                "next_30_days_revenue": 0.0,
                "avg_daily_revenue": 0.0,
                "trend_percent": 0.0,
            },
            "model_info": {
                "name": "weighted_moving_average_with_weekday_seasonality",
                "history_points": 0,
            },
        }

    revenues = [d["revenue"] for d in history]
    recent_window = revenues[-min(28, len(revenues)):]
    baseline = _weighted_mean(recent_window)

    slope = _linear_slope(revenues[-min(60, len(revenues)):])
    slope = _clamp(slope, -baseline * 0.25 if baseline else -1000, baseline * 0.25 if baseline else 1000)

    dow_factors = _compute_dow_factors(history)

    volatility_window = revenues[-min(28, len(revenues)):]
    volatility = pstdev(volatility_window) if len(volatility_window) >= 2 else 0.0

    today_ist = datetime.now(IST).date()
    forecast = []
    for i in range(1, horizon_days + 1):
        target_day = today_ist + timedelta(days=i)
        seasonal = dow_factors.get(target_day.weekday(), 1.0)
        pred = max(0.0, baseline * seasonal + (slope * i))
        band = max(pred * 0.12, volatility * 0.5)
        lower = max(0.0, pred - band)
        upper = pred + band

        forecast.append(
            {
                "date": target_day.isoformat(),
                "revenue": round(pred, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            }
        )

    next_7 = sum(d["revenue"] for d in forecast[:7])
    next_30 = sum(d["revenue"] for d in forecast[:30])
    hist_7_avg = sum(revenues[-7:]) / min(7, len(revenues)) if revenues else 0.0
    fut_7_avg = next_7 / 7 if forecast else 0.0

    trend_percent = 0.0
    if hist_7_avg > 0:
        trend_percent = ((fut_7_avg - hist_7_avg) / hist_7_avg) * 100

    return {
        "daily_forecast": forecast,
        "summary": {
            "next_7_days_revenue": round(next_7, 2),
            "next_30_days_revenue": round(next_30, 2),
            "avg_daily_revenue": round((sum(revenues) / len(revenues)) if revenues else 0.0, 2),
            "trend_percent": round(trend_percent, 2),
        },
        "model_info": {
            "name": "weighted_moving_average_with_weekday_seasonality",
            "history_points": len(history),
            "timezone": "Asia/Kolkata",
        },
    }


async def build_forecast_response(supabase, user_id: str, lookback_days: int = 120, horizon_days: int = 30) -> Dict:
    escaped_user_id = user_id.replace("'", "''")
    query = f"""
        SELECT
            (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
            COALESCE(SUM(total_amount), 0)::float8 AS revenue,
            COUNT(*)::int AS bills
        FROM sales
        WHERE user_id = '{escaped_user_id}'
          AND created_at >= NOW() - INTERVAL '{int(lookback_days)} days'
        GROUP BY 1
        ORDER BY 1 ASC
    """

    result = supabase.rpc("exec_sql_secure", {"p_query": query, "p_user_id": user_id}).execute()
    rows = result.data if result and result.data else []

    history = _build_ist_daily_series(rows, lookback_days=lookback_days)
    model_output = generate_revenue_forecast(history, horizon_days=horizon_days)

    return {
        "timezone": "Asia/Kolkata",
        "generated_at": datetime.now(IST).isoformat(),
        "history": history,
        "forecast": model_output["daily_forecast"],
        "summary": model_output["summary"],
        "model_info": model_output["model_info"],
    }
