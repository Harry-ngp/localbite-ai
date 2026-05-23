from transformers import pipeline
import requests # NEW: For talking to the Maps API

class GeocoderNLP:
    def __init__(self):
        print("🧠 Loading HuggingFace NER Model into memory...")
        self.ner_pipeline = pipeline("ner", aggregation_strategy="simple")
        print("✅ AI Brain Online!")

    def extract_landmarks(self, address_text: str):
        raw_entities = self.ner_pipeline(address_text)
        extracted_landmarks = []
        for entity in raw_entities:
            if entity['entity_group'] in ['LOC', 'ORG', 'MISC']:
                extracted_landmarks.append(entity['word'])
        return extracted_landmarks

    # THIS IS NEW: The GPS Fetcher
    def get_coordinates(self, landmarks: list):
        if not landmarks:
            return None, None
            
        # Combine the top 3 landmarks into a search string (e.g., "Hanuman Temple Nagpur")
        search_query = " ".join(landmarks[:3])
        print(f"🌍 Asking OpenStreetMap for coordinates of: {search_query}")
        
        # The free API endpoint
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": search_query,
            "format": "json",
            "limit": 1
        }
        # OpenStreetMap requires us to identify our app so they don't block us
        headers = {
            "User-Agent": "LocalBite_AI_Project/1.0"
        }
        
        try:
            response = requests.get(url, params=params, headers=headers)
            data = response.json()
            if data:
                # Success! We got the coordinates
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            print(f"⚠️ Map API Error: {e}")
            
        return None, None

# Create our global instance
nlp_engine = GeocoderNLP()