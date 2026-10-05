#!/usr/bin/env python3
"""Regenerates the SAMPLE/DEMO drug_directory seed asset.

Usage: python3 generate-sample-seed.py android/app/src/main/assets/custom/drug_directory_seed.db
(and separately add the same file as a flat iOS bundle resource — see the
placement note in src/db/seedImport.ts for why these paths differ.)

The 8 rows below are well-known drugs with widely published, textbook-level
interaction facts, used only to exercise the search and conflict-sentinel
code paths end to end (see src/db/seedImport.ts). This is NOT a real drug
index. Requires Python's sqlite3 module to be built with FTS5 support
(standard on most distros; the Android-SDK-bundled sqlite3 CLI is not).
"""
import json
import sqlite3
import sys

out_path = sys.argv[1]

con = sqlite3.connect(out_path)
con.execute("""
CREATE VIRTUAL TABLE drug_directory USING fts5(
  brand_name,
  generic_name,
  strength,
  dosage_form,
  manufacturer,
  indications,
  food_instructions,
  high_risk_interactions_json UNINDEXED,
  tokenize = 'unicode61'
);
""")

# SAMPLE / DEMO rows only — a handful of well-known drugs with widely
# published, textbook-level interaction facts, used purely to exercise the
# search + conflict-sentinel code paths end to end. NOT a real drug index;
# see src/db/seed-data/README.md.
rows = [
    (
        "Naprosyn", "Naproxen", "500mg", "tablet", "Generic Pharma",
        "Pain relief, inflammation, arthritis",
        "Take with food to reduce stomach irritation.",
        json.dumps([
            {"generic": "Warfarin", "severity": "severe", "description": "Increased risk of major bleeding (NSAID + anticoagulant)."},
            {"generic": "Aspirin", "severity": "moderate", "description": "Additive GI bleeding and ulcer risk."},
        ]),
    ),
    (
        "Coumadin", "Warfarin", "5mg", "tablet", "Generic Pharma",
        "Prevention of blood clots",
        "Maintain consistent vitamin K intake.",
        json.dumps([
            {"generic": "Aspirin", "severity": "severe", "description": "Significantly increased bleeding risk."},
            {"generic": "Naproxen", "severity": "severe", "description": "Increased risk of major GI bleeding."},
        ]),
    ),
    (
        "Bayer Aspirin", "Aspirin", "81mg", "tablet", "Generic Pharma",
        "Pain relief, cardioprotective",
        "May be taken with or without food.",
        json.dumps([
            {"generic": "Warfarin", "severity": "severe", "description": "Significantly increased bleeding risk."},
        ]),
    ),
    (
        "Zocor", "Simvastatin", "20mg", "tablet", "Generic Pharma",
        "High cholesterol",
        "Avoid grapefruit juice.",
        json.dumps([
            {"generic": "Clarithromycin", "severity": "contraindicated", "description": "Markedly increased simvastatin levels, risk of rhabdomyolysis."},
        ]),
    ),
    (
        "Biaxin", "Clarithromycin", "500mg", "tablet", "Generic Pharma",
        "Bacterial infections",
        "May be taken with or without food.",
        json.dumps([
            {"generic": "Simvastatin", "severity": "contraindicated", "description": "Markedly increased simvastatin levels, risk of rhabdomyolysis."},
        ]),
    ),
    (
        "Glucophage", "Metformin", "500mg", "tablet", "Generic Pharma",
        "Type 2 diabetes",
        "Take with meals to reduce GI upset.",
        json.dumps([]),
    ),
    (
        "Prinivil", "Lisinopril", "10mg", "tablet", "Generic Pharma",
        "High blood pressure, heart failure",
        "Take at the same time each day.",
        json.dumps([
            {"generic": "Potassium chloride", "severity": "moderate", "description": "Risk of hyperkalemia with potassium supplements."},
        ]),
    ),
    (
        "Amoxil", "Amoxicillin", "500mg", "capsule", "Generic Pharma",
        "Bacterial infections",
        "May be taken with or without food.",
        json.dumps([]),
    ),
]

con.executemany(
    """INSERT INTO drug_directory
       (brand_name, generic_name, strength, dosage_form, manufacturer, indications, food_instructions, high_risk_interactions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
    rows,
)
con.commit()
con.close()
print(f"Wrote {len(rows)} sample rows to {out_path}")
