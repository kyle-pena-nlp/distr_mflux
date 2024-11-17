import requests

response = requests.post('http://localhost:3000/imagePrompt', json = {
    "prompt": "foo"
})

#print(response.text)
print(response.status_code)
print(response.reason)
print(response.raw)
print(response.json())