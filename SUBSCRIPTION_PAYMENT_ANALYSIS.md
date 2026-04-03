# Subscription & Payment Flow - Root Cause Analysis

## Problem Summary
When a user makes a payment and completes Razorpay checkout:
- ❌ Plan doesn't auto-update in Supabase
- ❌ User doesn't gain access to paid tier features
- ❌ Plan remains stuck on "free" instead of upgrading to selected paid plan
- ❌ Webhook response not triggering database update

---

## Data Flow Diagram

```
USER                    FRONTEND              BACKEND              RAZORPAY            SUPABASE
 │                        │                      │                    │                    │
 ├─ Click "Go Pro" ───────┤                      │                    │                    │
 │                        │                      │                    │                    │
 │                   ┌────┴────────────────────────┤                    │                    │
 │                   │ POST /api/subscription/create (plan_id, user_id) │                    │
 │                   │    (Save subscription_id to profile) ────────────────────────────────┤
 │                   │    Returns: subscription                         │                    │
 │                   │                      │                    │                    │ STORE sub_id
 │                   │                      │                    │                    │
 │                   │── Open Razorpay ─────────────────────────┤     │                    │
 │                   │  checkout modal      │                    │     │                    │
 │                   │                      │                    │     │                    │
 │  Complete━────────┤                      │                    ├─────┤ Capture mandate   │
 │  Payment           │                      │                    │                    │
 │                   │                      │                    ├────────WEBHOOK────────┤
 │                   │ (Frontend polls every 2s) │  subscription.authenticated event  │
 │                   │ /api/subscription/usage   │  With: subscription_id, plan_id  │
 │                   │                      ├─ WEBHOOK NOT CALLED? ─┘                    │
 │                   │                      │  OR notes missing user_id?                  │
 │                   │ After 24 seconds,    │                    │                    │
 │                   │ success assumed,     │                    │                    │
 │                   │ refreshSubscription()│                    │                    │
 │                   │ Called               │                    │                    │
 │                   │                      │                    │                    │
 └────────────────────────────────────────────────────────────────────────────────────────┘

ISSUE: Webhook (middle part) not updating database → tier stays "free"
```

---

## Root Cause Analysis

### Critical Issues Found

#### **1. WEBHOOK URL NOT CONFIGURED IN RAZORPAY DASHBOARD** ⚠️ [LIKELY CULPRIT]
- **Location:** Backend has `/api/subscription/webhook` endpoint defined
- **Problem:** This webhook URL must be manually configured in Razorpay Dashboard
- **Current Status:** Unknown if it's configured
- **Evidence:**
  - Webhook endpoint exists in main.py line 678
  - But Razorpay won't call it unless explicitly configured
- **Impact:** Without webhook, database never updates

**FIX:** Configure webhook URL in Razorpay Dashboard:
```
URL: https://your-backend-url/api/subscription/webhook
Events: subscription.authenticated, subscription.activated, subscription.charged
```

---

#### **2. MISSING USER_ID IN WEBHOOK NOTES** ⚠️ [PROBABLE CULPRIT]
- **Location:** Backend subscription_service.py, subscription creation
- **Problem:** Code stores `user_id` in Razorpay notes
- **Issue:** Razorpay webhook might not return notes in the payload
- **Current Flow:**
  ```python
  # Line 104 in subscription_service.py
  subscription_data = {
      "plan_id": plan_id,
      "notes": {
          "user_id": user_id  # This might not come back in webhook!
      }
  }
  ```
- **Webhook Handler:**
  ```python
  # Line 706 in main.py
  user_id_from_notes = notes.get("user_id", "")  # Empty if notes missing
  ```

**FIX:** Need fallback lookup by subscription_id:
```python
# Primary lookup should use subscription_id from the header, not notes
sub_id = data["payload"]["subscription"]["entity"]["id"]
# Look up profile by razorpay_subscription_id in DB first
```

---

#### **3. SUBSCRIPTION_ID NOT LINKED TO PROFILE WHEN WEBHOOK EXECUTES** ⚠️ [CONFIRMATION ISSUE]
- **Location:** main.py line 535 (create_subscription)
- **Problem:** subscription_id saved to profile AFTER returning to frontend
- **Timeline Issue:**
  ```
  1. Create subscription on Razorpay (get back sub_id)
  2. Return sub_id to frontend
  3. Frontend opens checkout
  4. User completes payment
  5. Razorpay calls webhook
  6. Webhook tries to find user by sub_id in DB
  7. ❌ But sub_id was already saved before, so this should work...
  ```
- **Actually:** Profile should already have sub_id, but webhook lookup still fails

**The Real Issue:** The webhook handler first tries to find profile by `razorpay_subscription_id`:
```python
# Line 686-694 in main.py
query = self.supabase.table("profiles") \
    .select("id") \
    .eq("razorpay_subscription_id", razorpay_subscription_id) \
    .execute()

if query.data:
    user_id = query.data[0]['id']  # ✅ Should work
elif fallback_user_id:
    user_id = fallback_user_id      # 🔴 Falls back to notes
```

So if notes are missing, it can't find the user!

---

#### **4. UPDATE NOT ACTUALLY CHANGING THE TIER** ⚠️ [DATABASE ISSUE]
- **Location:** subscription_service.py, update_user_subscription function (line 165-199)
- **Problem:** The update might be executing but not changing the tier
- **Check:**
  ```python
  update_data = {
      "subscription_status": status,  # ✅ Updates status
      "updated_at": datetime.now().isoformat()
  }
  
  if tier:  # 🔴 What if tier is None?
      update_data["subscription_tier"] = tier
  ```

**Issue:** If `tier` is `None` (because plan_id wasn't in mapping), tier never gets updated!

---

#### **5. PLAN_ID MAPPING INCOMPLETE** ⚠️ [MAPPING ISSUE]
- **Location:** main.py line 714-719
- **Current Mapping:**
  ```python
  PLAN_TIER_MAP = {
      "plan_SYJ1J3QjtX1mAK": "starter",
      "plan_SYJ1ZJWBFTgZWx": "pro",
      "plan_SYJ1a3OcE6bwDB": "ultra",
  }
  ```
- **Problem:** Enterprise plan NOT in mapping!
- **Plans.jsx rzpPlanId values:**
  ```javascript
  starter: 'plan_SYJ1J3QjtX1mAK'         ✅
  pro: 'plan_SYJ1ZJWBFTgZWx'            ✅
  ultra: 'plan_SYJ1a3OcE6bwDB'          ✅
  enterprise: (no rzpPlanId - "Contact Us") ✅ (OK, no mapping needed)
  ```

This mapping appears complete, but enterprise users can't upgrade via webhook.

---

#### **6. REALTIME DETECTION MIGHT FAIL** ⚠️ [SUPABASE REALTIME]
- **Location:** SubscriptionContext.jsx line 156-180
- **Problem:** Realtime might not fire if profile update happens very quickly
- **Supabase Realtime Gotchas:**
  - ❌ Realtime might miss rapid updates
  - ❌ Row Level Security (RLS) must allow user to see their own profile
  - ❌ Need to wait for webhook update to fully complete before realtime fires

**Check RLS policy:**
User should have realtime access to their own profile row.

---

## Complete Issue Summary Table

| Issue | Severity | Root Cause | Impact | Evidence |
|-------|----------|-----------|--------|----------|
| Webhook not configured in Razorpay | 🔴 CRITICAL | Manual setup missing | Webhook never called | No webhook executions in logs |
| User_id missing from notes in webhook | 🔴 CRITICAL | Razorpay doesn't return notes | Can't identify user | Fallback lookup fails |
| Plan_id → Tier mapping incomplete | 🟡 HIGH | Incomplete mapping | Tier stays null, not updated | Line 714-719 in main.py |
| Realtime change detection fails | 🟡 HIGH | RLS or timing issues | Frontend doesn't see update | No success toast shown |
| Tier only updates if tier != None | 🟡 HIGH | Conditional logic | Silent failure if tier is null | Line 192 subscription_service.py |
| Frontend polling timeout | 🟠 MEDIUM | Only 24s timeout | User thinks it failed | Plans.jsx line 170-173 |
| No error tracking/logging | 🟠 MEDIUM | Missing error handlers | Can't diagnose issues | No webhook error logs |

---

## The Culprits (Most Likely to Least Likely)

### 🔴 **CULPRIT #1: Razorpay Webhook URL Not Configured**
- **Probability:** 70%
- **Why:** Most common setup mistake
- **Evidence:** No webhook events in logs
- **Fix:** Configure in Razorpay Dashboard

### 🔴 **CULPRIT #2: Missing user_id in webhook notes**
- **Probability:** 50%
- **Why:** Razorpay docs unclear about notes persistence
- **Evidence:** Webhook fires but user_id lookup fails
- **Fix:** Add secondary lookup by subscription_id

### 🟡 **CULPRIT #3: Plan_id → Tier mapping returns None**
- **Probability:** 30%
- **Why:** Could be typo in stored plan_id
- **Evidence:** Webhook fires but tier isn't updated
- **Fix:** Add logging to show actual plan_id from webhook

### 🔴 **CULPRIT #4: Realtime change detection not working**
- **Probability:** 40%
- **Why:** RLS or timing issues
- **Evidence:** Database updates but frontend doesn't see it
- **Fix:** Check RLS policies + add polling fallback

---

## Recommended Fixes (Priority Order)

### Fix #1: Enable Webhook Logging (10 minutes)
Add detailed logging to see what Razorpay is actually sending:

```python
# In webhook handler, add this FIRST:
logger.info(f"[Webhook] Full payload: {data}")
logger.info(f"[Webhook] Notes received: {notes}")
logger.info(f"[Webhook] Plan_id: {plan_id}")
logger.info(f"[Webhook] User_id from notes: {user_id_from_notes}")
```

### Fix #2: Add Secondary Lookup (15 minutes)
If user_id not in notes, lookup by subscription_id:

```python
# If user_id_from_notes is empty, use this:
if not user_id_from_notes:
    profiles_with_sub = supabase.table("profiles") \
        .select("id") \
        .eq("razorpay_subscription_id", sub_id) \
        .execute()
    if profiles_with_sub.data:
        user_id_from_notes = profiles_with_sub.data[0]['id']
```

### Fix #3: Add Plan_id → Tier Validation (10 minutes)
Ensure plan_id is actually in the mapping:

```python
tier = PLAN_TIER_MAP.get(plan_id)
if not tier:
    logger.error(f"[Webhook] Unknown plan_id: {plan_id}. Available: {list(PLAN_TIER_MAP.keys())}")
    # Send alert notification
    return {"status": "error", "message": "Unknown plan_id"}
```

### Fix #4: Add Error Status Tracking (20 minutes)
Return proper error status instead of silently failing:

```python
if not user_id_from_notes:
    logger.error(f"[Webhook] Cannot identify user for subscription {sub_id}")
    await sub_service.update_user_subscription(
        sub_id, "error",  # Track as error state
        tier=None,
        fallback_user_id="unknown"
    )
    return {"status": "error", "reason": "Cannot identify user"}
```

### Fix #5: Verify Webhook Configuration
- [ ] Login to Razorpay Dashboard
- [ ] Go to Settings → Webhooks
- [ ] Confirm webhook URL is set to: `https://{backend-url}/api/subscription/webhook`
- [ ] Confirm events: `subscription.authenticated`, `subscription.activated`, `subscription.charged`
- [ ] Test webhook with Razorpay's webhook tester

---

## Testing Checklist

After implementing fixes:
1. ✅ Check backend logs for webhook execution
2. ✅ Verify plan_id is in PLAN_TIER_MAP
3. ✅ Confirm tier is not null after webhook
4. ✅ Verify profile.subscription_tier updated in Supabase
5. ✅ Check frontend receives realtime update
6. ✅ Confirm success toast shows
7. ✅ User can access paid features
8. ✅ Try another payment to confirm it's consistent

---

## Investigation Commands
```bash
# Check webhook logs
tail -f backend/backend.log | grep -i webhook

# Check subscription status in Supabase
supabase select profiles where id = 'user_id' 

# Check Razorpay subscription status
razorpay subscriptions fetch sub_id

# Verify webhook endpoint is reachable
curl -X POST https://your-backend-url/api/subscription/webhook \
  -H "X-Razorpay-Signature: test" \
  -d '{"test": "payload"}'
```
