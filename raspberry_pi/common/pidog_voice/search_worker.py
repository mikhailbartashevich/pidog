#!/usr/bin/env python3
"""Isolated DDGS/SearXNG/Brave search process used by the PiDog assistant."""

from __future__ import annotations

import json
import os
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def brave(query: str) -> list[dict[str, str]]:
    params = urlencode({"q": query, "count": 5, "search_lang": "ru"})
    request = Request(
        f"https://api.search.brave.com/res/v1/web/search?{params}",
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"],
        },
    )
    with urlopen(request, timeout=12) as response:
        data = json.load(response)
    return [
        {"title": item.get("title", ""), "href": item.get("url", ""),
         "body": item.get("description", "")}
        for item in data.get("web", {}).get("results", [])
    ]


def searxng(query: str) -> list[dict[str, str]]:
    base = os.environ["PIDOG_SEARXNG_URL"].rstrip("/")
    params = urlencode({"q": query, "format": "json", "language": "ru"})
    with urlopen(f"{base}/search?{params}", timeout=12) as response:
        data = json.load(response)
    return [
        {"title": item.get("title", ""), "href": item.get("url", ""),
         "body": item.get("content", "")}
        for item in data.get("results", [])[:5]
    ]


def ddgs(query: str) -> list[dict[str, str]]:
    from ddgs import DDGS

    return list(DDGS().text(query, region="ru-ru", safesearch="moderate", max_results=5))


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        print("query is required", file=sys.stderr)
        return 2
    try:
        if os.environ.get("BRAVE_SEARCH_API_KEY"):
            results = brave(sys.argv[1])
        elif os.environ.get("PIDOG_SEARXNG_URL"):
            results = searxng(sys.argv[1])
        else:
            results = ddgs(sys.argv[1])
    except Exception as error:
        print(f"search failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(results, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
