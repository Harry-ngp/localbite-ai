import re
import requests

class GeocoderNLP:
    """Lightweight NLP geocoder that doesn't require PyTorch/transformers.
    Extracts location keywords using regex patterns instead of a heavy ML model.
    This keeps memory usage under 512MB for Render's free tier.
    """
    def __init__(self):
        print("Lightweight NLP Geocoder initialized (no ML model needed)")

    def extract_landmarks(self, address_text: str):
        """Extract potential location names from text using simple NLP heuristics."""
        if not address_text:
            return []
        
        # Remove common non-location words
        stop_words = {'the', 'a', 'an', 'in', 'at', 'on', 'to', 'from', 'near', 'by',
                      'of', 'and', 'or', 'is', 'was', 'are', 'my', 'i', 'me', 'for',
                      'with', 'this', 'that', 'it', 'its', 'do', 'does', 'did',
                      'will', 'would', 'could', 'should', 'have', 'has', 'had',
                      'be', 'been', 'being', 'am', 'get', 'got', 'go', 'going',
                      'want', 'need', 'like', 'please', 'deliver', 'delivery',
                      'order', 'food', 'restaurant', 'shop', 'store'}
        
        # Split into words, keep capitalized words and multi-word phrases
        words = address_text.strip().split()
        landmarks = []
        
        # Strategy 1: Keep capitalized words (likely proper nouns / place names)
        for word in words:
            cleaned = re.sub(r'[^\w\s]', '', word)
            if cleaned and cleaned.lower() not in stop_words and len(cleaned) > 1:
                landmarks.append(cleaned)
        
        # Strategy 2: If comma-separated, treat each segment as a potential landmark
        if ',' in address_text:
            segments = [s.strip() for s in address_text.split(',') if s.strip()]
            for seg in segments:
                seg_clean = seg.strip()
                if seg_clean and len(seg_clean) > 2:
                    landmarks.append(seg_clean)
        
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for lm in landmarks:
            if lm.lower() not in seen:
                seen.add(lm.lower())
                unique.append(lm)
        
        return unique

    def get_coordinates(self, landmarks: list):
        if not landmarks:
            return None, None
            
        search_query = " ".join(landmarks[:3])
        print(f"Asking OpenStreetMap for coordinates of: {search_query}")
        
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": search_query,
            "format": "json",
            "limit": 1
        }
        headers = {
            "User-Agent": "LocalBite_AI_Project/1.0 (harikesh_svnit_test@example.com)"
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=3)
            data = response.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            print(f"Map API Failed/Timed Out: {e}")
            
        # Failsafe: Nagpur coordinates
        print("API down! Injecting Fallback Coordinates for Nagpur (Hanuman Temple area)...")
        return 21.1458, 79.0882

# Create our global instance
nlp_engine = GeocoderNLP()