import re

path = r'e:\dukanv22\ai-bot\dukansathi_ai\agent_graph.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and print lines 679-694 for verification
lines = content.split('\n')
for i, line in enumerate(lines[678:696], start=679):
    print(f"{i}: {repr(line)}")

# Simple string replacement
old_block = (
    "    # --- PATTERN 2: Add Customer ---\r\n"
    "    # \"add customer rahul contact 3434343423\" / \"new customer X phone Y\"\r\n"
    "    customer_pattern = re.search(\r\n"
    "        r'(?:add|new|create|register)\\s+(?:a\\s+)?(?:new\\s+)?customer\\s+([\\w\\s]+?)\\s+(?:contact|phone|number|mobile|no)\\s+([\\d]+)',\r\n"
    "        ql\r\n"
    "    )\r\n"
    "    if customer_pattern:\r\n"
    "        name = customer_pattern.group(1).strip().title()\r\n"
    "        phone = customer_pattern.group(2).strip()\r\n"
    "        return json.dumps({\r\n"
    "            \"type\": \"customer_draft\",\r\n"
    "            \"name\": name,\r\n"
    "            \"phone\": phone,\r\n"
    "            \"address\": \"\"\r\n"
    "        })"
)

new_block = (
    "    # --- PATTERN 2: Add Customer ---\r\n"
    "    # \"add customer rahul contact 9876543210\" OR \"add customer rahul\" (phone optional)\r\n"
    "    customer_pattern_with_phone = re.search(\r\n"
    "        r'(?:add|new|create|register)\\s+(?:a\\s+)?(?:new\\s+)?customer\\s+([\\w\\s]+?)\\s+(?:contact|phone|number|mobile|no\\.?)\\s+([\\d]+)',\r\n"
    "        ql\r\n"
    "    )\r\n"
    "    customer_pattern_simple = re.search(\r\n"
    "        r'(?:add|new|create|register)\\s+(?:a\\s+)?(?:new\\s+)?customer\\s+([\\w\\s]+)',\r\n"
    "        ql\r\n"
    "    )\r\n"
    "    if customer_pattern_with_phone:\r\n"
    "        name = customer_pattern_with_phone.group(1).strip().title()\r\n"
    "        phone = customer_pattern_with_phone.group(2).strip()\r\n"
    "        return json.dumps({\r\n"
    "            \"type\": \"customer_draft\",\r\n"
    "            \"name\": name,\r\n"
    "            \"phone\": phone,\r\n"
    "            \"address\": \"\"\r\n"
    "        })\r\n"
    "    elif customer_pattern_simple:\r\n"
    "        name = customer_pattern_simple.group(1).strip().title()\r\n"
    "        return json.dumps({\r\n"
    "            \"type\": \"customer_draft\",\r\n"
    "            \"name\": name,\r\n"
    "            \"phone\": \"\",\r\n"
    "            \"address\": \"\"\r\n"
    "        })"
)

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: customer regex updated")
else:
    print("NOT FOUND: trying with LF endings")
    old_lf = old_block.replace('\r\n', '\n')
    new_lf = new_block.replace('\r\n', '\n')
    if old_lf in content:
        content = content.replace(old_lf, new_lf, 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("SUCCESS with LF: customer regex updated")
    else:
        print("FAILED: pattern not found in file")
