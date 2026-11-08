import pandas as pd

REQUIRED_COLUMNS = [
    "record_id", "crop_name", "region_name", "year",
    "cultivated_area", "production", "rainfall",
    "area_unit", "production_unit", "rainfall_unit"
]

EXPECTED_UNITS = {
    "area_unit": "hectares",
    "production_unit": "tonnes",
    "rainfall_unit": "mm"
}


def validate_crop_data(data):
    """Return a copy of the data and a dictionary of data-quality findings."""
    df = data.copy()
    issues = {}

    missing_columns = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    for column in ["record_id", "year", "cultivated_area", "production", "rainfall"]:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    for column in ["crop_name", "region_name", "area_unit", "production_unit", "rainfall_unit"]:
        df[column] = df[column].astype("string").str.strip()
        df.loc[df[column] == "", column] = pd.NA

    issues["missing_values_by_column"] = df[REQUIRED_COLUMNS].isna().sum().to_dict()
    issues["duplicate_record_ids"] = int(df["record_id"].duplicated(keep=False).sum())
    issues["missing_crop_or_region_rows"] = int(
        (df["crop_name"].isna() | df["region_name"].isna()).sum()
    )
    issues["invalid_year_rows"] = int(
        df["year"].isna().sum()
        + ((df["year"].notna()) & ((df["year"] < 1900) | (df["year"] > 2100))).sum()
    )
    issues["negative_area_rows"] = int((df["cultivated_area"] < 0).sum())
    issues["zero_area_rows"] = int((df["cultivated_area"] == 0).sum())
    issues["negative_production_rows"] = int((df["production"] < 0).sum())
    issues["negative_rainfall_rows"] = int((df["rainfall"] < 0).sum())

    unit_problems = {}
    for column, expected in EXPECTED_UNITS.items():
        unit_problems[column] = int(
            (df[column].notna() & (df[column].str.lower() != expected.lower())).sum()
        )
    issues["unit_mismatch_rows_by_column"] = unit_problems

    return df, issues


def print_validation_report(issues):
    print("\n===== DATA QUALITY REPORT =====")
    for name, value in issues.items():
        print(f"{name}: {value}")


if __name__ == "__main__":
    data = pd.read_csv("data/crop_production.csv")
    cleaned, report = validate_crop_data(data)
    print_validation_report(report)
