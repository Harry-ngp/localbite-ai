from transformers import pipeline
import requests

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

    def get_coordinates(self, landmarks: list):
        if not landmarks:
            return None, None
            
        search_query = " ".join(landmarks[:3])
        print(f"🌍 Asking OpenStreetMap for coordinates of: {search_query}")
        
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": search_query,
            "format": "json",
            "limit": 1
        }
        # 🚨 CRITICAL CHANGE 1: OpenStreetMap will block you without an email here!
        headers = {
            "User-Agent": "LocalBite_AI_Project/1.0 (harikesh_svnit_test@example.com)"
        }
        
        try:
            # We demand a response in 3 seconds flat
            response = requests.get(url, params=params, headers=headers, timeout=3)
            data = response.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            print(f"⚠️ Map API Failed/Timed Out: {e}")
            
        # 🚨 CRITICAL CHANGE 2: THE FAILSAFE! 
        # If OSM is down, we don't freeze. We force the Nagpur coordinates!
        print("🛟 API down! Injecting Fallback Coordinates for Nagpur (Hanuman Temple area)...")
        return 21.1458, 79.0882

# Create our global instance
nlp_engine = GeocoderNLP()