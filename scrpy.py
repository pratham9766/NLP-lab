from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request


app = Flask(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0 Safari/537.36"
    )
}


def empty_result(url, error):
    return {
        "url": url,
        "title": "Scrape failed",
        "description": "",
        "textPreview": "",
        "counts": {
            "headings": 0,
            "links": 0,
            "images": 0,
            "videos": 0,
            "words": 0,
        },
        "headings": [],
        "links": [],
        "images": [],
        "videos": [],
        "error": error,
    }


def is_valid_url(url):
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def clean_text(value):
    return " ".join(value.get_text(" ", strip=True).split())


def add_media_item(collection, seen, page_url, source_url, label, media_type):
    if not source_url:
        return

    absolute_url = urljoin(page_url, source_url)
    if absolute_url in seen:
        return

    collection.append({
        "label": label or media_type.title(),
        "type": media_type,
        "url": absolute_url,
    })
    seen.add(absolute_url)


def scrape_page(url):
    response = requests.get(url, headers=HEADERS, timeout=12)
    if response.status_code >= 400:
        return empty_result(
            url,
            (
                f"The website returned HTTP {response.status_code}. "
                "It may be blocking automated scraping or the URL may not be publicly accessible."
            ),
        ), 200

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else "No title found"
    description_tag = soup.find("meta", attrs={"name": "description"})
    description = description_tag.get("content", "").strip() if description_tag else ""

    headings = []
    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = clean_text(tag)
        if text:
            headings.append({"level": tag.name.upper(), "text": text})

    links = []
    seen_links = set()
    for tag in soup.find_all("a", href=True):
        href = urljoin(url, tag["href"])
        text = clean_text(tag) or href
        if href not in seen_links:
            links.append({"text": text[:120], "url": href})
            seen_links.add(href)

    images = []
    seen_images = set()
    for tag in soup.find_all("img", src=True):
        src = urljoin(url, tag["src"])
        if src not in seen_images:
            images.append({"alt": tag.get("alt", "Image").strip() or "Image", "url": src})
            seen_images.add(src)

    videos = []
    seen_videos = set()
    for tag in soup.find_all("video"):
        add_media_item(videos, seen_videos, url, tag.get("src"), tag.get("title") or tag.get("aria-label"), "video")
        for source in tag.find_all("source", src=True):
            add_media_item(
                videos,
                seen_videos,
                url,
                source.get("src"),
                source.get("type") or tag.get("title") or "Video source",
                "video",
            )

    video_hosts = ("youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "twitch.tv")
    for tag in soup.find_all("iframe", src=True):
        src = tag.get("src", "")
        if any(host in src.lower() for host in video_hosts):
            add_media_item(
                videos,
                seen_videos,
                url,
                src,
                tag.get("title") or tag.get("aria-label") or "Embedded video",
                "embed",
            )

    body_text = clean_text(soup.body) if soup.body else clean_text(soup)

    return {
        "url": url,
        "title": title,
        "description": description,
        "textPreview": body_text[:1200],
        "counts": {
            "headings": len(headings),
            "links": len(links),
            "images": len(images),
            "videos": len(videos),
            "words": len(body_text.split()),
        },
        "headings": headings[:40],
        "links": links[:80],
        "images": images[:30],
        "videos": videos[:40],
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/scrape", methods=["POST"])
def scrape():
    payload = request.get_json(silent=True) or {}
    url = payload.get("url", "").strip()

    if not is_valid_url(url):
        return jsonify(empty_result(url, "Please enter a valid http or https URL.")), 400

    try:
        result = scrape_page(url)
        if isinstance(result, tuple):
            body, status_code = result
            return jsonify(body), status_code
        return jsonify(result)
    except requests.exceptions.Timeout:
        return jsonify(empty_result(url, "The website took too long to respond. Try a different URL.")), 200
    except requests.exceptions.RequestException as exc:
        return jsonify(empty_result(url, f"Could not connect to this website: {exc}")), 200


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
