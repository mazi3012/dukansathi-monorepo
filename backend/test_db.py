import traceback
import asyncio
import os
from dotenv import load_dotenv

load_dotenv(".env")

from telegram_bot import execute_draft

async def test():
    draft={'type': 'payment_draft', 'customer_name': 'Amit', 'amount': 200, 'payment_type': 'payment'}
    try:
        res, pdf = await execute_draft('00000000-0000-0000-0000-000000000000', draft)
        print("RESULT CODE:", res.encode('utf-8'))
    except Exception as e:
        print("SCRIPT CRASH:", traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test())
