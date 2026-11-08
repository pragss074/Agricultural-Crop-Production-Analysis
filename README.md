# Agricultural Crop Production Analysis System

Analyze crop production trends, compare yields, and visualize patterns across regions and years.

Beginner-friendly Python + MySQL + Pandas + NumPy + Matplotlib + Streamlit project.

Live Dashboard : https://gilded-wisp-328889.netlify.app

## Units
- cultivated_area: hectares
- production: tonnes
- rainfall: millimetres (mm)
- calculated yield: tonnes per hectare

The included dataset is synthetic and is only for testing the software. It is not real historical agricultural data.

## Quick start (without MySQL)
1. Install Python.
2. In a terminal, open this project folder and run: `python -m pip install -r requirements.txt`
3. Run: `python -m streamlit run app.py`
4. The dashboard opens with the bundled sample CSV selected. You can also choose **Upload CSV**.

## Static AgriAnalytics website
Serve this project folder with VS Code Live Server and open its `index.html` page. The site reads `crop_production.csv` directly in your browser and does not need Flask or MySQL. Crop records can be searched, filtered, sorted, paginated, and exported; the Analytics and Data Quality pages update from the active dataset. CSV uploads stay in the current browser session and are not sent to a server.

## Optional MySQL setup
1. Install and start MySQL Server.
2. Open `create_tables.sql` in MySQL Workbench and execute it.
3. In `database.py`, set the MySQL password. Better: set an environment variable named `MYSQL_PASSWORD`.
4. Run `python generate_data.py`
5. Run `python validation.py`
6. Run `python load_data.py`
7. Run `python analysis.py`
8. Run `python -m streamlit run app.py` and choose **MySQL database** in the dashboard.

## Useful SQL commands
```sql
use agricultural_crop_db;
show tables;
select count(*) from crop_records;

select c.crop_name, sum(cr.production) as total_production_tonnes
from crop_records cr
join crops c on cr.crop_id = c.crop_id
group by c.crop_name
order by total_production_tonnes desc;

select r.region_name, sum(cr.production) as total_production_tonnes
from crop_records cr
join regions r on cr.region_id = r.region_id
group by r.region_name
order by total_production_tonnes desc;

select year, sum(production) as total_production_tonnes
from crop_records
group by year
order by year;

select c.crop_name, r.region_name, cr.year,
       cr.cultivated_area, cr.production,
       case
           when cr.cultivated_area > 0 and cr.production is not null
           then cr.production / cr.cultivated_area
           else null
       end as yield_tonnes_per_hectare
from crop_records cr
join crops c on cr.crop_id = c.crop_id
join regions r on cr.region_id = r.region_id
order by cr.year, c.crop_name, r.region_name;
```

## Important notes
- The loader clears existing rows before importing the included sample data. Do not run it against a database containing data you want to preserve.
- Zero or missing cultivated area results in unavailable yield.
- Review missing and invalid data before interpreting the summaries.
- Comparisons describe associations and historical patterns, not causation.
