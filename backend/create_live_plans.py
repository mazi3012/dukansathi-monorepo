import razorpay
import sys

KEY_ID = "rzp_live_ScZFOykzcxTcp0"
KEY_SECRET = "F2B1fGQz6sACBC9UiLhsT2HN"

# Initialize Client
client = razorpay.Client(auth=(KEY_ID, KEY_SECRET))

# Plan Definitions
plans = [
    {
        "name": "Starter",
        "description": "Dukan Sathi Starter Plan (Monthly)",
        "amount": 129 * 100, # in paise
        "currency": "INR"
    },
    {
        "name": "Pro",
        "description": "Dukan Sathi Pro Plan (Monthly)",
        "amount": 399 * 100, # in paise
        "currency": "INR"
    },
    {
        "name": "Ultra",
        "description": "Dukan Sathi Ultra Plan (Monthly)",
        "amount": 799 * 100, # in paise
        "currency": "INR"
    }
]

created_plans = {}

print("Initializing creation of Live Subscription Plans on Razorpay...\n")

for p in plans:
    try:
        response = client.plan.create({
            "period": "monthly",
            "interval": 1,
            "item": {
                "name": p["name"],
                "amount": p["amount"],
                "currency": p["currency"],
                "description": p["description"]
            }
        })
        created_plans[p["name"]] = response["id"]
        print(f"✅ Created {p['name']} Plan successfully! ID: {response['id']}")
    except Exception as e:
        print(f"❌ Failed to create {p['name']} Plan: {e}")

print("\n")
print("="*60)
print("Environment Variable Values for Vercel/Cloud Run")
print("="*60)
print(f"RAZORPAY_PLAN_STARTER={created_plans.get('Starter', 'ERROR')}")
print(f"RAZORPAY_PLAN_PRO={created_plans.get('Pro', 'ERROR')}")
print(f"RAZORPAY_PLAN_ULTRA={created_plans.get('Ultra', 'ERROR')}")
print("="*60)
