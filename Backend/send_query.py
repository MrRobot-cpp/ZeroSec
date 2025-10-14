import requests
import sys

query = sys.argv[1] if len(sys.argv) > 1 else "test"

response = requests.post("http://127.0.0.1:5000/inspect", json={"chunk": query})

print("Response:", response.text)
