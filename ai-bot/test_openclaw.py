import asyncio
import dukansathi_ai.agent_graph as ag

async def main():
    print("Testing OpenClaw Extract Action Params")
    print(f"Loaded Skills:\n{ag.OPENCLAW_SKILLS[:100]}...\n")
    
    # Test 1: Payment Due
    query_due = "add 500 due to kartik"
    print(f"\nQuery: {query_due}")
    res_due = await ag.extract_action_params(query_due, model="phi3:mini")
    print(f"Result (phi3:mini): {res_due}")
    
    # Test 2: Invoice
    query_invoice = "make a bill for ajay for 3kg rize"
    print(f"\nQuery: {query_invoice}")
    res_invoice = await ag.extract_action_params(query_invoice, model="phi3:mini")
    print(f"Result (phi3:mini): {res_invoice}")

if __name__ == "__main__":
    asyncio.run(main())
