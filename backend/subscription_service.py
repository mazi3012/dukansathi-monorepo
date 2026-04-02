import os
import logging
from datetime import datetime, timedelta
import jwt
import razorpay
from supabase import Client

logger = logging.getLogger(__name__)

# Constants for Limits
TIER_LIMITS = {
    "free": {"products": 50, "customers": 50, "bills": 100},
    "starter": {"products": 500, "customers": 500, "bills": 1000},
    "pro": {"products": 2000, "customers": 2000, "bills": 5000},
    "ultra": {"products": 10000, "customers": 10000, "bills": 20000},
    "enterprise": {"products": 999999, "customers": 999999, "bills": 999999},
}

USAGE_TOKEN_SECRET = os.getenv("JWT_SECRET", "dukansathi_secret_key_change_me")

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
            first_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            sales_res = self.supabase.table("sales").select("id", count="exact").eq("user_id", user_id).gte("created_at", first_of_month).execute()
            bill_count = sales_res.count if sales_res else 0

            # 4. Get User Tier
            profile_res = self.supabase.table("profiles").select("subscription_tier").eq("id", user_id).single().execute()
            tier = profile_res.data.get("subscription_tier", "free") if profile_res and profile_res.data else "free"

            return {
                "tier": tier,
                "usage": {
                    "products": product_count,
                    "customers": customer_count,
                    "bills": bill_count
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
        """
        try:
            user_id = None
            
            # 1. Primary lookup: by subscription ID
            query = self.supabase.table("profiles") \
                .select("id") \
                .eq("razorpay_subscription_id", razorpay_subscription_id) \
                .execute()
            
            if query.data:
                user_id = query.data[0]['id']
            elif fallback_user_id:
                # 2. Fallback: use user_id from Razorpay notes
                logger.info(f"Using fallback user_id from notes: {fallback_user_id}")
                user_id = fallback_user_id
                # Also save the subscription ID now so future lookups work
                self.supabase.table("profiles").update({
                    "razorpay_subscription_id": razorpay_subscription_id
                }).eq("id", user_id).execute()
            else:
                logger.warning(f"No user found for sub_id={razorpay_subscription_id}")
                return False
            
            update_data = {
                "subscription_status": status,
                "updated_at": datetime.now().isoformat()
            }
            
            if tier:
                update_data["subscription_tier"] = tier
            
            # On cancellation, downgrade to free tier
            if status == "cancelled":
                update_data["subscription_tier"] = "free"
                update_data["razorpay_subscription_id"] = None
            
            self.supabase.table("profiles") \
                .update(update_data) \
                .eq("id", user_id) \
                .execute()
            
            logger.info(f"Updated profile {user_id}: status={status}, tier={tier}")
            return True
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            return False
