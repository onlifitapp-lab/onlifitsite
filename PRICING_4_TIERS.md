# Pricing Plans Update - 4 Tiers

## ✅ Added Monthly Pricing Tier

### **New Pricing Structure:**

Trainers can now offer **4 flexible pricing tiers** instead of 3:

1. **Per Session / Hourly Rate** 
   - For single sessions or hourly training
   - Example: "1 Hour Session" - ₹999

2. **Weekly Package**
   - For regular weekly clients
   - Example: "1 Week (5 Sessions)" - ₹3,499

3. **Monthly Package** ⭐ NEW
   - For committed monthly clients
   - Example: "1 Month Unlimited" - ₹9,999

4. **Transformation / Long-term Program**
   - For serious fitness transformations
   - Example: "3-Month Transformation" - ₹25,999

---

## What Changed

### settings.html - Pricing Section

**Before (3 tiers):**
```
✓ Hourly
✓ Weekly
✓ Monthly/Transformation (combined)
```

**After (4 tiers):**
```
✓ Hourly
✓ Weekly
✓ Monthly ← SEPARATE NOW
✓ Transformation ← NEW TIER
```

---

## Usage Example

### A Trainer's Pricing Strategy:

**Beginner Tier:**
- **Hourly Rate**: ₹999/hour
- Perfect for clients trying out training

**Regular Client:**
- **Weekly Package**: ₹3,499/week (5 sessions)
- Save ₹1,496 vs hourly rate
- Commitment: 1 week

**Committed Client:**
- **Monthly Package**: ₹9,999/month (unlimited sessions)
- Best value for regular attendees
- Commitment: 1 month

**Transformation Program:**
- **3-Month Program**: ₹25,999 (complete transformation)
- Includes meal plans, weekly check-ins, unlimited sessions
- Commitment: 3 months
- Save ₹4,998 vs monthly rate

---

## Benefits

### For Trainers:
✅ **More flexibility** - Offer packages for every client type  
✅ **Better pricing strategy** - Incentivize longer commitments  
✅ **Higher revenue** - Monthly and transformation packages  
✅ **Clear differentiation** - Monthly vs Transformation programs  

### For Clients:
✅ **More choices** - Pick package that fits their commitment level  
✅ **Clear pricing** - See value at each tier  
✅ **Savings incentive** - Better rates for longer commitments  
✅ **Flexibility** - Start hourly, upgrade to monthly  

---

## Database Structure

Plans are stored as JSONB in the `profiles` table:

```json
{
  "basic": {
    "label": "1 Hour Session",
    "price": 999
  },
  "standard": {
    "label": "1 Week (5 Sessions)",
    "price": 3499
  },
  "premium": {
    "label": "1 Month Unlimited",
    "price": 9999
  },
  "transformation": {
    "label": "3-Month Transformation",
    "price": 25999
  }
}
```

---

## How to Set Pricing

1. **Login as Trainer**
2. **Go to Settings** (sidebar)
3. **Scroll to "Pricing & Packages"**
4. **Fill in all 4 tiers:**
   - Hourly: Label + Price
   - Weekly: Label + Price
   - Monthly: Label + Price ← NEW
   - Transformation: Label + Price ← NEW
5. **Click "Save Changes"**
6. ✅ All prices now display on your trainer profile

---

## Example Pricing Templates

### Budget Trainer:
- Hourly: ₹799
- Weekly: ₹2,999 
- Monthly: ₹7,999
- 3-Month: ₹19,999

### Mid-Range Trainer:
- Hourly: ₹999
- Weekly: ₹3,499
- Monthly: ₹9,999
- 3-Month: ₹25,999

### Premium Trainer:
- Hourly: ₹1,499
- Weekly: ₹5,499
- Monthly: ₹14,999
- 3-Month: ₹39,999

---

## Recommended Labels

### Hourly/Session:
- "1 Hour Session"
- "Single Session"
- "Trial Session"
- "Per Hour Training"

### Weekly:
- "1 Week Package (5 Sessions)"
- "Weekly Training"
- "5 Days/Week"
- "Week Pass"

### Monthly:
- "1 Month Unlimited"
- "Monthly Membership"
- "30-Day Pass"
- "Monthly Training Plan"

### Transformation:
- "3-Month Transformation"
- "8-Week Body Transformation"
- "12-Week Fitness Program"
- "Quarterly Intensive Program"

---

## Summary

✅ **4 pricing tiers** instead of 3  
✅ **Separate Monthly tier** for regular clients  
✅ **Transformation tier** for long-term programs  
✅ **More flexibility** for trainers and clients  
✅ **Better value proposition** at each level  

File updated: `settings.html`

Deploy and start offering flexible pricing to your clients! 💰
