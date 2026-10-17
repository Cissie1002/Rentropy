"""Rentropy prototype: local source data + optional TigerData + Gemini."""

import json
import os
import pathlib
import random
import time

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

ROOT = pathlib.Path(__file__).resolve().parent
load_dotenv(dotenv_path=ROOT / ".env", override=True)
DATA = ROOT / "data" / "housing_indicators.json"

app = Flask(__name__, static_folder="static")


def read_records():
    if not DATA.exists():
        return []
    with DATA.open(encoding="utf-8") as file:
        rows = json.load(file)
    return rows if isinstance(rows, list) else []


@app.get("/")
def home():
    return send_from_directory(ROOT / "static", "index.html")


@app.get("/api/housing")
def housing():
    rows = read_records()
    return jsonify({
        "records": rows,
        "count": len(rows),
        "source": "Toronto Neighbourhood Profiles (2021 Census)",
        "note": "Historical descriptive indicators, not listing prices.",
    })


@app.get("/api/status")
def status():
    return jsonify({
        "records": len(read_records()),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "tigerdata_configured": bool(os.getenv("DATABASE_URL")),
    })


@app.post("/api/ai")
def ai():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Gemini is not configured. Set GEMINI_API_KEY in .env."}), 503

    task = str(body.get("task", "compare"))[:30]
    if task not in {"recommend", "compare", "policy", "explain"}:
        return jsonify({"error": "Unsupported task."}), 400

    context = body.get("context", {})
    if not isinstance(context, dict):
        return jsonify({"error": "Invalid context."}), 400

    context_text = json.dumps(context, ensure_ascii=False)[:18000]
    instructions = (
        "You are Rentropy, a nonpartisan Toronto civic-housing data interpreter. "
        "Use only supplied contextual facts, with dates and definitions. "
        "Never fabricate listings, present-day neighbourhood rents, travel times, "
        "eligibility, prediction-model results, causal zoning impacts, or public subsidies. "
        "2021 Census shelter-cost medians are NOT 2026 asking rents. "
        "Scenarios reflect user-chosen assumptions, not validated market forecasts. "
        "A higher subsidized-tenancy share is not inherently negative. "
        "Provide grounded, concise advice, point out missing data, and suggest next steps. "
        "Do not stereotype residents or rank protected groups. "
        "Do not recommend a political party or election candidate. "
        "Respond in clear English with short headings."
    )
    prompt = (
        f"{instructions}\n\nTask: {task}\n\n"
        f"Housing data and user preferences:\n{context_text}"
    )

    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
    app.logger.info("Rentropy Gemini request: model=%s, task=%s", model, task)

    try:
        # Timeout is in milliseconds; retry transient 503 responses below.
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=45000),
        )
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                answer = response.text
                if not answer:
                    return jsonify({"error": "Gemini returned no text. Please try again."}), 502
                return jsonify({"text": answer, "model": model})
            except ServerError as exc:
                if "503" not in str(exc) or attempt == 2:
                    raise
                delay = 2 ** attempt + random.uniform(0, 0.5)
                app.logger.warning(
                    "Gemini is busy (503); retrying after %.1f seconds (%d/3)",
                    delay,
                    attempt + 1,
                )
                time.sleep(delay)

    except ServerError:
        app.logger.exception("Gemini server error")
        return jsonify({
            "error": "Gemini is temporarily busy. Your housing comparisons still work; please try again shortly."
        }), 503
    except ClientError:
        app.logger.exception("Gemini client error")
        return jsonify({
            "error": "Gemini could not process this request. Check the Flask terminal for details."
        }), 502
    except Exception:
        app.logger.exception("Gemini request failed")
        return jsonify({
            "error": "The AI explanation is temporarily unavailable. Please try again shortly."
        }), 502


@app.post("/api/snapshot")
def snapshot():
    """Optional TigerData logging; only public area-level data, no personal budgets."""
    if not os.getenv("DATABASE_URL"):
        return jsonify({"error": "TigerData not configured; local app still works"}), 503

    records = read_records()
    try:
        import psycopg

        with psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "CREATE TABLE IF NOT EXISTS rentropy_neighbourhood_snapshot ("
                    "name TEXT PRIMARY KEY, "
                    "burden_pct DOUBLE PRECISION, "
                    "shelter_median_cad DOUBLE PRECISION, "
                    "income_median_cad DOUBLE PRECISION, "
                    "subsidized_pct DOUBLE PRECISION, "
                    "census_year INTEGER NOT NULL, "
                    "loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
                )
                for record in records:
                    cur.execute(
                        """INSERT INTO rentropy_neighbourhood_snapshot
                        (name, burden_pct, shelter_median_cad, income_median_cad,
                         subsidized_pct, census_year)
                        VALUES (%s, %s, %s, %s, %s, 2021)
                        ON CONFLICT (name) DO UPDATE SET
                            burden_pct = EXCLUDED.burden_pct,
                            shelter_median_cad = EXCLUDED.shelter_median_cad,
                            income_median_cad = EXCLUDED.income_median_cad,
                            subsidized_pct = EXCLUDED.subsidized_pct,
                            loaded_at = NOW()""",
                        (
                            record.get("neighbourhood_name"),
                            record.get("tenant_cost_burden_pct"),
                            record.get("median_monthly_rent"),
                            record.get("median_household_income"),
                            record.get("subsidized_tenant_pct"),
                        ),
                    )
        return jsonify({"stored": len(records)})
    except Exception as exc:
        app.logger.exception("Database error")
        return jsonify({"error": f"TigerData save failed ({type(exc).__name__})."}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
