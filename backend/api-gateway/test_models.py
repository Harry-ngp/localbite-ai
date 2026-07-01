import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

for m in ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash-001", "gemini-1.5-flash-002", "gemini-2.0-flash", "gemini-2.5-flash"]:
    try:
        response = client.models.generate_content(model=m, contents="hi")
        print(f"SUCCESS: {m}")
        break
    except Exception as e:
        print(f"FAIL: {m} - {e}")
