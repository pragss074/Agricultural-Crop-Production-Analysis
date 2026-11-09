from pathlib import Path

import pandas as pd
import streamlit as st
from database import get_connection
from analysis import prepare_data, create_reports
from validation import validate_crop_data, print_validation_report

st.set_page_config(page_title="Agricultural Crop Production Analysis", layout="wide")
st.title("🌾 Agricultural Crop Production Analysis System")
st.caption("Historical summaries from the selected dataset. Synthetic sample data is for software testing only.")

def read_database():
    connection = get_connection()
    try:
        query = """
        select cr.record_id, c.crop_name, r.region_name, cr.year,
               cr.cultivated_area, cr.production, cr.rainfall
        from crop_records cr
        join crops c on cr.crop_id = c.crop_id
        join regions r on cr.region_id = r.region_id
        order by cr.year, c.crop_name, r.region_name
        """
        return  pd.read_sql(query, connection)
    finally:
        connection.close()

source = st.sidebar.radio(
    "Choose data source",
    ["Bundled sample CSV", "Upload CSV", "MySQL database"],
)

if source in ["Bundled sample CSV", "Upload CSV"]:
    if source == "Bundled sample CSV":
        csv_path = Path(__file__).resolve().with_name("crop_production.csv")
        if not csv_path.is_file():
            st.error(f"Bundled sample CSV was not found: {csv_path}")
            st.stop()
        raw_df = pd.read_csv(csv_path)
    else:
        uploaded_file = st.sidebar.file_uploader("Upload crop production CSV", type=["csv"])
        if uploaded_file is None:
            st.info("Upload a CSV with columns: record_id, crop_name, region_name, year, cultivated_area, production, rainfall, area_unit, production_unit, rainfall_unit.")
            st.stop()
        raw_df = pd.read_csv(uploaded_file)

    try:
        checked_df, issues = validate_crop_data(raw_df)
    except ValueError as error:
        st.error(str(error))
        st.stop()
    st.subheader("Sample data preview" if source == "Bundled sample CSV" else "Uploaded data preview")
    st.dataframe(checked_df.head(20), use_container_width=True)
    st.subheader("Data quality summary")
    st.json(issues)
    # Convert uploaded data into the dashboard's expected column set.
    df = checked_df[[
        "record_id", "crop_name", "region_name", "year",
        "cultivated_area", "production", "rainfall"
    ]].copy()
else:
    try:
        df = read_database()
    except Exception as error:
        st.error(f"Could not read MySQL. Start the MySQL server, configure database.py, and run create_tables.sql and load_data.py, or select Bundled sample CSV to run without MySQL. Details: {error}")
        st.stop()

if df.empty:
    st.warning("No records found. Select Bundled sample CSV or Upload CSV, or import records into MySQL.")
    st.stop()

df = prepare_data(df)

st.sidebar.header("Filters")
crop_options = sorted(df["crop_name"].dropna().unique().tolist())
region_options = sorted(df["region_name"].dropna().unique().tolist())
year_options = sorted(df["year"].dropna().astype(int).unique().tolist())

selected_crops = st.sidebar.multiselect("Crop", crop_options, default=crop_options)
selected_regions = st.sidebar.multiselect("Region", region_options, default=region_options)
selected_years = st.sidebar.multiselect("Year", year_options, default=year_options)

filtered = df[
    df["crop_name"].isin(selected_crops)
    & df["region_name"].isin(selected_regions)
    & df["year"].isin(selected_years)
].copy()

total_production = filtered["production"].sum(min_count=1)
total_area = filtered["cultivated_area"].sum(min_count=1)
overall_yield = total_production / total_area if pd.notna(total_area) and total_area > 0 and pd.notna(total_production) else None

col1, col2, col3, col4 = st.columns(4)
col1.metric("Records", f"{len(filtered):,}")
col2.metric("Production (tonnes)", "N/A" if pd.isna(total_production) else f"{total_production:,.2f}")
col3.metric("Cultivated area (ha)", "N/A" if pd.isna(total_area) else f"{total_area:,.2f}")
col4.metric("Overall yield (t/ha)", "N/A" if overall_yield is None else f"{overall_yield:,.2f}")

st.subheader("Filtered records")
st.dataframe(filtered, use_container_width=True)

st.subheader("Crop-wise summary")
crop_summary = filtered.groupby("crop_name", dropna=False).agg(
    production_tonnes=("production", "sum"),
    cultivated_area_ha=("cultivated_area", "sum"),
    records=("record_id", "count")
).reset_index()
crop_summary["yield_t_per_ha"] = crop_summary["production_tonnes"] / crop_summary["cultivated_area_ha"].replace(0, float("nan"))
st.dataframe(crop_summary, use_container_width=True)

st.subheader("Production by year")
year_summary = filtered.groupby("year")["production"].sum(min_count=1).sort_index()
st.line_chart(year_summary)

st.subheader("Production by crop")
crop_totals = filtered.groupby("crop_name")["production"].sum(min_count=1).sort_values(ascending=False)
st.bar_chart(crop_totals)

st.subheader("Production by region")
region_totals = filtered.groupby("region_name")["production"].sum(min_count=1).sort_values(ascending=False)
st.bar_chart(region_totals)

st.subheader("Yield by crop")
yield_by_crop = (
    filtered.groupby("crop_name")["production"].sum(min_count=1)
    / filtered.groupby("crop_name")["cultivated_area"].sum(min_count=1).replace(0, float("nan"))
).dropna()
st.bar_chart(yield_by_crop)

st.subheader("Data quality")
st.write("Missing values by column:")
st.dataframe(filtered.isna().sum().rename("missing_count").to_frame())
st.caption("Comparisons describe the records shown. They do not prove that rainfall or another factor caused production changes.")

st.download_button(
    "Download filtered records as CSV",
    data=filtered.to_csv(index=False).encode("utf-8"),
    file_name="filtered_crop_records.csv",
    mime="text/csv"
)
