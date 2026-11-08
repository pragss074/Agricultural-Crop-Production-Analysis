(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const numberFormat = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2
    });
    const chartNamespace = "http://www.w3.org/2000/svg";
    let allRecords = [];
    let currentPage = 1;
    let sortKey = "year";
    let sortDirection = -1;

    function formatNumber(value) {
        return value === null || value === undefined || value === ""
            ? "—"
            : numberFormat.format(value);
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = "";
        let quoted = false;

        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];

            if (quoted) {
                if (char === '"' && text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    field += char;
                }
            } else if (char === '"' && field.length === 0) {
                quoted = true;
            } else if (char === ",") {
                row.push(field);
                field = "";
            } else if (char === "\n" || char === "\r") {
                if (char === "\r" && text[index + 1] === "\n") index += 1;
                row.push(field);
                if (row.some(cell => cell.trim() !== "")) rows.push(row);
                row = [];
                field = "";
            } else {
                field += char;
            }
        }

        if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
        row.push(field);
        if (row.some(cell => cell.trim() !== "")) rows.push(row);
        if (rows.length < 2) throw new Error("The CSV must include a header and at least one data row.");

        const headers = rows[0].map((header, index) =>
            header.trim().replace(/^\uFEFF/, "").toLowerCase() || `column_${index + 1}`
        );
        if (new Set(headers).size !== headers.length) {
            throw new Error("The CSV contains duplicate column names.");
        }

        const aliases = {
            crop: "crop_name",
            region: "region_name",
            location: "region_name",
            production_year: "year",
            area: "cultivated_area",
            production_quantity: "production",
            rainfall_mm: "rainfall"
        };
        const columns = headers.map(header => aliases[header] || header);
        const indexOf = name => columns.indexOf(name);
        const required = ["crop_name", "region_name", "year", "cultivated_area", "production"];
        const missing = required.filter(name => indexOf(name) < 0);
        if (missing.length) {
            throw new Error(`Missing required CSV columns: ${missing.join(", ")}.`);
        }

        const rawValue = (cells, name) => {
            const index = indexOf(name);
            return index < 0 ? "" : (cells[index] || "").trim();
        };
        const numericValue = (cells, name, line, requiredValue = false) => {
            const raw = rawValue(cells, name);
            if (!raw) {
                if (requiredValue) throw new Error(`Row ${line}: ${name} is required.`);
                return null;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                throw new Error(`Row ${line}: ${name} must be a number.`);
            }
            return parsed;
        };

        return rows.slice(1).map((cells, rowIndex) => {
            const line = rowIndex + 2;
            const crop = rawValue(cells, "crop_name");
            const region = rawValue(cells, "region_name");
            if (!crop || !region) {
                throw new Error(`Row ${line}: crop_name and region_name cannot be blank.`);
            }

            const year = numericValue(cells, "year", line, true);
            const area = numericValue(cells, "cultivated_area", line);
            const production = numericValue(cells, "production", line);
            const rainfall = numericValue(cells, "rainfall", line);
            if (!Number.isInteger(year) || year < 1 || year > 9999) {
                throw new Error(`Row ${line}: year must be a valid whole year.`);
            }
            if (area < 0 || production < 0 || (rainfall !== null && rainfall < 0)) {
                throw new Error(`Row ${line}: area, production, and rainfall cannot be negative.`);
            }

            const recordId = numericValue(cells, "record_id", line);
            return {
                record_id: recordId === null ? rowIndex + 1 : recordId,
                crop_name: crop,
                region_name: region,
                year,
                cultivated_area: area,
                production,
                rainfall,
                area_unit: rawValue(cells, "area_unit") || "hectares",
                production_unit: rawValue(cells, "production_unit") || "tonnes",
                rainfall_unit: rawValue(cells, "rainfall_unit") || "mm"
            };
        });
    }

    function setOptions(id, values, placeholder, descending = false) {
        const select = $(id);
        const selected = select.value;
        const options = [...new Set(values)]
            .filter(value => value !== null && value !== undefined && value !== "")
            .sort((a, b) => typeof a === "number" && typeof b === "number"
                ? (descending ? b - a : a - b)
                : String(a).localeCompare(String(b), undefined, { numeric: true }));

        select.replaceChildren(new Option(placeholder, ""));
        options.forEach(value => select.add(new Option(String(value), String(value))));
        if (options.some(value => String(value) === selected)) select.value = selected;
    }

    function populateFilters() {
        const crops = allRecords.map(record => record.crop_name);
        const regions = allRecords.map(record => record.region_name);
        const years = allRecords.map(record => record.year);
        setOptions("cropFilter", crops, "All crops");
        setOptions("regionFilter", regions, "All regions");
        setOptions("yearFrom", years, "Any year");
        setOptions("yearTo", years, "Any year");
        setOptions("analyticsCrop", crops, "All crops");
        setOptions("analyticsRegion", regions, "All regions");
        setOptions("analyticsYearFrom", years, "Any year");
        setOptions("analyticsYearTo", years, "Any year");
    }

    function createCell(row, value, className = "") {
        const cell = document.createElement("td");
        cell.textContent = value === null || value === undefined || value === ""
            ? "—"
            : String(value);
        if (className) cell.className = className;
        row.appendChild(cell);
    }

    function formatWithUnit(value, unit) {
        if (value === null || value === undefined || value === "") return "—";
        return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
    }

    function makeRecordRow(record, includeRainfall) {
        const row = document.createElement("tr");
        createCell(row, record.crop_name, "crop-name-cell");
        createCell(row, record.region_name);
        createCell(row, formatNumber(record.year));
        createCell(row, formatWithUnit(record.cultivated_area, record.area_unit));
        createCell(row, formatWithUnit(record.production, record.production_unit));
        if (includeRainfall) {
            createCell(row, formatWithUnit(record.rainfall, record.rainfall_unit));
        }
        return row;
    }

    function renderRecentRecords() {
        const recent = [...allRecords]
            .sort((a, b) => b.year - a.year || b.record_id - a.record_id)
            .slice(0, 5);
        const body = $("recentRecords");
        body.replaceChildren();

        if (!recent.length) {
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "empty-row";
            cell.textContent = "No records found.";
            return;
        }
        recent.forEach(record => body.appendChild(makeRecordRow(record, false)));
    }

    function updateDashboardStats() {
        const records = allRecords;
        $("totalRecords").textContent = formatNumber(records.length);
        $("totalCrops").textContent = formatNumber(
            new Set(records.map(record => record.crop_name)).size
        );
        $("totalRegions").textContent = formatNumber(
            new Set(records.map(record => record.region_name)).size
        );
        $("missingRainfall").textContent = formatNumber(
            records.filter(record => record.rainfall === null).length
        );
        $("qualityTotal").textContent = formatNumber(allRecords.length);
        $("qualityRainfall").textContent = formatNumber(
            allRecords.filter(record => record.rainfall === null).length
        );
        $("qualityZeroArea").textContent = formatNumber(
            allRecords.filter(record => record.cultivated_area <= 0).length
        );
        $("qualityUndefinedYield").textContent = formatNumber(
            allRecords.filter(record =>
                record.cultivated_area <= 0 || record.production === null
            ).length
        );
        $("qualityUnsupported").textContent = formatNumber(
            allRecords.filter(record =>
                !["ha", "hectare", "hectares"].includes(record.area_unit.toLowerCase()) ||
                !["tonne", "tonnes", "ton", "tons"].includes(record.production_unit.toLowerCase())
            ).length
        );
        $("qualityReviewStatus").textContent = "Ready";
        $("qualityRainfallDetail").textContent =
            `${allRecords.length ? ((allRecords.filter(record => record.rainfall === null).length / allRecords.length) * 100).toFixed(1) : "0.0"}% of records have no rainfall value`;
    }

    function selectedRecords(prefix) {
        const crop = $(prefix === "analytics" ? "analyticsCrop" : "cropFilter").value;
        const region = $(prefix === "analytics" ? "analyticsRegion" : "regionFilter").value;
        const from = Number($(prefix === "analytics" ? "analyticsYearFrom" : "yearFrom").value) || null;
        const to = Number($(prefix === "analytics" ? "analyticsYearTo" : "yearTo").value) || null;

        return allRecords.filter(record =>
            (!crop || record.crop_name === crop) &&
            (!region || record.region_name === region) &&
            (!from || record.year >= from) &&
            (!to || record.year <= to)
        );
    }

    function getFilteredRecords() {
        const search = $("searchInput").value.trim().toLocaleLowerCase();
        const crop = $("cropFilter").value;
        const region = $("regionFilter").value;
        const yearFrom = Number($("yearFrom").value) || null;
        const yearTo = Number($("yearTo").value) || null;
        const minProduction = $("minProduction").value === ""
            ? null
            : Number($("minProduction").value);
        const maxProduction = $("maxProduction").value === ""
            ? null
            : Number($("maxProduction").value);

        return allRecords.filter(record => {
            const searchable = [
                record.crop_name,
                record.region_name,
                record.year,
                record.cultivated_area,
                record.production,
                record.rainfall,
                record.area_unit,
                record.production_unit,
                record.rainfall_unit
            ].join(" ").toLocaleLowerCase();
            return (!search || searchable.includes(search)) &&
                (!crop || record.crop_name === crop) &&
                (!region || record.region_name === region) &&
                (!yearFrom || record.year >= yearFrom) &&
                (!yearTo || record.year <= yearTo) &&
                (minProduction === null ||
                    (record.production !== null && record.production >= minProduction)) &&
                (maxProduction === null ||
                    (record.production !== null && record.production <= maxProduction));
        });
    }

    function sortRecords(records) {
        const numericKeys = ["year", "cultivated_area", "production", "rainfall"];
        return [...records].sort((a, b) => {
            const left = a[sortKey];
            const right = b[sortKey];
            if (left === null || left === undefined) return right == null ? 0 : 1;
            if (right === null || right === undefined) return -1;
            const comparison = numericKeys.includes(sortKey)
                ? Number(left) - Number(right)
                : String(left).localeCompare(String(right), undefined, { numeric: true });
            return comparison * sortDirection;
        });
    }

    function renderRecords() {
        const filtered = sortRecords(getFilteredRecords());
        const requestedSize = $("pageSize").value;
        const pageSize = requestedSize === "all" ? Math.max(filtered.length, 1) : Number(requestedSize);
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        currentPage = Math.min(Math.max(currentPage, 1), totalPages);
        const body = $("recordsBody");
        body.replaceChildren();

        $("recordCount").textContent = formatNumber(filtered.length);
        $("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
        $("previousPage").disabled = currentPage <= 1;
        $("nextPage").disabled = currentPage >= totalPages;
        updateDashboardStats();

        const start = (currentPage - 1) * pageSize;
        const rows = filtered.slice(start, start + pageSize);
        if (!rows.length) {
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6;
            cell.className = "empty-row";
            cell.textContent = "No matching records. Adjust your filters and try again.";
        } else {
            rows.forEach(record => body.appendChild(makeRecordRow(record, true)));
        }

        document.querySelectorAll(".sort-button").forEach(button => {
            const active = button.dataset.sort === sortKey;
            button.setAttribute("aria-sort", active
                ? (sortDirection === 1 ? "ascending" : "descending")
                : "none");
            button.dataset.direction = active
                ? (sortDirection === 1 ? "ascending" : "descending")
                : "";
        });
    }

    function svgElement(tag, attributes = {}) {
        const element = document.createElementNS(chartNamespace, tag);
        Object.entries(attributes).forEach(([name, value]) =>
            element.setAttribute(name, String(value))
        );
        return element;
    }

    function chartMessage(container, message) {
        container.replaceChildren();
        const note = document.createElement("div");
        note.className = "chart-empty";
        note.textContent = message;
        container.appendChild(note);
    }

    function drawLineChart(containerId, entries, label) {
        const container = $(containerId);
        if (!entries.length) {
            chartMessage(container, "No production data for these filters.");
            return;
        }

        const width = 900;
        const height = 320;
        const padding = { top: 24, right: 24, bottom: 52, left: 82 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const maximum = Math.max(...entries.map(entry => entry.value), 0);
        const scaleMaximum = maximum > 0 ? maximum * 1.12 : 1;
        const points = entries.map((entry, index) => ({
            ...entry,
            x: padding.left + (entries.length === 1
                ? plotWidth / 2
                : index * plotWidth / (entries.length - 1)),
            y: padding.top + plotHeight - entry.value / scaleMaximum * plotHeight
        }));
        const svg = svgElement("svg", {
            viewBox: `0 0 ${width} ${height}`,
            role: "img",
            "aria-label": label,
            preserveAspectRatio: "xMidYMid meet"
        });

        for (let tick = 0; tick <= 4; tick += 1) {
            const y = padding.top + plotHeight * tick / 4;
            const value = scaleMaximum * (4 - tick) / 4;
            const grid = svgElement("line", {
                x1: padding.left, y1: y, x2: width - padding.right, y2: y,
                class: "chart-grid-line"
            });
            svg.appendChild(grid);
            const tickLabel = svgElement("text", {
                x: padding.left - 10, y: y + 4, "text-anchor": "end",
                class: "chart-axis-label"
            });
            tickLabel.textContent = formatNumber(value);
            svg.appendChild(tickLabel);
        }

        const line = svgElement("polyline", {
            points: points.map(point => `${point.x},${point.y}`).join(" "),
            class: "chart-line"
        });
        svg.appendChild(line);

        points.forEach(point => {
            const circle = svgElement("circle", {
                cx: point.x, cy: point.y, r: 5, class: "chart-point"
            });
            const title = svgElement("title");
            title.textContent = `${point.label}: ${formatNumber(point.value)} tonnes`;
            circle.appendChild(title);
            svg.appendChild(circle);
            const xLabel = svgElement("text", {
                x: point.x, y: height - 19, "text-anchor": "middle",
                class: "chart-axis-label"
            });
            xLabel.textContent = point.label;
            svg.appendChild(xLabel);
        });

        const axisLabel = svgElement("text", {
            x: 18, y: height / 2, transform: `rotate(-90 18 ${height / 2})`,
            "text-anchor": "middle", class: "chart-axis-title"
        });
        axisLabel.textContent = "Production (tonnes)";
        svg.appendChild(axisLabel);
        container.replaceChildren(svg);
    }

    function drawBarChart(containerId, entries, label, unit) {
        const container = $(containerId);
        if (!entries.length) {
            chartMessage(container, "No data for these filters.");
            return;
        }

        const sorted = [...entries].sort((a, b) => b.value - a.value);
        const width = 900;
        const height = 320;
        const padding = { top: 24, right: 24, bottom: 76, left: 82 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const maximum = Math.max(...sorted.map(entry => entry.value), 0);
        const scaleMaximum = maximum > 0 ? maximum * 1.12 : 1;
        const slotWidth = plotWidth / sorted.length;
        const barWidth = Math.min(54, slotWidth * 0.62);
        const svg = svgElement("svg", {
            viewBox: `0 0 ${width} ${height}`,
            role: "img",
            "aria-label": label,
            preserveAspectRatio: "xMidYMid meet"
        });

        for (let tick = 0; tick <= 4; tick += 1) {
            const y = padding.top + plotHeight * tick / 4;
            const value = scaleMaximum * (4 - tick) / 4;
            svg.appendChild(svgElement("line", {
                x1: padding.left, y1: y, x2: width - padding.right, y2: y,
                class: "chart-grid-line"
            }));
            const tickLabel = svgElement("text", {
                x: padding.left - 10, y: y + 4, "text-anchor": "end",
                class: "chart-axis-label"
            });
            tickLabel.textContent = formatNumber(value);
            svg.appendChild(tickLabel);
        }

        sorted.forEach((entry, index) => {
            const barHeight = entry.value / scaleMaximum * plotHeight;
            const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = padding.top + plotHeight - barHeight;
            const bar = svgElement("rect", {
                x, y, width: barWidth, height: Math.max(barHeight, 1),
                rx: 5, class: "chart-bar"
            });
            const title = svgElement("title");
            title.textContent = `${entry.label}: ${formatNumber(entry.value)} ${unit}`;
            bar.appendChild(title);
            svg.appendChild(bar);

            const xLabel = svgElement("text", {
                x: x + barWidth / 2, y: height - 42, "text-anchor": "middle",
                class: "chart-axis-label"
            });
            xLabel.textContent = entry.label.length > 12
                ? `${entry.label.slice(0, 11)}…`
                : entry.label;
            svg.appendChild(xLabel);
        });

        const axisLabel = svgElement("text", {
            x: 18, y: height / 2, transform: `rotate(-90 18 ${height / 2})`,
            "text-anchor": "middle", class: "chart-axis-title"
        });
        axisLabel.textContent = unit;
        svg.appendChild(axisLabel);
        container.replaceChildren(svg);
    }

    function aggregate(records, key, valueKey) {
        const groups = new Map();
        records.forEach(record => {
            const value = record[valueKey];
            if (value === null || value === undefined) return;
            const label = String(record[key]);
            groups.set(label, (groups.get(label) || 0) + value);
        });
        return [...groups.entries()].map(([label, value]) => ({ label, value }));
    }

    function renderDashboardChart() {
        drawLineChart(
            "dashboardProductionChart",
            aggregate(allRecords, "year", "production")
                .sort((a, b) => Number(a.label) - Number(b.label)),
            "Recorded crop production by year"
        );
    }

    function renderAnalytics() {
        const records = selectedRecords("analytics");
        const productionByYear = aggregate(records, "year", "production")
            .sort((a, b) => Number(a.label) - Number(b.label));
        const productionByCrop = aggregate(records, "crop_name", "production");
        const yieldByCrop = [...new Set(records.map(record => record.crop_name))]
            .map(crop => {
                const cropRecords = records.filter(record => record.crop_name === crop);
                const area = cropRecords.reduce((sum, record) => sum + record.cultivated_area, 0);
                const production = cropRecords.reduce((sum, record) => sum + record.production, 0);
                return { label: crop, value: area > 0 ? production / area : 0 };
            })
            .filter(entry => entry.value > 0);

        drawLineChart("analyticsProductionChart", productionByYear, "Production trend for selected filters");
        drawBarChart(
            "analyticsYieldChart",
            yieldByCrop,
            "Average production yield by crop",
            "Yield (tonnes/hectare)"
        );
        renderYearlySummary(productionByYear, records);
        $("analyticsRecordCount").textContent = formatNumber(records.length);
        $("analyticsProductionTotal").textContent = formatNumber(
            records.reduce((sum, record) => sum + record.production, 0)
        );
    }

    function renderYearlySummary(productionByYear, records) {
        const body = $("yearlySummary");
        body.replaceChildren();
        if (!productionByYear.length) {
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "empty-row";
            cell.textContent = "No yearly summary data for these filters.";
            return;
        }

        productionByYear.forEach(entry => {
            const yearRecords = records.filter(record => String(record.year) === entry.label);
            const area = yearRecords.reduce((sum, record) => sum + record.cultivated_area, 0);
            const row = body.insertRow();
            [
                entry.label,
                $("analyticsCrop").value || "All crops",
                $("analyticsRegion").value || "All regions",
                formatNumber(entry.value),
                formatNumber(area)
            ].forEach(value => createCell(row, value));
        });
    }

    function refreshAllViews() {
        populateFilters();
        renderRecentRecords();
        updateDashboardStats();
        renderRecords();
        renderDashboardChart();
        renderAnalytics();
    }

    async function loadSampleData() {
        $("connectionStatus").textContent = "Loading sample data…";
        try {
            const url = new URL("./crop_production.csv", window.location.href);
            url.searchParams.set("refresh", String(Date.now()));
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Could not load crop_production.csv (HTTP ${response.status}).`);
            }
            allRecords = parseCsv(await response.text());
            refreshAllViews();
            $("connectionStatus").textContent = "Sample data ready";
            $("connectionStatus").parentElement.classList.remove("status-error");
            $("qualityReviewStatus").textContent = "Ready";
        } catch (error) {
            $("connectionStatus").textContent = "Data unavailable";
            $("connectionStatus").parentElement.classList.add("status-error");
            $("recentRecords").replaceChildren();
            $("recordsBody").replaceChildren();
            const recentRow = $("recentRecords").insertRow();
            const recentCell = recentRow.insertCell();
            recentCell.colSpan = 5;
            recentCell.className = "empty-row";
            recentCell.textContent = `Could not load the sample CSV: ${error.message}`;
            const recordsRow = $("recordsBody").insertRow();
            const recordsCell = recordsRow.insertCell();
            recordsCell.colSpan = 6;
            recordsCell.className = "empty-row";
            recordsCell.textContent = error.message;
            console.error("Could not load crop data:", error);
        }
    }

    function csvCell(value) {
        const text = value === null || value === undefined ? "" : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function exportFilteredRecords() {
        const records = sortRecords(getFilteredRecords());
        const columns = [
            "record_id", "crop_name", "region_name", "year",
            "cultivated_area", "production", "rainfall",
            "area_unit", "production_unit", "rainfall_unit"
        ];
        const csv = [
            columns.join(","),
            ...records.map(record => columns.map(column => csvCell(record[column])).join(","))
        ].join("\r\n");
        const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "filtered_crop_records.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    }

    function clearUploadMessage() {
        const message = $("uploadResult");
        message.className = "message";
        message.textContent = "";
    }

    function showUploadMessage(kind, text) {
        const message = $("uploadResult");
        message.className = `message ${kind}`;
        message.textContent = text;
    }

    function showPage(pageName) {
        document.querySelectorAll(".page").forEach(section =>
            section.classList.toggle("active", section.id === `page-${pageName}`)
        );
        document.querySelectorAll(".nav-link").forEach(link =>
            link.classList.toggle("active", link.dataset.page === pageName)
        );
        const headings = {
            dashboard: "Dashboard",
            records: "Crop Records",
            analytics: "Analytics",
            upload: "Dataset Upload",
            quality: "Data Quality"
        };
        $("pageHeading").textContent = headings[pageName] || "Dashboard";
        $("sidebar").classList.remove("open");
        if (pageName === "records") renderRecords();
        if (pageName === "analytics") renderAnalytics();
    }

    document.querySelectorAll(".nav-link").forEach(link =>
        link.addEventListener("click", () => showPage(link.dataset.page))
    );
    document.querySelectorAll("[data-go]").forEach(button =>
        button.addEventListener("click", () => showPage(button.dataset.go))
    );
    $("mobileMenu").addEventListener("click", () =>
        $("sidebar").classList.toggle("open")
    );

    ["searchInput", "cropFilter", "regionFilter", "yearFrom", "yearTo",
        "minProduction", "maxProduction"].forEach(id => {
        $(id).addEventListener(id === "searchInput" || id.startsWith("min") || id.startsWith("max")
            ? "input"
            : "change", () => {
            currentPage = 1;
            renderRecords();
        });
    });

    document.querySelectorAll(".sort-button").forEach(button => {
        button.addEventListener("click", () => {
            if (sortKey === button.dataset.sort) {
                sortDirection *= -1;
            } else {
                sortKey = button.dataset.sort;
                sortDirection = ["year", "cultivated_area", "production", "rainfall"].includes(sortKey)
                    ? -1
                    : 1;
            }
            renderRecords();
        });
    });

    $("previousPage").addEventListener("click", () => {
        currentPage -= 1;
        renderRecords();
    });
    $("nextPage").addEventListener("click", () => {
        currentPage += 1;
        renderRecords();
    });
    $("pageSize").addEventListener("change", () => {
        currentPage = 1;
        renderRecords();
    });
    $("clearFilters").addEventListener("click", () => {
        ["searchInput", "cropFilter", "regionFilter", "yearFrom", "yearTo",
            "minProduction", "maxProduction"].forEach(id => {
            $(id).value = "";
        });
        currentPage = 1;
        renderRecords();
    });
    $("refreshRecords").addEventListener("click", loadSampleData);
    $("exportRecords").addEventListener("click", exportFilteredRecords);
    $("applyAnalytics").addEventListener("click", renderAnalytics);
    ["analyticsCrop", "analyticsRegion", "analyticsYearFrom", "analyticsYearTo"]
        .forEach(id => $(id).addEventListener("change", renderAnalytics));
    $("qualityButton").addEventListener("click", () => {
        updateDashboardStats();
        $("qualityReviewStatus").textContent = "Updated";
    });

    $("csvFile").addEventListener("change", () => {
        const file = $("csvFile").files[0];
        $("fileName").textContent = file
            ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
            : "No file selected";
        clearUploadMessage();
    });

    $("uploadForm").addEventListener("submit", async event => {
        event.preventDefault();
        const file = $("csvFile").files[0];
        if (!file) {
            showUploadMessage("error", "Choose a CSV file first.");
            return;
        }
        if (!file.name.toLowerCase().endsWith(".csv")) {
            showUploadMessage("error", "Choose a file with a .csv extension.");
            return;
        }
        $("uploadButton").disabled = true;
        $("uploadButton").textContent = "Reading CSV…";
        try {
            const records = parseCsv(await file.text());
            allRecords = records;
            refreshAllViews();
            $("connectionStatus").textContent = "Uploaded dataset ready";
            $("connectionStatus").parentElement.classList.remove("status-error");
            showUploadMessage(
                "success",
                `Loaded ${formatNumber(records.length)} records from ${file.name}. This dataset is active in this browser session; the bundled sample will return when the page is reloaded.`
            );
        } catch (error) {
            showUploadMessage("error", error.message);
        } finally {
            $("uploadButton").disabled = false;
            $("uploadButton").innerHTML = '<i class="bi bi-cloud-arrow-up"></i> Load Dataset';
        }
    });

    $("analyticsRecordCount").textContent = "—";
    $("analyticsProductionTotal").textContent = "—";
    loadSampleData();
})();
