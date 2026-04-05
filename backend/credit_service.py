"""
File: credit_service.py
Purpose: Handles credit token balance for the Pay-As-You-Go system.
         Works ALONGSIDE the existing SubscriptionService — does not replace it.

Credit Cost Map:
  - 1 Bill generated     = 1 credit
  - 1 AI chat message    = 2 credits
  - 1 Voice-to-Bill      = 5 credits
  - Monthly refresh      = based on subscription tier
"""

import os
import logging
import razorpay
from supabase import Client

logger = logging.getLogger(__name__)

# Monthly credit allocation per subscription tier (refreshed on 1st of each month)
TIER_MONTHLY_CREDITS = {
    "free":       100,
    "starter":    500,
    "pro":        2500,
    "ultra":      10000,
    "enterprise": 999999,
}

# Credit cost per action (UNIFIED: all AI actions = 1 credit)
CREDIT_COSTS = {
    "ai_chat":       1,
    "voice_bill":    1,
}

# Credit Pack definitions (price in paise for Razorpay)
CREDIT_PACKS = {
    "micro":    {"credits": 200,   "amount_paise": 4900,  "label": "Micro-Topup (₹49)"},
    "small":    {"credits": 500,   "amount_paise": 9900,  "label": "Small Shop (₹99)"},
    "business": {"credits": 2000,  "amount_paise": 24900, "label": "Business (₹249)"},
    "retail":   {"credits": 10000, "amount_paise": 99900, "label": "Retail King (₹999)"},
}


class CreditService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        rzp_key = os.getenv("RAZORPAY_KEY_ID")
        rzp_secret = os.getenv("RAZORPAY_KEY_SECRET")
        self.rzp = razorpay.Client(auth=(rzp_key, rzp_secret)) if rzp_key and rzp_secret else None

    # ------------------------------------------------------------------
    # BALANCE
    # ------------------------------------------------------------------

    def get_balance(self, user_id: str) -> int:
        """Return current credit balance via secure RPC."""
        try:
            result = self.supabase.rpc("get_credit_balance", {"p_user_id": user_id}).execute()
            return result.data if isinstance(result.data, int) else 0
        except Exception as e:
            logger.error(f"[Credits] get_balance error for {user_id}: {e}")
            return 0

    # ------------------------------------------------------------------
    # DEDUCT
    # ------------------------------------------------------------------

    def deduct(self, user_id: str, action: str, description: str = "") -> dict:
        """
        Atomically deduct credits for an action via the deduct_credits RPC.
        Returns: {"success": bool, "balance": int, "cost": int}
        """
        cost = CREDIT_COSTS.get(action, 1)
        try:
            result = self.supabase.rpc("deduct_credits", {
                "p_user_id":    user_id,
                "p_amount":     cost,
                "p_action":     action,
                "p_description": description or action,
            }).execute()
            data = result.data or {}
            data["cost"] = cost
            return data
        except Exception as e:
            logger.error(f"[Credits] deduct error for {user_id}, action={action}: {e}")
            return {"success": False, "balance": 0, "cost": cost, "error": str(e)}

    def can_afford(self, user_id: str, action: str) -> bool:
        """Quick check without deducting."""
        cost = CREDIT_COSTS.get(action, 1)
        return self.get_balance(user_id) >= cost

    # ------------------------------------------------------------------
    # ADD CREDITS
    # ------------------------------------------------------------------

    def add_credits(
        self,
        user_id: str,
        amount: int,
        action: str,
        description: str = "",
        razorpay_order_id: str = None,
        razorpay_payment_id: str = None,
    ) -> dict:
        """Insert a credit row via RPC. Called after payment verified or monthly refresh."""
        try:
            result = self.supabase.rpc("add_credits", {
                "p_user_id":             user_id,
                "p_amount":              amount,
                "p_action":              action,
                "p_description":         description or action,
                "p_razorpay_order_id":   razorpay_order_id,
                "p_razorpay_payment_id": razorpay_payment_id,
            }).execute()
            return result.data or {"success": False}
        except Exception as e:
            logger.error(f"[Credits] add_credits error for {user_id}: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # MONTHLY REFRESH
    # ------------------------------------------------------------------

    def refresh_monthly_credits(self, user_id: str, tier: str) -> dict:
        """
        Add the monthly allocation for a user based on their subscription tier.
        Should be called on 1st of month (cron job or on login check).
        Idempotent: checks if already refreshed this month before inserting.
        """
        from datetime import datetime, timezone
        monthly_credits = TIER_MONTHLY_CREDITS.get(tier, TIER_MONTHLY_CREDITS["free"])

        try:
            # Check if already refreshed this calendar month
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            existing = self.supabase.table("credit_ledger") \
                .select("id") \
                .eq("user_id", user_id) \
                .eq("action_type", "monthly_refresh") \
                .gte("created_at", month_start.isoformat()) \
                .limit(1) \
                .execute()

            if existing.data:
                logger.info(f"[Credits] Monthly refresh already done for {user_id} this month.")
                return {"success": True, "skipped": True, "credits": monthly_credits}

            return self.add_credits(
                user_id=user_id,
                amount=monthly_credits,
                action="monthly_refresh",
                description=f"Monthly credit refresh for {tier} plan — {now.strftime('%B %Y')}",
            )
        except Exception as e:
            logger.error(f"[Credits] refresh_monthly_credits error for {user_id}: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # RAZORPAY ONE-TIME ORDER (Credit Pack Purchase)
    # ------------------------------------------------------------------

    def create_credit_order(self, pack_id: str, user_id: str) -> dict:
        """Create a one-time Razorpay Order for a credit pack purchase."""
        if not self.rzp:
            raise Exception("Razorpay not configured")

        pack = CREDIT_PACKS.get(pack_id)
        if not pack:
            raise ValueError(f"Unknown credit pack: {pack_id}")

        order_data = {
            "amount":   pack["amount_paise"],
            "currency": "INR",
            "receipt":  f"credits_{user_id[:8]}_{pack_id}",
            "notes": {
                "user_id":  user_id,
                "pack_id":  pack_id,
                "credits":  pack["credits"],
                "label":    pack["label"],
            },
        }
        order = self.rzp.order.create(order_data)
        return order

    def verify_credit_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        user_id: str,
        pack_id: str,
    ) -> dict:
        """
        Verify Razorpay payment HMAC and add credits to ledger.
        Returns: {"success": bool, "credits_added": int, "balance": int}
        """
        if not self.rzp:
            raise Exception("Razorpay not configured")

        # 1. Verify HMAC signature
        self.rzp.utility.verify_payment_signature({
            "razorpay_order_id":   razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature":  razorpay_signature,
        })

        pack = CREDIT_PACKS.get(pack_id)
        if not pack:
            raise ValueError(f"Unknown pack_id: {pack_id}")

        # Idempotency: check if this payment was already processed
        try:
            existing = self.supabase.table("credit_ledger") \
                .select("id") \
                .eq("razorpay_payment_id", razorpay_payment_id) \
                .limit(1) \
                .execute()
            if existing.data:
                logger.warning(f"[Credits] Duplicate payment detected: {razorpay_payment_id}")
                balance = self.get_balance(user_id)
                return {
                    "success": True,
                    "credits_added": 0,
                    "balance": balance,
                    "pack": pack["label"],
                    "duplicate": True,
                }
        except Exception:
            pass  # If check fails, proceed normally — the unique index will catch duplicates

        # 2. Add credits to ledger
        result = self.add_credits(
            user_id=user_id,
            amount=pack["credits"],
            action="topup",
            description=f"Credit pack purchase: {pack['label']}",
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
        )

        if not result.get("success"):
            raise Exception("Failed to add credits to ledger")

        logger.info(f"[Credits] ✅ Added {pack['credits']} credits for user {user_id} (pack: {pack_id})")
        return {
            "success":       True,
            "credits_added": pack["credits"],
            "balance":       result.get("balance", 0),
            "pack":          pack["label"],
        }
