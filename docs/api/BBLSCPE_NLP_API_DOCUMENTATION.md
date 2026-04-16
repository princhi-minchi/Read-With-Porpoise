# Babelscape NLP Pipeline API Documentation

This is the API for the Babelscape NLP Pipeline backend microservice. It provides tokenization, morphology, POS tagging, and NER labeling.

## Base URL
`https://api.babelscape.com/v1/nlp-pipeline`

## Authentication
Authentication is handled via the `key` query parameter. You must include your API key in every request.

---

## Endpoint: /query

Performs NLP analysis on the input text.

- **Method**: `POST`
- **URL**: `/query`

### Parameters (Query String)

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | Your API key. |
| `text` | `string` | **Yes** | The text to process. |
| `language` | `string` | No | The language of the text. If not provided, the API will attempt to detect it. |

### Quick Start: Python Example

You can use the `requests` library in Python to call the API.

```python
import requests

# API Configuration
BASE_URL = "https://api.babelscape.com/v1/nlp-pipeline/query"
API_KEY = "YOUR_API_KEY_HERE"

def analyze_text(text, language="EN"):
    params = {
        "key": API_KEY,
        "text": text,
        "language": language
    }
    
    response = requests.post(BASE_URL, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

# Usage example
text_to_process = "The fox jumped over Mike's fence"
result = analyze_text(text_to_process)

if result:
    print(f"Detected Language: {result['languageDetect']['name']}")
    for sentence in result['sentences']:
        for token in sentence['tokens']:
            print(f"Token: {token['rawText']} | POS: {token['pos']} | Lemma: {token['morph'].get('lemma', 'N/A')}")
```

---

## Schemas

The following table explains the data structures used by the API.

| Schema | Type | Description |
| :--- | :--- | :--- |
| **Language** | `string` | Represents a language identifier. |
| **POS** | `string` | Universal dependencies Part-Of-Speech tags. Enum: `ADJ`, `ADP`, `ADV`, `AUX`, `CCONJ`, `DET`, `INTJ`, `NOUN`, `NUM`, `PART`, `PRON`, `PROPN`, `PUNCT`, `SCONJ`, `SYM`, `VERB`, `X`. |
| **NERLabel** | `string` | Named Entity Recognition label. Enum: `PER`, `ORG`, `LOC`, `ENTITY`. |
| **InflectionCategory**| `string` | Represents an inflection category (e.g., `FIRST_PERSON`, `SINGULAR`). |
| **ExtractionResponse**| `object` | The root response object containing the NLP analysis results. |
| **Sentence** | `object` | Represents a sentence in the input text, containing a list of tokens. |
| **Offset** | `object` | Represents absolute indices (`start`, `end`) where an object resides in the original text. |
| **LanguageDetection** | `object` | Information about the detected or provided language (`iso`, `name`, `rightToLeft`). |
| **Token** | `object` | Detailed information for a single token, including index, raw text, offsets, lemma, POS, and NER label. |
| **MorphEntry** | `object` | Morphological information for a token, containing the current inflection and other possible inflections. |
| **InflectionEntry** | `object` | Specific inflection details, including forms and associated inflection categories. |
| **ErrorResponse** | `object` | Object returned in case of errors, containing `status`, `error`, and `message`. |

---

## Response Status Codes

| Code | Description |
| :--- | :--- |
| `200` | Successful operation. |
| `400` | Invalid request. |
| `401` | Invalid API key. |
| `422` | Insufficient balance / units left. |
