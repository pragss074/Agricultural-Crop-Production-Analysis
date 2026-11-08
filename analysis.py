import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

os.makedirs("reports", exist_ok=True)


def prepare_data(df):
    df = df.copy()
    for col in ["year", "cultivated_area", "production", "rainfall"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Yield is only meaningful when area and production are present and area > 0.
    valid_yield = (
        df["cultivated_area"].notna()
        & df["production"].notna()
        & (df["cultivated_area"] > 0)
        & (df["production"] >= 0)
    )
    df["yield_tonnes_per_hectare"] = np.nan
    df.loc[valid_yield, "yield_tonnes_per_hectare"] = (
        df.loc[valid_yield, "production"]
        / df.loc[valid_yield, "cultivated_area"]
    )
    return df


def create_reports(df, output_folder="reports"):
    os.makedirs(output_folder, exist_ok=True)
    df = prepare_data(df)

    # Report tables
    crop_report = df.groupby("crop_name", dropna=False).agg(
        total_production_tonnes=("production", "sum"),
        total_area_hectares=("cultivated_area", "sum"),
        record_count=("record_id", "count")
    ).reset_index()
    crop_report["overall_yield_t_per_ha"] = (
        crop_report["total_production_tonnes"] / crop_report["total_area_hectares"].replace(0, np.nan)
    )
    crop_report.to_csv(os.path.join(output_folder, "crop_wise_report.csv"), index=False)

    region_report = df.groupby("region_name", dropna=False).agg(
        total_production_tonnes=("production", "sum"),
        total_area_hectares=("cultivated_area", "sum"),
        record_count=("record_id", "count")
    ).reset_index()
    region_report["overall_yield_t_per_ha"] = (
        region_report["total_production_tonnes"] / region_report["total_area_hectares"].replace(0, np.nan)
    )
    region_report.to_csv(os.path.join(output_folder, "region_wise_report.csv"), index=False)

    yearly_report = df.groupby("year", dropna=False).agg(
        total_production_tonnes=("production", "sum"),
        total_area_hectares=("cultivated_area", "sum"),
        mean_rainfall_mm=("rainfall", "mean"),
        record_count=("record_id", "count")
    ).reset_index().sort_values("year")
    yearly_report["production_change_percent"] = (
        yearly_report["total_production_tonnes"].pct_change(fill_method=None) * 100
    )
    # A percent change from zero or a missing prior value is not meaningful.
    previous = yearly_report["total_production_tonnes"].shift(1)
    invalid_previous = previous.isna() | (previous == 0)
    yearly_report.loc[invalid_previous, "production_change_percent"] = np.nan
    yearly_report.to_csv(os.path.join(output_folder, "yearly_report.csv"), index=False)

    # Chart 1: production by crop
    crop_totals = df.groupby("crop_name")["production"].sum(min_count=1).sort_values(ascending=False)
    plt.figure(figsize=(10, 5))
    crop_totals.plot(kind="bar", title="Total Recorded Production by Crop")
    plt.xlabel("Crop")
    plt.ylabel("Production (tonnes)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_folder, "crop_production.png"))
    plt.close()

    # Chart 2: production by region
    region_totals = df.groupby("region_name")["production"].sum(min_count=1).sort_values(ascending=False)
    plt.figure(figsize=(10, 5))
    region_totals.plot(kind="bar", title="Total Recorded Production by Region")
    plt.xlabel("Region")
    plt.ylabel("Production (tonnes)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_folder, "region_production.png"))
    plt.close()

    # Chart 3: yearly production trend
    yearly_totals = df.groupby("year")["production"].sum(min_count=1).sort_index()
    plt.figure(figsize=(10, 5))
    yearly_totals.plot(kind="line", marker="o", title="Recorded Production Trend by Year")
    plt.xlabel("Year")
    plt.ylabel("Production (tonnes)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_folder, "yearly_production.png"))
    plt.close()

    # Chart 4: overall yield by crop = total production / total cultivated area
    crop_yield = (
        df.groupby("crop_name")["production"].sum(min_count=1)
        / df.groupby("crop_name")["cultivated_area"].sum(min_count=1).replace(0, np.nan)
    ).dropna()
    plt.figure(figsize=(10, 5))
    crop_yield.sort_values(ascending=False).plot(kind="bar", title="Overall Yield by Crop")
    plt.xlabel("Crop")
    plt.ylabel("Yield (tonnes/hectare)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_folder, "crop_yield.png"))
    plt.close()

    return crop_report, region_report, yearly_report


if __name__ == "__main__":
    df = pd.read_csv("data/crop_production.csv")
    crop_report, region_report, yearly_report = create_reports(df)
    print("\nCROP-WISE REPORT")
    print(crop_report.to_string(index=False))
    print("\nREGION-WISE REPORT")
    print(region_report.to_string(index=False))
    print("\nYEARLY REPORT")
    print(yearly_report.to_string(index=False))
    print("\nReports and charts saved in the reports folder.")
