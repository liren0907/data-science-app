<script lang="ts">
	import { onMount } from "svelte";
	import { invoke } from "@tauri-apps/api/core";
	import * as d3 from "d3";

	// Import components
	import CsvUploader from "./CsvUploader.svelte";
	import DataTable from "./DataTable.svelte";

	// Import stores
	import { csvDataStore, csvDataActions } from "../stores/csvDataStore.js";
	import { uiStateStore, uiStateActions } from "../stores/uiStateStore.js";
	import { fileStore } from "../stores/fileStore.js";

	export let scientificData: any;
	export let businessData: any;
	export let isActive: boolean;

	// Type definitions
	interface ColumnInfo {
		id: string;
		name: string;
		type: "number" | "string";
	}

	interface D3DataPoint {
		category?: string;
		value?: number;
		x?: number;
		y?: number;
		r?: number;
		label?: string;
		[key: string]: any; // Allow dynamic properties for flexibility with CSV data
	}

	interface D3ChartType {
		id: string;
		label: string;
		icon: string;
		description: string;
	}

	// Reactive data from stores
	$: files = $csvDataStore.files;
	$: currentFileId = $csvDataStore.currentFileId;
	$: isLoading = $uiStateStore.isLoading;
	$: hasData = files.length > 0;

	// Get file stats
	$: fileStats = $fileStore
		? {
				total: $fileStore.uploadedFiles?.size || 0,
				pending: Array.from($fileStore.processingQueue || []).length,
				processing: Array.from($fileStore.uploadedFiles || []).filter(
					([_, file]) =>
						$fileStore.processingStatus?.get(file.id)?.status ===
						"processing",
				).length,
				completed: Array.from($fileStore.uploadedFiles || []).filter(
					([_, file]) =>
						$fileStore.processingStatus?.get(file.id)?.status ===
						"completed",
				).length,
				failed: Array.from($fileStore.uploadedFiles || []).filter(
					([_, file]) =>
						$fileStore.processingStatus?.get(file.id)?.status ===
						"failed",
				).length,
			}
		: {
				total: 0,
				pending: 0,
				processing: 0,
				completed: 0,
				failed: 0,
			};

	// D3.js state
	let d3ChartType = "bar";
	let d3ChartContainer: HTMLElement;
	let d3IsVisualizing = false;

	// Visualization state for advanced features
	let selectedXColumn: string = "";
	let selectedYColumn: string = "";
	let selectedZColumn: string = ""; // For bubble charts (size)
	let showGrid: boolean = true;
	let showTooltips: boolean = true;
	let animationDuration: number = 750;

	// Reactive statement for available columns
	let availableColumns: ColumnInfo[] = [];
	$: availableColumns =
		(currentFileId && $csvDataStore.columns.get(currentFileId)) || [];

	// Reactive statement for numeric columns
	let numericColumns: ColumnInfo[] = [];
	$: numericColumns = availableColumns.filter(
		(col: ColumnInfo) => col.type === "number",
	);

	// Reactive statement for filtered data
	$: filteredData = currentFileId
		? $csvDataStore.filteredData.get(currentFileId) || []
		: [];

	// D3 Chart types
	const d3ChartTypes = [
		{
			id: "bar",
			label: "Bar Chart",
			icon: "bar_chart",
			description: "Compare categories",
		},
		{
			id: "line",
			label: "Line Chart",
			icon: "show_chart",
			description: "Show trends",
		},
		{
			id: "scatter",
			label: "Scatter Plot",
			icon: "scatter_plot",
			description: "Show relationships",
		},
		{
			id: "histogram",
			label: "Histogram",
			icon: "bar_chart_4_bars",
			description: "Show distribution",
		},
		{
			id: "bubble",
			label: "Bubble Chart",
			icon: "bubble_chart",
			description: "Show 3D relationships",
		},
		{
			id: "heatmap",
			label: "Heatmap",
			icon: "grid_on",
			description: "Show correlations",
		},
		{
			id: "boxplot",
			label: "Box Plot",
			icon: "candlestick_chart",
			description: "Show distributions",
		},
		{
			id: "area",
			label: "Area Chart",
			icon: "area_chart",
			description: "Show filled trends",
		},
		{
			id: "pie",
			label: "Pie Chart",
			icon: "pie_chart",
			description: "Show proportions",
		},
		{
			id: "donut",
			label: "Donut Chart",
			icon: "data_usage",
			description: "Show proportions with center",
		},
	];

	// Initialize when component becomes active
	$: if (isActive) {
		initializeColumns();
		if (businessData) console.log("Business data loaded for analysis");
		setTimeout(() => renderD3Chart(), 100);
	}

	// Initialize column selections when data changes
	function initializeColumns() {
		if (numericColumns.length > 0 && !selectedXColumn) {
			selectedXColumn = numericColumns[0]?.id || "";
			selectedYColumn =
				numericColumns.length > 1
					? numericColumns[1]?.id
					: numericColumns[0]?.id || "";
		}
	}

	// Handle D3 chart type change
	function handleChartTypeChange() {
		setTimeout(() => renderD3Chart(), 100);
	}

	// Handle data export using Rust backend
	async function handleDataExport(event: CustomEvent) {
		const { data, columns, filters, sorting } = event.detail;
		console.log("Exporting data:", { data, columns, filters, sorting });

		try {
			uiStateActions.setLoading(true, "Exporting data...");

			// Prepare data for Rust backend (convert to array of objects)
			const exportData = data.map((row: any) => {
				const exportRow: any = {};
				columns.forEach((col: any) => {
					exportRow[col.name] = row[col.id];
				});
				return exportRow;
			});

			// Generate filename with timestamp
			const timestamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.slice(0, 19);
			const fileName = `export_${timestamp}.csv`;

			// Use Rust backend for export
			const exportOptions = {
				delimiter: ",",
				include_headers: true,
				encoding: "UTF-8",
				quote_fields: "auto",
			};

			await invoke("export_to_csv", {
				data: exportData,
				filePath: fileName,
				options: exportOptions,
			});

			uiStateActions.setLoading(false);

			// Show success message and provide download option
			const confirmed = confirm(
				`Export completed! File saved as: ${fileName}\n\nWould you like to open the file location?`,
			);
			if (confirmed) {
				// Use Tauri's shell command to open file location
				await invoke("open_file_location", { filePath: fileName });
			}
		} catch (error: any) {
			console.error("Export failed:", error);
			uiStateActions.setLoading(false);
			alert(`Export failed: ${error.message}`);
		}
	}

	// Simple export function for the export tab
	async function handleSimpleExport() {
		try {
			uiStateActions.setLoading(true, "Preparing export...");

			// Get current file data
			if (!currentFileId) {
				alert("No file selected for export");
				return;
			}

			const currentFile = $csvDataStore.files.find(
				(f) => f.id === currentFileId,
			);
			if (!currentFile) {
				alert("Current file not found");
				return;
			}

			if (!currentFile.path || !currentFile.name) {
				alert("File path or name is missing");
				return;
			}

			// Get raw data from the file
			const rawData = await invoke("read_csv_file", {
				filePath: currentFile.path,
			});
			const parsedData = parseCSVContent(rawData.content);

			// Generate filename with timestamp
			const timestamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.slice(0, 19);
			const fileName = `export_${currentFile.name}_${timestamp}.csv`;

			// Use Rust backend for export
			const exportOptions = {
				delimiter: ",",
				include_headers: true,
				encoding: "UTF-8",
				quote_fields: "auto",
			};

			await invoke("export_to_csv", {
				data: parsedData,
				filePath: fileName,
				options: exportOptions,
			});

			uiStateActions.setLoading(false);

			// Show success message
			const confirmed = confirm(
				`Export completed! File saved as: ${fileName}\n\nWould you like to open the file location?`,
			);
			if (confirmed) {
				await invoke("open_file_location", { filePath: fileName });
			}
		} catch (error: any) {
			console.error("Export failed:", error);
			uiStateActions.setLoading(false);
			alert(`Export failed: ${error.message}`);
		}
	}

	// Helper function to parse CSV content
	function parseCSVContent(content: string) {
		const lines = content.split("\n").filter((line) => line.trim());
		if (lines.length < 2) return [];

		const headers = lines[0].split(",").map((h) => h.trim());
		const data = lines.slice(1).map((line) => {
			const values = line.split(",");
			const row: any = {};
			headers.forEach((header, index) => {
				row[header] =
					index < values.length ? values[index].trim() : null;
			});
			return row;
		});

		return data;
	}

	// Render D3 Chart
	async function renderD3Chart() {
		if (!d3ChartContainer || d3IsVisualizing) return;

		// Use actual data if available, otherwise fall back to sample data
		const dataToUse =
			filteredData.length > 0
				? filteredData
				: scientificData.categories
					? scientificData.categories.map(
							(cat: string, i: number) => ({
								category: cat,
								value: scientificData.values[i],
								x: scientificData.xValues?.[i] || i,
								y:
									scientificData.yValues?.[i] ||
									scientificData.values[i],
								r: scientificData.bubbleData?.[i]?.r || 5,
							}),
						)
					: [];

		if (dataToUse.length === 0) return;

		d3IsVisualizing = true;

		try {
			// Clear existing chart
			d3.select(d3ChartContainer).selectAll("*").remove();

			// Create SVG
			const margin = { top: 40, right: 30, bottom: 50, left: 60 };
			const width = 800 - margin.left - margin.right;
			const height = 500 - margin.top - margin.bottom;

			const svg = d3
				.select(d3ChartContainer)
				.append("svg")
				.attr("width", width + margin.left + margin.right)
				.attr("height", height + margin.top + margin.bottom)
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Render based on chart type
			switch (d3ChartType) {
				case "bar":
					renderD3BarChart(svg, dataToUse, width, height);
					break;
				case "line":
					renderD3LineChart(svg, dataToUse, width, height);
					break;
				case "scatter":
					renderD3ScatterChart(svg, dataToUse, width, height);
					break;
				case "histogram":
					renderD3Histogram(svg, dataToUse, width, height);
					break;
				case "bubble":
					renderD3BubbleChart(svg, dataToUse, width, height);
					break;
				case "heatmap":
					renderD3Heatmap(svg, dataToUse, width, height);
					break;
				case "boxplot":
					renderD3BoxPlot(svg, dataToUse, width, height);
					break;
				case "area":
					renderD3AreaChart(svg, dataToUse, width, height);
					break;
				case "pie":
					renderD3PieChart(svg, dataToUse, width, height);
					break;
				case "donut":
					renderD3DonutChart(svg, dataToUse, width, height);
					break;
				default:
					renderD3BarChart(svg, dataToUse, width, height);
			}

			// Add title
			svg.append("text")
				.attr("x", width / 2)
				.attr("y", -10)
				.attr("text-anchor", "middle")
				.attr("font-size", "16px")
				.attr("font-weight", "bold")
				.attr("fill", "#1e2937")
				.text(
					d3ChartTypes.find((c) => c.id === d3ChartType)?.label ||
						"Chart",
				);
		} catch (error) {
			console.error("Error rendering D3 chart:", error);
		} finally {
			d3IsVisualizing = false;
		}
	}

	// D3 Chart rendering functions
	function renderD3BarChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data structure
		let chartData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			// Use actual uploaded data
			const grouped = new Map();
			data.forEach((row: any) => {
				const xVal = String(row[selectedXColumn]);
				const yVal = parseFloat(row[selectedYColumn]);
				if (!isNaN(yVal)) {
					grouped.set(xVal, (grouped.get(xVal) || 0) + yVal);
				}
			});
			chartData = Array.from(grouped.entries()).map(([key, value]) => ({
				category: key,
				value: value,
			}));
		} else {
			// Use sample data
			chartData = scientificData.categories.map(
				(cat: string, i: number) => ({
					category: cat,
					value: scientificData.values[i],
				}),
			);
		}

		const x = d3
			.scaleBand<string>()
			.domain(chartData.map((d: any) => d.category))
			.range([0, width])
			.padding(0.1);

		const y = d3
			.scaleLinear<number, number>()
			.domain([0, d3.max(chartData, (d: any) => d.value) || 0])
			.nice()
			.range([height, 0]);

		// Bars with animations
		const bars = svg.selectAll(".bar").data(chartData);

		// Enter new bars
		bars.enter()
			.append("rect")
			.attr("class", "bar")
			.attr("x", (d: any) => x(d.category) || 0)
			.attr("y", height) // Start from bottom
			.attr("width", x.bandwidth())
			.attr("height", 0) // Start with zero height
			.attr("fill", "#3b82f6")
			.attr("rx", 4)
			.transition()
			.duration(animationDuration)
			.delay((d, i) => i * 50)
			.attr("y", (d: any) => y(d.value))
			.attr("height", (d: any) => height - y(d.value));

		// Update existing bars
		bars.transition()
			.duration(animationDuration)
			.attr("x", (d: any) => x(d.category) || 0)
			.attr("y", (d: any) => y(d.value))
			.attr("width", x.bandwidth())
			.attr("height", (d: any) => height - y(d.value));

		// Remove old bars
		bars.exit()
			.transition()
			.duration(animationDuration / 2)
			.attr("y", height)
			.attr("height", 0)
			.remove();

		// Add hover interactions
		svg.selectAll(".bar")
			.on(
				"mouseover",
				function (this: SVGRectElement, event: MouseEvent, d: any) {
					if (showTooltips) {
						d3.select(this).attr("fill", "#2563eb");
						showD3Tooltip(svg, `${d.category}: ${d.value}`, event);
					}
				},
			)
			.on("mouseout", function (this: SVGRectElement) {
				if (showTooltips) {
					d3.select(this).attr("fill", "#3b82f6");
					svg.select(".tooltip").remove();
				}
			});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3LineChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let chartData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			// Use actual uploaded data - sort by X column for line chart
			chartData = data
				.map((row: any) => ({
					x: parseFloat(row[selectedXColumn]) || 0,
					y: parseFloat(row[selectedYColumn]) || 0,
				}))
				.filter((d) => !isNaN(d.x) && !isNaN(d.y))
				.sort((a, b) => a.x - b.x);
		} else {
			// Use sample data
			chartData = scientificData.xValues.map((x: number, i: number) => ({
				x: x,
				y: scientificData.yValues[i],
			}));
		}

		const x = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.x) as [number, number])
			.nice()
			.range([0, width]);

		const y = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.y) as [number, number])
			.nice()
			.range([height, 0]);

		const line = d3
			.line<any>()
			.x((d) => x(d.x))
			.y((d) => y(d.y))
			.curve(d3.curveMonotoneX);

		// Animated line
		const path = svg.selectAll(".line-path").data([chartData]);

		path.enter()
			.append("path")
			.attr("class", "line-path")
			.attr("fill", "none")
			.attr("stroke", "#10b981")
			.attr("stroke-width", 3)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.attr("d", line)
			.style("opacity", 0)
			.transition()
			.duration(animationDuration)
			.style("opacity", 1);

		path.transition().duration(animationDuration).attr("d", line);

		// Animated points
		const points = svg
			.selectAll(".point")
			.data(chartData, (d: any) => `${d.x}-${d.y}`);

		points
			.enter()
			.append("circle")
			.attr("class", "point")
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", height) // Start from bottom
			.attr("r", 0) // Start with zero radius
			.attr("fill", "#10b981")
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.transition()
			.duration(animationDuration)
			.delay((d, i) => i * 100)
			.attr("cy", (d: any) => y(d.y))
			.attr("r", 6);

		points
			.transition()
			.duration(animationDuration)
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", (d: any) => y(d.y));

		points
			.exit()
			.transition()
			.duration(animationDuration / 2)
			.attr("r", 0)
			.remove();

		// Add hover interactions
		svg.selectAll(".point")
			.on(
				"mouseover",
				function (this: SVGCircleElement, event: MouseEvent, d: any) {
					if (showTooltips) {
						d3.select(this).attr("r", 8);
						showD3Tooltip(svg, `(${d.x}, ${d.y})`, event);
					}
				},
			)
			.on("mouseout", function (this: SVGCircleElement) {
				if (showTooltips) {
					d3.select(this).attr("r", 6);
					svg.select(".tooltip").remove();
				}
			});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3ScatterChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let chartData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			chartData = data
				.map((row: any) => ({
					x: parseFloat(row[selectedXColumn]) || 0,
					y: parseFloat(row[selectedYColumn]) || 0,
				}))
				.filter((d) => !isNaN(d.x) && !isNaN(d.y));
		} else {
			chartData = scientificData.xValues.map((x: number, i: number) => ({
				x: x,
				y: scientificData.yValues[i],
			}));
		}

		const x = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.x) as [number, number])
			.nice()
			.range([0, width]);

		const y = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.y) as [number, number])
			.nice()
			.range([height, 0]);

		// Animated points
		const points = svg.selectAll(".point").data(chartData);

		points
			.enter()
			.append("circle")
			.attr("class", "point")
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", height) // Start from bottom
			.attr("r", 0) // Start with zero radius
			.attr("fill", "#8b5cf6")
			.attr("opacity", 0)
			.transition()
			.duration(animationDuration)
			.delay((d, i) => i * 50)
			.attr("cy", (d: any) => y(d.y))
			.attr("r", 6)
			.attr("opacity", 0.7);

		points
			.transition()
			.duration(animationDuration)
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", (d: any) => y(d.y));

		points
			.exit()
			.transition()
			.duration(animationDuration / 2)
			.attr("r", 0)
			.attr("opacity", 0)
			.remove();

		// Add hover interactions
		svg.selectAll(".point")
			.on(
				"mouseover",
				function (this: SVGCircleElement, event: MouseEvent, d: any) {
					if (showTooltips) {
						d3.select(this).attr("r", 8).attr("opacity", 1);
						showD3Tooltip(svg, `(${d.x}, ${d.y})`, event);
					}
				},
			)
			.on("mouseout", function (this: SVGCircleElement) {
				if (showTooltips) {
					d3.select(this).attr("r", 6).attr("opacity", 0.7);
					svg.select(".tooltip").remove();
				}
			});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3Histogram(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let values;
		if (filteredData.length > 0 && selectedYColumn) {
			values = data
				.map((row: any) => parseFloat(row[selectedYColumn]))
				.filter((val) => !isNaN(val));
		} else {
			values = scientificData.values;
		}

		const x = d3
			.scaleLinear<number, number>()
			.domain([0, d3.max(values) || 100])
			.nice()
			.range([0, width]);

		const bins = d3
			.histogram<number, number>()
			.domain(x.domain() as [number, number])
			.thresholds(10)(values);

		const y = d3
			.scaleLinear<number, number>()
			.domain([
				0,
				d3.max(bins, (d: d3.Bin<number, number>) => d.length) || 0,
			])
			.nice()
			.range([height, 0]);

		// Animated bars
		const bars = svg.selectAll(".bar").data(bins);

		bars.enter()
			.append("rect")
			.attr("class", "bar")
			.attr("x", (d: d3.Bin<number, number>) => x(d.x0 || 0))
			.attr("y", height) // Start from bottom
			.attr("width", (d: d3.Bin<number, number>) =>
				Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 1),
			)
			.attr("height", 0) // Start with zero height
			.attr("fill", "#f59e0b")
			.attr("stroke", "#d97706")
			.attr("stroke-width", 1)
			.transition()
			.duration(animationDuration)
			.delay((d, i) => i * 100)
			.attr("y", (d: d3.Bin<number, number>) => y(d.length))
			.attr(
				"height",
				(d: d3.Bin<number, number>) => height - y(d.length),
			);

		bars.transition()
			.duration(animationDuration)
			.attr("x", (d: d3.Bin<number, number>) => x(d.x0 || 0))
			.attr("y", (d: d3.Bin<number, number>) => y(d.length))
			.attr("width", (d: d3.Bin<number, number>) =>
				Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 1),
			)
			.attr(
				"height",
				(d: d3.Bin<number, number>) => height - y(d.length),
			);

		bars.exit()
			.transition()
			.duration(animationDuration / 2)
			.attr("y", height)
			.attr("height", 0)
			.remove();

		// Add hover interactions
		svg.selectAll(".bar")
			.on(
				"mouseover",
				function (
					this: SVGRectElement,
					event: MouseEvent,
					d: d3.Bin<number, number>,
				) {
					if (showTooltips) {
						d3.select(this).attr("fill", "#d97706");
						showD3Tooltip(
							svg,
							`Range: ${d.x0?.toFixed(1)}-${d.x1?.toFixed(1)}, Count: ${d.length}`,
							event,
						);
					}
				},
			)
			.on("mouseout", function (this: SVGRectElement) {
				if (showTooltips) {
					d3.select(this).attr("fill", "#f59e0b");
					svg.select(".tooltip").remove();
				}
			});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3BubbleChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let chartData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			chartData = data
				.map((row: any, index: number) => ({
					x: parseFloat(row[selectedXColumn]) || 0,
					y: parseFloat(row[selectedYColumn]) || 0,
					r: selectedZColumn
						? parseFloat(row[selectedZColumn]) || 5
						: Math.sqrt(index + 1) * 2,
					category: `Item ${index + 1}`,
				}))
				.filter((d) => !isNaN(d.x) && !isNaN(d.y));
		} else {
			chartData = scientificData.bubbleData;
		}

		const x = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.x) as [number, number])
			.nice()
			.range([20, width - 20]);

		const y = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.y) as [number, number])
			.nice()
			.range([height - 20, 20]);

		const r = d3
			.scaleSqrt()
			.domain(d3.extent(chartData, (d: any) => d.r) as [number, number])
			.range([5, 20]);

		// Animated bubbles
		const bubbles = svg.selectAll(".bubble").data(chartData);

		bubbles
			.enter()
			.append("circle")
			.attr("class", "bubble")
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", height) // Start from bottom
			.attr("r", 0) // Start with zero radius
			.attr("fill", (d: any, i: number) => d3.schemeCategory10[i % 10])
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.attr("opacity", 0)
			.transition()
			.duration(animationDuration)
			.delay((d, i) => i * 100)
			.attr("cy", (d: any) => y(d.y))
			.attr("r", (d: any) => r(d.r))
			.attr("opacity", 0.7);

		bubbles
			.transition()
			.duration(animationDuration)
			.attr("cx", (d: any) => x(d.x))
			.attr("cy", (d: any) => y(d.y))
			.attr("r", (d: any) => r(d.r));

		bubbles
			.exit()
			.transition()
			.duration(animationDuration / 2)
			.attr("r", 0)
			.attr("opacity", 0)
			.remove();

		// Add hover interactions
		svg.selectAll(".bubble")
			.on(
				"mouseover",
				function (this: SVGCircleElement, event: MouseEvent, d: any) {
					if (showTooltips) {
						d3.select(this)
							.attr("stroke-width", 4)
							.attr("opacity", 1);
						showD3Tooltip(
							svg,
							`${d.category}: (${d.x}, ${d.y}, size: ${d.r})`,
							event,
						);
					}
				},
			)
			.on("mouseout", function (this: SVGCircleElement) {
				if (showTooltips) {
					d3.select(this)
						.attr("stroke-width", 2)
						.attr("opacity", 0.7);
					svg.select(".tooltip").remove();
				}
			});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height - 20})`)
			.call(d3.axisBottom(x));

		svg.append("g")
			.attr("transform", "translate(20,0)")
			.call(d3.axisLeft(y));
	}

	// Additional chart types
	function renderD3Heatmap(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Simple heatmap implementation
		const numCols = Math.min(10, numericColumns.length);
		const cols = numericColumns.slice(0, numCols);

		const heatmapData = [];
		for (let i = 0; i < cols.length; i++) {
			for (let j = 0; j < cols.length; j++) {
				if (i !== j) {
					const col1 = data
						.map((row) => parseFloat(row[cols[i].id]))
						.filter((v) => !isNaN(v));
					const col2 = data
						.map((row) => parseFloat(row[cols[j].id]))
						.filter((v) => !isNaN(v));

					if (col1.length > 0 && col2.length > 0) {
						const correlation = calculateCorrelation(col1, col2);
						heatmapData.push({
							x: cols[i].name,
							y: cols[j].name,
							value: correlation,
						});
					}
				}
			}
		}

		const xScale = d3
			.scaleBand()
			.domain(cols.map((c) => c.name))
			.range([0, width])
			.padding(0.05);

		const yScale = d3
			.scaleBand()
			.domain(cols.map((c) => c.name))
			.range([0, height])
			.padding(0.05);

		const colorScale = d3
			.scaleSequential(d3.interpolateRdYlBu)
			.domain([-1, 1]);

		svg.selectAll(".heatmap-cell")
			.data(heatmapData)
			.enter()
			.append("rect")
			.attr("class", "heatmap-cell")
			.attr("x", (d) => xScale(d.x) || 0)
			.attr("y", (d) => yScale(d.y) || 0)
			.attr("width", xScale.bandwidth())
			.attr("height", yScale.bandwidth())
			.attr("fill", (d) => colorScale(d.value))
			.attr("stroke", "white")
			.attr("stroke-width", 1)
			.on("mouseover", function (event, d) {
				if (showTooltips) {
					showD3Tooltip(
						svg,
						`${d.x} vs ${d.y}: ${d.value.toFixed(3)}`,
						event,
					);
				}
			})
			.on("mouseout", () => svg.select(".tooltip").remove());
	}

	function renderD3BoxPlot(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		if (!selectedYColumn) return;

		// Group data by categories
		const grouped = new Map();
		data.forEach((row: any) => {
			const category = selectedXColumn
				? String(row[selectedXColumn])
				: "All";
			const value = parseFloat(row[selectedYColumn]);

			if (!isNaN(value)) {
				if (!grouped.has(category)) {
					grouped.set(category, []);
				}
				grouped.get(category).push(value);
			}
		});

		const categories = Array.from(grouped.keys());
		const x = d3
			.scaleBand()
			.domain(categories)
			.range([0, width])
			.padding(0.2);

		const allValues = Array.from(grouped.values()).flat();
		const y = d3
			.scaleLinear()
			.domain(d3.extent(allValues) as [number, number])
			.nice()
			.range([height, 0]);

		categories.forEach((category, i) => {
			const values = grouped.get(category).sort((a, b) => a - b);
			if (values.length === 0) return;

			const q1 = d3.quantile(values, 0.25) || 0;
			const median = d3.quantile(values, 0.5) || 0;
			const q3 = d3.quantile(values, 0.75) || 0;
			const min = d3.min(values) || 0;
			const max = d3.max(values) || 0;

			const xCenter = (x(category) || 0) + x.bandwidth() / 2;

			// Whiskers
			svg.append("line")
				.attr("x1", xCenter)
				.attr("x2", xCenter)
				.attr("y1", y(min))
				.attr("y2", y(max))
				.attr("stroke", "#6b7280")
				.attr("stroke-width", 2);

			// Box
			svg.append("rect")
				.attr("x", (x(category) || 0) + x.bandwidth() * 0.25)
				.attr("y", y(q3))
				.attr("width", x.bandwidth() * 0.5)
				.attr("height", y(q1) - y(q3))
				.attr("fill", "#3b82f6")
				.attr("stroke", "#2563eb")
				.attr("stroke-width", 1)
				.attr("rx", 2);

			// Median line
			svg.append("line")
				.attr("x1", x(category) || 0 + x.bandwidth() * 0.25)
				.attr("x2", (x(category) || 0) + x.bandwidth() * 0.75)
				.attr("y1", y(median))
				.attr("y2", y(median))
				.attr("stroke", "#1d4ed8")
				.attr("stroke-width", 2);
		});

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3AreaChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let chartData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			chartData = data
				.map((row: any) => ({
					x: parseFloat(row[selectedXColumn]) || 0,
					y: parseFloat(row[selectedYColumn]) || 0,
				}))
				.filter((d) => !isNaN(d.x) && !isNaN(d.y))
				.sort((a, b) => a.x - b.x);
		} else {
			chartData = scientificData.xValues.map((x: number, i: number) => ({
				x: x,
				y: scientificData.yValues[i],
			}));
		}

		const x = d3
			.scaleLinear<number, number>()
			.domain(d3.extent(chartData, (d: any) => d.x) as [number, number])
			.nice()
			.range([0, width]);

		const y = d3
			.scaleLinear<number, number>()
			.domain([0, d3.max(chartData, (d: any) => d.y) || 0])
			.nice()
			.range([height, 0]);

		const area = d3
			.area<any>()
			.x((d) => x(d.x))
			.y0(height)
			.y1((d) => y(d.y));

		// Animated area
		const path = svg.selectAll(".area-path").data([chartData]);

		path.enter()
			.append("path")
			.attr("class", "area-path")
			.attr("fill", "rgba(59, 130, 246, 0.3)")
			.attr("stroke", "#3b82f6")
			.attr("stroke-width", 2)
			.attr("d", area)
			.style("opacity", 0)
			.transition()
			.duration(animationDuration)
			.style("opacity", 1);

		path.transition().duration(animationDuration).attr("d", area);

		// Add grid lines if enabled
		if (showGrid) {
			addGridLines(svg, x, y, width, height);
		}

		// Axes
		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));
	}

	function renderD3PieChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let pieData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			const grouped = new Map();
			data.forEach((row: any) => {
				const category = String(row[selectedXColumn]);
				const value = parseFloat(row[selectedYColumn]);
				if (!isNaN(value)) {
					grouped.set(category, (grouped.get(category) || 0) + value);
				}
			});
			pieData = Array.from(grouped.entries()).map(([label, value]) => ({
				label,
				value,
			}));
		} else {
			pieData = scientificData.categories.map(
				(cat: string, i: number) => ({
					label: cat,
					value: scientificData.values[i],
				}),
			);
		}

		const radius = Math.min(width, height) / 2;
		const color = d3.scaleOrdinal(d3.schemeCategory10);

		const pie = d3
			.pie<any>()
			.value((d) => d.value)
			.sort(null);

		const arc = d3.arc<any>().innerRadius(0).outerRadius(radius);

		const arcs = svg
			.selectAll(".arc")
			.data(pie(pieData))
			.enter()
			.append("g")
			.attr("class", "arc")
			.attr("transform", `translate(${width / 2}, ${height / 2})`);

		arcs.append("path")
			.attr("d", arc)
			.attr("fill", (d, i) => color(i.toString()))
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.on("mouseover", function (event, d) {
				if (showTooltips) {
					showD3Tooltip(
						svg,
						`${d.data.label}: ${d.data.value}`,
						event,
					);
				}
			})
			.on("mouseout", () => svg.select(".tooltip").remove());

		// Add labels
		arcs.append("text")
			.attr("transform", (d) => `translate(${arc.centroid(d)})`)
			.attr("text-anchor", "middle")
			.attr("font-size", "12px")
			.attr("fill", "white")
			.text((d) =>
				d.data.value >
				pieData.reduce((sum, item) => sum + item.value, 0) * 0.05
					? d.data.label
					: "",
			);
	}

	function renderD3DonutChart(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		data: any[],
		width: number,
		height: number,
	) {
		// Prepare data - use actual data if available, otherwise use sample data
		let pieData;
		if (filteredData.length > 0 && selectedXColumn && selectedYColumn) {
			const grouped = new Map();
			data.forEach((row: any) => {
				const category = String(row[selectedXColumn]);
				const value = parseFloat(row[selectedYColumn]);
				if (!isNaN(value)) {
					grouped.set(category, (grouped.get(category) || 0) + value);
				}
			});
			pieData = Array.from(grouped.entries()).map(([label, value]) => ({
				label,
				value,
			}));
		} else {
			pieData = scientificData.categories.map(
				(cat: string, i: number) => ({
					label: cat,
					value: scientificData.values[i],
				}),
			);
		}

		const radius = Math.min(width, height) / 2;
		const color = d3.scaleOrdinal(d3.schemeCategory10);

		const pie = d3
			.pie<any>()
			.value((d) => d.value)
			.sort(null);

		const arc = d3
			.arc<any>()
			.innerRadius(radius * 0.6)
			.outerRadius(radius);

		const arcs = svg
			.selectAll(".arc")
			.data(pie(pieData))
			.enter()
			.append("g")
			.attr("class", "arc")
			.attr("transform", `translate(${width / 2}, ${height / 2})`);

		arcs.append("path")
			.attr("d", arc)
			.attr("fill", (d, i) => color(i.toString()))
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.on("mouseover", function (event, d) {
				if (showTooltips) {
					showD3Tooltip(
						svg,
						`${d.data.label}: ${d.data.value}`,
						event,
					);
				}
			})
			.on("mouseout", () => svg.select(".tooltip").remove());

		// Add center text
		svg.append("text")
			.attr("text-anchor", "middle")
			.attr("dy", "0.35em")
			.attr("transform", `translate(${width / 2}, ${height / 2})`)
			.attr("font-size", "14px")
			.attr("font-weight", "bold")
			.text("Total");

		// Add labels outside
		arcs.append("text")
			.attr("transform", (d) => `translate(${arc.centroid(d)})`)
			.attr("text-anchor", "middle")
			.attr("font-size", "11px")
			.attr("fill", "#374151")
			.text((d) =>
				d.data.value >
				pieData.reduce((sum, item) => sum + item.value, 0) * 0.03
					? d.data.label
					: "",
			);
	}

	// Helper functions
	function calculateCorrelation(x: number[], y: number[]): number {
		const n = Math.min(x.length, y.length);
		if (n < 2) return 0;

		const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
		const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
		const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
		const sumXX = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
		const sumYY = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

		const numerator = n * sumXY - sumX * sumY;
		const denominator = Math.sqrt(
			(n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY),
		);

		return denominator === 0 ? 0 : numerator / denominator;
	}

	function addGridLines(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		xScale: any,
		yScale: any,
		width: number,
		height: number,
	) {
		// Add horizontal grid lines
		svg.append("g")
			.attr("class", "grid")
			.attr("opacity", 0.3)
			.call(
				d3
					.axisLeft(yScale)
					.tickSize(-width)
					.tickFormat(() => ""),
			)
			.selectAll("line")
			.attr("stroke", "#e5e7eb")
			.attr("stroke-dasharray", "2,2");

		// Add vertical grid lines
		svg.append("g")
			.attr("class", "grid")
			.attr("opacity", 0.3)
			.call(
				d3
					.axisBottom(xScale)
					.tickSize(-height)
					.tickFormat(() => ""),
			)
			.selectAll("line")
			.attr("stroke", "#e5e7eb")
			.attr("stroke-dasharray", "2,2");
	}

	function showD3Tooltip(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		text: string,
		event: MouseEvent,
	) {
		const tooltip = svg
			.append("g")
			.attr("class", "tooltip")
			.attr(
				"transform",
				`translate(${event.offsetX + 10}, ${event.offsetY - 10})`,
			);

		const rect = tooltip
			.append("rect")
			.attr("x", -5)
			.attr("y", -20)
			.attr("width", text.length * 8 + 10)
			.attr("height", 24)
			.attr("fill", "rgba(0,0,0,0.8)")
			.attr("rx", 4);

		tooltip
			.append("text")
			.attr("x", text.length * 4)
			.attr("y", -5)
			.attr("text-anchor", "middle")
			.attr("fill", "white")
			.attr("font-size", "12px")
			.text(text);
	}
</script>

<div class="h-full flex flex-col gap-6">
	<!-- Top Bar: System Status -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<div
			class="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-between"
		>
			<div class="flex items-center gap-3">
				<div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
					<span class="material-symbols-outlined text-lg">wifi</span>
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">
						Engine Status
					</p>
					<p class="text-sm font-bold text-slate-800">Connected</p>
				</div>
			</div>
		</div>

		<div
			class="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-between"
		>
			<div class="flex items-center gap-3">
				<div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
					<span class="material-symbols-outlined text-lg">folder</span
					>
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">
						Active Files
					</p>
					<p class="text-sm font-bold text-slate-800">
						{files.length}
					</p>
				</div>
			</div>
		</div>

		<div
			class="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-between"
		>
			<div class="flex items-center gap-3">
				<div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
					<span class="material-symbols-outlined text-lg">memory</span
					>
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">
						Render Load
					</p>
					<p class="text-sm font-bold text-slate-800">Optimal</p>
				</div>
			</div>
		</div>

		<div
			class="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-between"
		>
			<div class="flex items-center gap-3">
				<div class="p-2 bg-slate-50 text-slate-600 rounded-lg">
					<span class="material-symbols-outlined text-lg">info</span>
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">D3 Version</p>
					<p class="text-sm font-bold text-slate-800">v7.8.5</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content Area: Sidebar + Chart -->
	<div class="flex flex-col lg:flex-row gap-6 min-h-[600px]">
		<!-- LEFT SIDEBAR: Controls -->
		<aside class="w-full lg:w-80 flex flex-col gap-6 shrink-0">
			<!-- Configuration Card -->
			<div
				class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 h-full flex flex-col"
			>
				<div
					class="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4"
				>
					<span class="material-symbols-outlined text-indigo-500"
						>tune</span
					>
					<h3 class="font-bold text-slate-800">Configuration</h3>
				</div>

				<div
					class="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2"
				>
					<!-- Chart Selection -->
					<div class="space-y-3">
						<label
							class="text-xs font-bold text-slate-400 uppercase tracking-wider"
						>
							Visualization Type
						</label>
						<div class="grid grid-cols-2 gap-2">
							{#each d3ChartTypes as type}
								<button
									class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200
									{d3ChartType === type.id
										? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm'
										: 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200 hover:shadow-sm'}"
									on:click={() => {
										d3ChartType = type.id;
										handleChartTypeChange();
									}}
									title={type.label}
								>
									<span class="material-symbols-outlined mb-1"
										>{type.icon}</span
									>
									<span
										class="text-[10px] font-bold uppercase"
										>{type.label}</span
									>
								</button>
							{/each}
						</div>
					</div>

					<!-- Axis Controls -->
					{#if numericColumns.length > 0}
						<div class="space-y-3 pt-4 border-t border-slate-100">
							<label
								class="text-xs font-bold text-slate-400 uppercase tracking-wider"
							>
								Axis Mapping
							</label>

							<div class="space-y-3">
								<div class="form-control w-full">
									<label class="label pt-0 pb-1">
										<span
											class="label-text text-xs font-medium text-slate-500"
											>X-Axis Dimension</span
										>
									</label>
									<select
										bind:value={selectedXColumn}
										on:change={handleChartTypeChange}
										class="select select-bordered select-sm w-full bg-slate-50 focus:bg-white transition-colors"
									>
										{#each numericColumns as col}
											<option value={col.id}
												>{col.name}</option
											>
										{/each}
									</select>
								</div>

								<div class="form-control w-full">
									<label class="label pt-0 pb-1">
										<span
											class="label-text text-xs font-medium text-slate-500"
											>Y-Axis Dimension</span
										>
									</label>
									<select
										bind:value={selectedYColumn}
										on:change={handleChartTypeChange}
										class="select select-bordered select-sm w-full bg-slate-50 focus:bg-white transition-colors"
									>
										{#each numericColumns as col}
											<option value={col.id}
												>{col.name}</option
											>
										{/each}
									</select>
								</div>
							</div>
						</div>
					{/if}

					<!-- View Options -->
					<div class="space-y-3 pt-4 border-t border-slate-100">
						<label
							class="text-xs font-bold text-slate-400 uppercase tracking-wider"
						>
							View Options
						</label>
						<div class="space-y-2">
							<label
								class="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-lg transition-colors"
							>
								<input
									type="checkbox"
									bind:checked={showGrid}
									on:change={() =>
										setTimeout(renderD3Chart, 100)}
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span class="text-sm font-medium text-slate-600"
									>Show Grid Lines</span
								>
							</label>
							<label
								class="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-lg transition-colors"
							>
								<input
									type="checkbox"
									bind:checked={showTooltips}
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span class="text-sm font-medium text-slate-600"
									>Enable Tooltips</span
								>
							</label>
						</div>
					</div>
				</div>

				<!-- Export Action -->
				<div class="pt-4 mt-auto border-t border-slate-100">
					<button
						class="btn btn-outline btn-sm w-full gap-2"
						on:click={handleSimpleExport}
					>
						<span class="material-symbols-outlined text-sm"
							>download</span
						>
						Export Data
					</button>
				</div>
			</div>
		</aside>

		<!-- RIGHT MAIN: Chart Area -->
		<main class="flex-1 flex flex-col gap-6 min-w-0">
			<!-- Chart Card -->
			<div
				class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex-1 flex flex-col relative min-h-[500px]"
			>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-slate-400"
							>monitoring</span
						>
						<h3 class="font-bold text-slate-800">
							Visualization Viewport
						</h3>
					</div>
					<div
						class="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full"
					>
						<span
							class="w-2 h-2 rounded-full {d3IsVisualizing
								? 'bg-amber-400 animate-pulse'
								: 'bg-emerald-400'}"
						></span>
						<span class="text-xs font-medium text-slate-600">
							{d3IsVisualizing ? "Rendering..." : "Ready"}
						</span>
					</div>
				</div>

				<div
					class="flex-1 relative bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden"
				>
					{#if !hasData}
						<div class="text-center text-slate-400">
							<span
								class="material-symbols-outlined text-5xl mb-3 opacity-50"
								>data_object</span
							>
							<p class="text-sm font-medium">
								No Data Stream Detected
							</p>
							<p class="text-xs opacity-70 mt-1">
								Upload a CSV file to begin analysis
							</p>
						</div>
					{:else if d3IsVisualizing}
						<div class="flex flex-col items-center gap-3">
							<span class="loading loading-spinner text-primary"
							></span>
							<p
								class="text-xs font-bold text-primary uppercase tracking-widest"
							>
								Computing...
							</p>
						</div>
					{:else}
						<div
							bind:this={d3ChartContainer}
							class="w-full h-full flex items-center justify-center"
						></div>
					{/if}

					<!-- Coordinates Overlay -->
					<div
						class="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
					>
						<p
							class="text-[10px] font-mono font-medium text-slate-500"
						>
							{selectedXColumn || "X"} : {selectedYColumn || "Y"}
						</p>
					</div>
				</div>
			</div>

			<!-- Data Table Card (Collapsible or just below) -->
			<div
				class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5"
			>
				<div class="flex items-center gap-3 mb-4">
					<div
						class="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"
					>
						<span class="material-symbols-outlined text-lg"
							>table_chart</span
						>
					</div>
					<h3 class="font-bold text-slate-800">Raw Data</h3>
				</div>
				<div class="overflow-x-auto">
					<DataTable />
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	:global(.tooltip) {
		position: absolute;
		text-align: center;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 500;
		background: #1e293b;
		color: white;
		border-radius: 8px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		z-index: 50;
	}
</style>
