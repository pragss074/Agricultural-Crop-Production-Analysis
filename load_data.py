import pandas as pd
from database import get_connection
from validation import validate_crop_data, print_validation_report

CSV_PATH = "data/crop_production.csv"


def load_data():
    df = pd.read_csv(CSV_PATH)
    df, issues = validate_crop_data(df)
    print_validation_report(issues)

    # Keep only records with a valid unique ID, crop, region, and year.
    # Missing area/production/rainfall may be retained as SQL NULL and reported.
    df = df.dropna(subset=["record_id", "crop_name", "region_name", "year"])
    df = df.drop_duplicates(subset=["record_id"], keep="first")
    df = df[(df["year"] >= 1900) & (df["year"] <= 2100)]
    df = df[(df["cultivated_area"].isna()) | (df["cultivated_area"] >= 0)]
    df = df[(df["production"].isna()) | (df["production"] >= 0)]
    df = df[(df["rainfall"].isna()) | (df["rainfall"] >= 0)]

    # This starter loader replaces existing sample data. Do not use it on
    # a database containing records you need to keep.
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("delete from crop_records")
        cursor.execute("delete from crops")
        cursor.execute("delete from regions")

        crop_names = sorted(df["crop_name"].dropna().unique().tolist())
        region_names = sorted(df["region_name"].dropna().unique().tolist())

        crop_map = {name: i for i, name in enumerate(crop_names, start=1)}
        region_map = {name: i for i, name in enumerate(region_names, start=1)}

        for name, crop_id in crop_map.items():
            cursor.execute(
                "insert into crops (crop_id, crop_name) values (%s, %s)",
                (crop_id, name)
            )

        for name, region_id in region_map.items():
            cursor.execute(
                "insert into regions (region_id, region_name) values (%s, %s)",
                (region_id, name)
            )

        for _, row in df.iterrows():
            area = None if pd.isna(row["cultivated_area"]) else float(row["cultivated_area"])
            production = None if pd.isna(row["production"]) else float(row["production"])
            rainfall = None if pd.isna(row["rainfall"]) else float(row["rainfall"])

            cursor.execute(
                """
                insert into crop_records
                (record_id, crop_id, region_id, year,
                 cultivated_area, production, rainfall)
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    int(row["record_id"]),
                    crop_map[row["crop_name"]],
                    region_map[row["region_name"]],
                    int(row["year"]),
                    area,
                    production,
                    rainfall
                )
            )

        connection.commit()
        print(f"Imported {len(df)} crop records successfully.")

    except Exception as error:
        connection.rollback()
        print("Import failed:", error)
        raise

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    load_data()
