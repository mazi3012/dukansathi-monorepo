from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List

from forecast_service import build_inventory_stockout_forecast_response

IST = timezone(timedelta(hours=5, minutes=30))


async def generate_inventory_risk_notifications(
    supabase,
    user_id: str,
    lookback_days: int = 60,
    risk_days_threshold: int = 14,
) -> Dict:
    """Create stockout-risk notifications from forecasted inventory runout."""
    forecast = await build_inventory_stockout_forecast_response(
        supabase=supabase,
        user_id=user_id,
        lookback_days=lookback_days,
    )

    candidates = [
        item for item in forecast.get("products", [])
        if item.get("risk_level") in {"out", "critical", "high"}
        and (item.get("days_to_stockout") is None or item.get("days_to_stockout") <= risk_days_threshold)
    ]

    if not candidates:
        return {"created": 0, "skipped": 0, "items": []}

    escaped_user_id = user_id.replace("'", "''")
    existing_query = f"""
        SELECT
            COALESCE((payload->>'product_id')::bigint, 0) AS product_id
        FROM notifications
        WHERE user_id = '{escaped_user_id}'
          AND type = 'stockout_risk'
          AND is_read = false
          AND created_at >= NOW() - INTERVAL '2 days'
    """
    existing_res = supabase.rpc("exec_sql_secure", {"p_query": existing_query, "p_user_id": user_id}).execute()
    existing_rows = existing_res.data if existing_res and existing_res.data else []
    existing_product_ids = {int(r.get("product_id") or 0) for r in existing_rows}

    inserts: List[Dict] = []
    skipped = 0
    for item in candidates:
        product_id = int(item.get("product_id") or 0)
        if product_id in existing_product_ids:
            skipped += 1
            continue

        days_left = item.get("days_to_stockout")
        if item.get("risk_level") == "out":
            title = f"{item.get('name')} is out of stock"
            message = "This product already has no stock. Reorder immediately."
            severity = "critical"
        elif days_left is not None and days_left <= 7:
            title = f"{item.get('name')} may run out in {int(max(1, days_left))} days"
            message = "Sales trend shows urgent replenishment is needed."
            severity = "high"
        else:
            title = f"{item.get('name')} stock risk detected"
            message = "Projected stockout is near. Plan reorder to avoid lost sales."
            severity = "medium"

        inserts.append(
            {
                "user_id": user_id,
                "type": "stockout_risk",
                "severity": severity,
                "title": title,
                "message": message,
                "payload": {
                    "product_id": product_id,
                    "current_stock": item.get("current_stock"),
                    "forecast_next_7_units": item.get("forecast_next_7_units"),
                    "days_to_stockout": days_left,
                    "expected_stockout_date": item.get("expected_stockout_date"),
                    "recommended_reorder_qty": item.get("recommended_reorder_qty"),
                },
                "created_at": datetime.now(IST).isoformat(),
            }
        )

    if inserts:
        supabase.table("notifications").insert(inserts).execute()

    return {
        "created": len(inserts),
        "skipped": skipped,
        "items": inserts,
    }
