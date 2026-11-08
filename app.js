
const $ = id => document.getElementById(id);
const page = document.body.dataset.page;
let allRecords = [];
let currentPage = 1;
const pageSize = 10;

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            typeof data === "object"
                ? data.error || data.message || JSON.stringify(data)
                : data
        );
    }
    return data;
}

function showMessage(text, kind = "success") {
    const box = $("message");
    if (!box) return;
    box.textContent = text;
    box.className = `message ${kind}`;
}

function clearMessage() {
    if ($("message")) $("message").className = "message hidden";
}

function value(row, ...keys) {
    for (const key of keys) {
        if (row?.[key] !== undefined && row[key] !== null) {
            return row[key];
        }
    }
    return "";
}

function number(v) {
    if (v === "" || v === null || v === undefined) return "—";
    const n = Number(v);
    return Number.isFinite(n)
        ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
        : String(v);
}

const cropName = r => value(r, "crop_name", "crop");
const regionName = r => value(r, "region_name", "region");
const yearValue = r => value(r, "year");

function addCell(row, text, cls = "") {
    const td = document.createElement("td");
    td.textContent = text === "" ? "—" : String(text);
    if (cls) td.className = cls;
    row.appendChild(td);
    return td;
}

function setSelectOptions(id, values, label) {
    const select = $(id);
    if (!select) return;

    const old = select.value;
    select.replaceChildren();

    const first = document.createElement("option");
    first.value = "";
    first.textContent = label;
    select.appendChild(first);

    [...new Set(values.filter(v => v !== "" && v !== null))]
        .sort((a, b) =>
            String(a).localeCompare(String(b), undefined, { numeric: true })
        )
        .forEach(v => {
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = String(v);
            select.appendChild(option);
        });

    if ([...select.options].some(o => o.value === old)) {
        select.value = old;
    }
}

function populateFilters() {
    setSelectOptions("cropFilter", allRecords.map(cropName), "All crops");
    setSelectOptions("regionFilter", allRecords.map(regionName), "All regions");
    setSelectOptions("yearFilter", allRecords.map(yearValue), "All years");
    setSelectOptions("analyticsCrop", allRecords.map(cropName), "All crops");
    setSelectOptions("analyticsRegion", allRecords.map(regionName), "All regions");
}

function filteredRecords() {
    const crop = $("cropFilter")?.value || "";
    const region = $("regionFilter")?.value || "";
    const year = $("yearFilter")?.value || "";
    const search = ($("searchInput")?.value || "").trim().toLowerCase();

    return allRecords.filter(r =>
        (!crop || String(cropName(r)) === crop) &&
        (!region || String(regionName(r)) === region) &&
        (!year || String(yearValue(r)) === year) &&
        (!search ||
            `${cropName(r)} ${regionName(r)}`
                .toLowerCase().includes(search))
    );
}

function renderTable(rows, id, recent = false) {
    const body = $(id);
    if (!body) return;

    body.replaceChildren();

    if (!rows.length) {
        const tr = document.createElement("tr");
        addCell(tr, "No matching records found.").colSpan = recent ? 5 : 6;
        body.appendChild(tr);
        return;
    }

    rows.forEach(r => {
        const tr = document.createElement("tr");

        addCell(tr, cropName(r) || "—", "crop-cell");
        addCell(tr, regionName(r) || "—");
        addCell(tr, number(yearValue(r)));

        const area = value(r, "cultivated_area", "area");
        const areaUnit = value(r, "area_unit");
        addCell(tr, `${number(area)}${areaUnit ? " " + areaUnit : ""}`);

        const production = value(r, "production", "total_production");
        const productionUnit = value(r, "production_unit");
        addCell(
            tr,
            `${number(production)}${productionUnit ? " " + productionUnit : ""}`
        );

        if (!recent) {
            const rainfall = value(r, "rainfall");
            const rainfallUnit = value(r, "rainfall_unit");
            addCell(
                tr,
                rainfall === ""
                    ? "Not recorded"
                    : `${number(rainfall)}${rainfallUnit ? " " + rainfallUnit : ""}`
            );
        }

        body.appendChild(tr);
    });
}

function renderRecordsPage() {
    const rows = filteredRecords();
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));

    currentPage = Math.min(currentPage, pages);

    renderTable(
        rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        "recordsBody"
    );

    if ($("recordCount")) {
        $("recordCount").textContent = `${rows.length} matching records`;
    }
    if ($("pageInfo")) {
        $("pageInfo").textContent = `Page ${currentPage} of ${pages}`;
    }
    if ($("previousPage")) $("previousPage").disabled = currentPage <= 1;
    if ($("nextPage")) $("nextPage").disabled = currentPage >= pages;
}

async function loadRecords() {
    const data = await api("/records");
    allRecords = Array.isArray(data)
        ? data
        : (data.records || data.data || []);

    populateFilters();

    if (page === "dashboard") {
        $("totalRecords").textContent = number(allRecords.length);
        $("totalCrops").textContent = number(
            new Set(allRecords.map(cropName).filter(Boolean)).size
        );
        $("totalRegions").textContent = number(
            new Set(allRecords.map(regionName).filter(Boolean)).size
        );

        renderTable([...allRecords].slice(-5).reverse(), "recentRecords", true);
    }

    if (page === "records") {
        currentPage = 1;
        renderRecordsPage();
    }
}

async function loadQuality() {
    const data = await api("/analysis/data-quality");

    const get = (...keys) => value(data, ...keys);

    const total = get("total_records", "totalRecords");
    const missing = get(
        "missing_rainfall",
        "missing_rainfall_records",
        "missingRainfall"
    );
    const zero = get("zero_area", "zero_area_records", "zeroArea");
    const undefinedYield = get(
        "undefined_yield",
        "undefined_yield_records",
        "undefinedYield"
    );
    const unsupported = get(
        "unsupported_yield_units",
        "unsupported_units",
        "unsupportedYieldUnits"
    );

    if ($("totalRecords")) $("totalRecords").textContent = number(total);
    if ($("missingRainfall")) $("missingRainfall").textContent = number(missing);

    if ($("qualityTotal")) $("qualityTotal").textContent = number(total);
    if ($("qualityRainfall")) $("qualityRainfall").textContent = number(missing);
    if ($("qualityRainfallDetail")) {
        $("qualityRainfallDetail").textContent = number(missing);
    }
    if ($("qualityZeroArea")) $("qualityZeroArea").textContent = number(zero);
    if ($("qualityUndefinedYield")) {
        $("qualityUndefinedYield").textContent = number(undefinedYield);
    }
    if ($("qualityUnsupported")) {
        $("qualityUnsupported").textContent = number(unsupported);
    }
}

function loadChart(id, url) {
    const img = $(id);
    if (!img) return;

    img.onerror = () => {
        img.alt = "Chart unavailable. Check the Flask chart endpoint and analysis.py.";
    };

    img.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

async function loadAnalytics() {
    const params = new URLSearchParams();
    const crop = $("analyticsCrop")?.value || "";
    const region = $("analyticsRegion")?.value || "";

    if (crop) params.set("crop_name", crop);
    if (region) params.set("region_name", region);

    const suffix = params.toString() ? `?${params}` : "";

    // The production chart currently shows all crops.
    // The yield chart and yearly summary use the selected filters.
    loadChart("productionChart", "/charts/production");
    loadChart("yieldChart", `/charts/yield${suffix}`);

    try {
        const data = await api(`/analysis/yearly${suffix}`);
        const rows = Array.isArray(data)
            ? data
            : (data.data || data.records || []);

        const body = $("yearlySummary");
        if (!body) return;

        body.replaceChildren();

        if (!rows.length) {
            const tr = document.createElement("tr");
            addCell(tr, "No yearly summary available.").colSpan = 4;
            body.appendChild(tr);
            return;
        }

        rows.forEach(r => {
            const tr = document.createElement("tr");

            addCell(tr, number(value(r, "year")));
            addCell(tr, value(r, "production_unit") || "—");
            addCell(
                tr,
                number(value(r, "total_production", "production_sum", "production"))
            );

            const change = value(
                r,
                "percentage_change",
                "production_change_percent",
                "percent_change"
            );

            addCell(tr, change === "" ? "—" : `${number(change)}%`);
            body.appendChild(tr);
        });
    } catch (error) {
        showMessage(`Could not load yearly summary: ${error.message}`, "error");
    }
}

async function refreshCurrentPage() {
    clearMessage();

    try {
        if (["dashboard", "records", "analytics"].includes(page)) {
            await loadRecords();
        }

        if (page === "dashboard") {
            await loadQuality();
            loadChart("productionChart", "/charts/production");
        }

        if (page === "analytics") await loadAnalytics();
        if (page === "quality") await loadQuality();

    } catch (error) {
        showMessage(`Unable to load data: ${error.message}`, "error");
    }
}

// Records filters
["cropFilter", "regionFilter", "yearFilter"].forEach(id => {
    $(id)?.addEventListener("change", () => {
        currentPage = 1;
        renderRecordsPage();
    });
});

$("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    renderRecordsPage();
});

$("clearFilters")?.addEventListener("click", () => {
    ["cropFilter", "regionFilter", "yearFilter", "searchInput"].forEach(id => {
        if ($(id)) $(id).value = "";
    });

    currentPage = 1;
    renderRecordsPage();
});

$("previousPage")?.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    renderRecordsPage();
});

$("nextPage")?.addEventListener("click", () => {
    currentPage++;
    renderRecordsPage();
});

$("refreshButton")?.addEventListener("click", refreshCurrentPage);
$("applyAnalytics")?.addEventListener("click", loadAnalytics);

$("qualityButton")?.addEventListener("click", async () => {
    try {
        await loadQuality();
        showMessage("Data quality information refreshed.");
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// CSV upload
$("csvFile")?.addEventListener("change", () => {
    const file = $("csvFile").files[0];
    if ($("fileName")) {
        $("fileName").textContent = file
            ? file.name
            : "Click here to browse your files";
    }
});

$("uploadForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();

    const file = $("csvFile")?.files[0];

    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
        showMessage("Please select a valid CSV file.", "error");
        return;
    }

    const button = $("uploadButton");
    button.disabled = true;
    button.textContent = "Validating and importing...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const result = await api("/upload", {
            method: "POST",
            body: formData
        });

        if ($("uploadResult")) {
            $("uploadResult").textContent =
                `${result.message || "Upload complete"} ` +
                `Valid rows: ${result.valid_records ?? "—"}. ` +
                `Inserted rows: ${result.inserted_count ?? "—"}.`;
        }

        const issues = result.validation_issues || [];
        const box = $("validationIssues");

        if (box) {
            box.replaceChildren();

            if (issues.length) {
                const heading = document.createElement("p");
                heading.textContent = "Validation issues:";
                box.appendChild(heading);

                const list = document.createElement("ul");

                issues.forEach(issue => {
                    const item = document.createElement("li");
                    item.textContent = typeof issue === "string"
                        ? issue
                        : JSON.stringify(issue);
                    list.appendChild(item);
                });

                box.appendChild(list);
            } else {
                box.textContent = "No validation issues were reported.";
            }
        }

        showMessage(result.message || "Upload completed.");
        $("uploadForm").reset();

        if ($("fileName")) {
            $("fileName").textContent = "Click here to browse your files";
        }

    } catch (error) {
        showMessage(`Upload failed: ${error.message}`, "error");

        if ($("uploadResult")) {
            $("uploadResult").textContent = error.message;
        }
    } finally {
        button.disabled = false;
        button.textContent = "Validate and import dataset";
    }
});

refreshCurrentPage();
