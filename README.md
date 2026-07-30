# Web Scraper

A simple Python web application for scraping useful page data with
BeautifulSoup. The app includes a clean HTML, CSS, and JavaScript interface
with menu tabs for summaries, headings, links, images, and videos.

## Features

- Scrape any valid `http` or `https` URL
- Extract page title and meta description
- Show a readable page text preview
- Count headings, links, images, videos, and words
- List `h1`, `h2`, and `h3` headings
- Extract page links with absolute URLs
- Extract image URLs and preview thumbnails
- Extract video sources from:
  - `<video src="...">`
  - `<video><source src="..."></video>`
  - embedded iframes from YouTube, Vimeo, Dailymotion, and Twitch

## Project Structure

```text
.
├── scrpy.py
├── requirements.txt
├── quotes_data.csv
├── static
│   ├── app.js
│   └── style.css
└── templates
    └── index.html
```

## Requirements

- Python 3.10 or newer
- Flask
- BeautifulSoup4
- Requests

## Setup

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

## Run

```powershell
python scrpy.py
```

Open the app in your browser:

```text
http://127.0.0.1:5000
```

## API

The frontend calls this endpoint:

```http
POST /api/scrape
Content-Type: application/json

{
  "url": "https://example.com"
}
```

The response includes:

- `title`
- `description`
- `textPreview`
- `counts`
- `headings`
- `links`
- `images`
- `videos`

## Notes

Some websites block automated requests or render content with JavaScript after
the initial page load. This scraper reads the HTML returned by the server, so
dynamic content may not always appear in the results.
