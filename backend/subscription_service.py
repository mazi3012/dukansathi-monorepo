import os
import logging
from datetime import datetime, timedelta, timezone
import jwt
import razorpay
from supabase import Client

logger = logging.getLogger(__name__)

# Constants for Limits (ai_credits removed — now handled by credit_ledger)
TIER_LIMITS = {
    "free": {"products": 50, "customers": 50, "bills": 100},
    "starter": {"products": 500, "customers": 500, "bills": 1000},
    "pro": {"products": 2000, "customers": 2000, "bills": 5000},
    "ultra": {"products": 10000, "customers": 10000, "bills": 20000},
    "enterprise": {"products": 999999, "customers": 999999, "bills": 999999},
}

USAGE_TOKEN_SECRET = os.getenv("JWT_SECRET", "dukansathi_secret_key_change_me")
IST = timezone(timedelta(hours=5, minutes=30))


def _ist_month_start_utc_iso() -> str:
    """Return current month start in IST, converted to UTC ISO for timestamptz comparisons."""
    now_ist = datetime.now(IST)
    month_start_ist = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return month_start_ist.astimezone(timezone.utc).isoformat()

class SubscriptionService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.rzp_key = os.getenv("RAZORPAY_KEY_ID")
        self.rzp_secret = os.getenv("RAZORPAY_KEY_SECRET")
        self.client = None
        if self.rzp_key and self.rzp_secret:
            self.client = razorpay.Client(auth=(self.rzp_key, self.rzp_secret))

    async def get_usage_stats(self, user_id: str):
        """Fetch current usage counts for products, customers, and bills (current month)"""
        try:
            # 1. Product Count
            proc_res = self.supabase.table("products").select("id", count="exact").eq("user_id", user_id).execute()
            product_count = proc_res.count if proc_res else 0

            # 2. Customer Count
            cust_res = self.supabase.table("customers").select("id", count="exact").eq("user_id", user_id).execute()
            customer_count = cust_res.count if cust_res else 0

            # 3. Monthly Bill Count
            first_of_month = _ist_month_start_utc_iso()
            sales_res = self.supabase.table("sales").select("id", count="exact").eq("user_id", user_id).gte("created_at", first_of_month).execute()
            bill_count = sales_res.count if sales_res else 0

            # 4. AI Message Count (current month)
            ai_res = self.supabase.table("chat_history") \
                .select("id", count="exact") \
                .eq("user_id", user_id) \
                .eq("role", "user") \
                .gte("created_at", first_of_month) \
                .execute()
            ai_count = ai_res.count if ai_res else 0

            # 5. Get User Tier (use maybe_single to avoid crash when profile doesn't exist)
            profile_res = self.supabase.table("profiles").select("subscription_tier").eq("id", user_id).maybe_single().execute()
            tier = profile_res.data.get("subscription_tier", "free") if profile_res and profile_res.data else "free"

            return {
                "tier": tier,
                "usage": {
                    "products": product_count,
                    "customers": customer_count,
                    "bills": bill_count,
                    "ai_credits": ai_count
                },
                "limits": TIER_LIMITS.get(tier, TIER_LIMITS["free"])
            }
        except Exception as e:
            logger.error(f"Error fetching usage stats: {e}")
            return None

    async def check_limit(self, user_id: str, feature: str):
        """Returns True if allowed to add more, False if limit reached"""
        stats = await self.get_usage_stats(user_id)
        if not stats:
            return False # Conservative approach
        
        current = stats["usage"].get(feature, 0)
        limit = stats["limits"].get(feature, 0)
        
        return current < limit

    def generate_usage_token(self, user_id: str, stats: dict):
        """Generate a short-lived JWT containing subscription and usage info"""
        payload = {
            "sub": user_id,
            "tier": stats["tier"],
            "usage": stats["usage"],
            "limits": stats["limits"],
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        return jwt.encode(payload, USAGE_TOKEN_SECRET, algorithm="HS256")

    async def create_checkout_session(self, user_id: str, plan_id: str):
        """Create a Razorpay Subscription"""
        if not self.client:
            raise Exception("Razorpay not configured")

        try:
            profile_res = self.supabase.table("profiles").select("email, owner_name").eq("id", user_id).single().execute()
            profile = profile_res.data if profile_res else {}

            subscription_data = {
                "plan_id": plan_id,
                "customer_notify": 1,
                "total_count": 120,  # 10 years
                "notes": {
                    "user_id": user_id  # Stored in notes as a fallback for webhook lookup
                }
            }
            
            # 14-day trial
            trial_end = int((datetime.now() + timedelta(days=14)).timestamp())
            subscription_data["start_at"] = trial_end

            subscription = self.client.subscription.create(subscription_data)
            return subscription
        except Exception as e:
            logger.error(f"Razorpay error: {e}")
            raise e

    def verify_webhook(self, payload: bytes, signature: str):
        """Verify Razorpay Webhook signature"""
        webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
        if not webhook_secret:
            logger.warning("RAZORPAY_WEBHOOK_SECRET not set, skipping verification (unsafe!)")
            return True
        
        try:
            self.client.utility.verify_webhook_signature(payload.decode('utf-8'), signature, webhook_secret)
            return True
        except Exception:
            return False

    async def update_user_subscription(
        self,
        razorpay_subscription_id: str,
        status: str,
        tier: str = None,
        fallback_user_id: str = None
    ):
        """Update Supabase profile based on Razorpay webhook event.
        
        Lookup order:
        1. Find profile by razorpay_subscription_id (primary key match).
        2. If not found, use fallback_user_id from webhook notes.
        3. If still not found, search for the subscription ID in the database.
        """
        try:
            user_id = None
            
            # 1. Primary lookup: by subscription ID
            logger.info(f"[Update Sub] Looking up profile by subscription_id: {razorpay_subscription_id}")
            query = self.supabase.table("profiles") \
                .select("id") \
                .eq("razorpay_subscription_id", razorpay_subscription_id) \
                .execute()
            
            if query.data:
                user_id = query.data[0]['id']
                logger.info(f"[Update Sub] Found user {user_id} by subscription_id lookup")
            elif fallback_user_id:
                # 2. Fallback: use user_id from Razorpay notes
                logger.info(f"[Update Sub] Using fallback user_id from notes: {fallback_user_id}")
                user_id = fallback_user_id
                # Also save the subscription ID now so future lookups work
                try:
                    self.supabase.table("profiles").update({
                        "razorpay_subscription_id": razorpay_subscription_id
                    }).eq("id", user_id).execute()
                    logger.info(f"[Update Sub] Saved subscription_id to profile {user_id}")
                except Exception as e:
                    logger.warning(f"[Update Sub] Failed to save subscription_id: {e}")
            else:
                # 3. Last resort: Search all profiles for matching subscription_id (shouldn't happen)
                logger.warning(f"[Update Sub] No fallback user_id, searching database for sub_id {razorpay_subscription_id}")
                search_query = self.supabase.table("profiles") \
                    .select("id") \
                    .like("razorpay_subscription_id", f"%{razorpay_subscription_id}%") \
                    .execute()
                
                if search_query.data:
                    user_id = search_query.data[0]['id']
                    logger.info(f"[Update Sub] Found user {user_id} by search")
                else:
                    logger.error(f"[Update Sub] Cannot identify user for subscription {razorpay_subscription_id}")
                    return False
            
            # Validate tier
            if tier and tier not in ["free", "starter", "pro", "ultra", "enterprise"]:
                logger.error(f"[Update Sub] Invalid tier '{tier}' for user {user_id}")
                return False
            
            update_data = {
                "subscription_status": status,
                "updated_at": datetime.now().isoformat()
            }
            
            if tier:
                update_data["subscription_tier"] = tier
                logger.info(f"[Update Sub] Updating tier to: {tier}")
            else:
                logger.warning(f"[Update Sub] No tier provided, only updating status to: {status}")
            
            # On cancellation, downgrade to free tier
            if status == "cancelled":
                update_data["subscription_tier"] = "free"
                update_data["razorpay_subscription_id"] = None
                logger.info(f"[Update Sub] Cancellation detected, downgrading to free")
            
            result = self.supabase.table("profiles") \
                .update(update_data) \
                .eq("id", user_id) \
                .execute()
            
            if result.data:
                logger.info(f"[Update Sub] Successfully updated profile {user_id}: status={status}, tier={tier}")
                return True
            else:
                logger.error(f"[Update Sub] Update returned no data for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"[Update Sub] Exception during subscription update: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
