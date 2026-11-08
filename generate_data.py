import os
import pandas as pd
import numpy as np

# This is synthetic sample data for software testing, not real farm statistics.
np.random.seed(42)
os.makedirs("data", exist_ok=True)

crops = ["Rice", "Wheat", "Maize", "Groundnut", "Cotton", "Millet", "Pulses", "Sugarcane"]
regions = ["Tirupati", "Chittoor", "Nellore", "Kadapa", "Anantapur", "Kurnool"]
years = list(range(2015, 2025))

# Approximate synthetic yield values (tonnes/hectare), used only to generate test data.
base_yield = {
    "Rice": 4.2, "Wheat": 3.1, "Maize": 5.0, "Groundnut": 2.0,
    "Cotton": 1.8, "Millet": 1.6, "Pulses": 1.2, "Sugarcane": 65.0
}
rows = []
record_id = 1

for crop in crops:
    for region_index, region in enumerate(regions):
        for year in years:
            area = round(40 + ((record_id * 13 + region_index * 7) % 260) + np.random.uniform(0, 25), 2)
            year_factor = 1 + (year - 2015) * 0.012
            region_factor = 0.88 + region_index * 0.035
            variation = np.random.uniform(0.88, 1.12)
            estimated_yield = base_yield[crop] * year_factor * region_factor * variation
            production = round(area * estimated_yield, 2)
            rainfall = round(420 + ((record_id * 17 + region_index * 29) % 520) + np.random.uniform(0, 20), 2)

            rows.append([
                record_id, crop, region, year, area, production, rainfall,
                "hectares", "tonnes", "mm"
            ])
            record_id += 1

df = pd.DataFrame(rows, columns=[
    "record_id", "crop_name", "region_name", "year",
    "cultivated_area", "production", "rainfall",
    "area_unit", "production_unit", "rainfall_unit"
])

# Insert a small number of deliberate missing values for testing validation.
df.loc[4, "rainfall"] = np.nan
df.loc[21, "cultivated_area"] = np.nan
df.loc[77, "production"] = np.nan
df.loc[128, "rainfall"] = np.nan
df.loc[255, "cultivated_area"] = 0

df.to_csv("data/crop_production.csv", index=False)
print("Synthetic dataset created: data/crop_production.csv")
print("Rows:", len(df))
print("\nFirst five records:")
print(df.head())
print("\nMissing values:")
print(df.isna().sum())
