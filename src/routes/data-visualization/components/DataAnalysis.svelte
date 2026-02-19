<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import * as d3 from "d3";

  import { csvDataStore, csvDataActions } from "../stores/csvDataStore.js";
  import { uiStateActions } from "../stores/uiStateStore.js";

  // Reactive data from stores
  $: currentFileId = $csvDataStore.currentFileId;
  $: fileStats = currentFileId
    ? $csvDataStore.fileStats.get(currentFileId)
    : null;
  $: filteredData = currentFileId
    ? $csvDataStore.filteredData.get(currentFileId) || []
    : [];

  // Visualization state
  let selectedChartType: string = "bar";
  let selectedXColumn: string = "";
  let selectedYColumn: string = "";
  let selectedZColumn: string = ""; // For bubble charts (size)
  let chartContainer: HTMLElement;
  let isVisualizing: boolean = false;

  // Advanced visualization state
  let selectedChartCategory: string = "all";
  let showGrid: boolean = true;
  let showLegend: boolean = true;
  let showTooltips: boolean = true;
  let enableZoom: boolean = true;
  let enablePan: boolean = true;
  let enableBrush: boolean = false;
  let chartTheme: string = "default";
  let colorScheme: string = "blue";
  let showStatisticalOverlays: boolean = false;
  let animationDuration: number = 750;

  // Chart customization state
  let xAxisLabel: string = "";
  let yAxisLabel: string = "";
  let chartWidth: number = 800;
  let chartHeight: number = 500;
  let chartMargin: number = 60;

  // Advanced filtering state
  let rangeFilterColumn: string = "";
  let rangeFilterMin: number | null = null;
  let rangeFilterMax: number | null = null;
  let categoryFilterColumn: string = "";
  let categoryFilterValue: string = "";
  let advancedFilters: any[] = [];

  // Chart dimensions - reactive to customization
  $: width = chartWidth;
  $: height = chartHeight;
  $: margin = {
    top: chartMargin,
    right: chartMargin * 0.67,
    bottom: chartMargin,
    left: chartMargin * 1.33,
  };

  // Interactive state
  let isZoomed: boolean = false;
  let zoomTransform: any = null;
  let brushSelection: any = null;
  let hoveredDataPoint: any = null;
  let selectedDataPoints: Set<string> = new Set();

  // Animation and transition state
  let transitionInProgress: boolean = false;
  let lastUpdateTime: number = Date.now();

  // Type definitions
  interface DataRow {
    [key: string]: any;
  }

  interface ChartDataPoint {
    x: any;
    y: any;
    x1?: any;
  }

  interface ColumnInfo {
    id: string;
    name: string;
    type: "number" | "string";
  }

  // Reactive statement for available columns
  let availableColumns: ColumnInfo[] = [];
  $: availableColumns =
    (currentFileId && $csvDataStore.columns.get(currentFileId)) || [];

  // Reactive statement for numeric columns
  let numericColumns: ColumnInfo[] = [];
  $: numericColumns = availableColumns.filter(
    (col: ColumnInfo) => col.type === "number",
  );

  // Reactive statement for filtered chart types
  $: filteredChartTypes =
    selectedChartCategory === "all"
      ? chartTypes
      : chartTypes.filter((chart) => chart.category === selectedChartCategory);

  // Reactive statement for string columns (for categorical data)
  let stringColumns: ColumnInfo[] = [];
  $: stringColumns = availableColumns.filter(
    (col: ColumnInfo) => col.type === "string",
  );

  // Reactive statement for all non-null columns
  let validColumns: ColumnInfo[] = [];
  $: validColumns = availableColumns.filter((col: ColumnInfo) =>
    filteredData.some(
      (row: DataRow) =>
        row[col.id] !== null && row[col.id] !== undefined && row[col.id] !== "",
    ),
  );

  // Initialize selections when data loads
  $: if (availableColumns.length > 0 && !selectedXColumn && !selectedYColumn) {
    if (numericColumns.length >= 2) {
      selectedXColumn = numericColumns[0].id;
      selectedYColumn = numericColumns[1].id;
    } else if (numericColumns.length >= 1) {
      selectedYColumn = numericColumns[0].id;
      selectedXColumn = "index";
    }
  }

  // Update chart when data or selections change
  $: if (
    currentFileId &&
    selectedXColumn &&
    selectedYColumn &&
    filteredData.length > 0 &&
    chartContainer
  ) {
    updateChart();
  }

  // Chart types - expanded with advanced options
  const chartTypes = [
    {
      id: "bar",
      label: "Bar Chart",
      icon: "📊",
      description: "Compare categories",
      category: "comparison",
    },
    {
      id: "line",
      label: "Line Chart",
      icon: "📈",
      description: "Show trends over time",
      category: "trend",
    },
    {
      id: "area",
      label: "Area Chart",
      icon: "📊",
      description: "Show cumulative trends",
      category: "trend",
    },
    {
      id: "scatter",
      label: "Scatter Plot",
      icon: "📉",
      description: "Show relationships",
      category: "correlation",
    },
    {
      id: "pie",
      label: "Pie Chart",
      icon: "🥧",
      description: "Show proportions",
      category: "distribution",
    },
    {
      id: "donut",
      label: "Donut Chart",
      icon: "🍩",
      description: "Show proportions with center",
      category: "distribution",
    },
    {
      id: "histogram",
      label: "Histogram",
      icon: "📊",
      description: "Show frequency distribution",
      category: "distribution",
    },
    {
      id: "boxplot",
      label: "Box Plot",
      icon: "📦",
      description: "Show statistical distribution",
      category: "statistics",
    },
    {
      id: "heatmap",
      label: "Heatmap",
      icon: "🔥",
      description: "Show correlations matrix",
      category: "correlation",
    },
    {
      id: "bubble",
      label: "Bubble Chart",
      icon: "🫧",
      description: "Show 3D relationships",
      category: "correlation",
    },
  ];

  // Chart categories for organization
  const chartCategories = [
    { id: "all", label: "All Charts", count: chartTypes.length },
    {
      id: "comparison",
      label: "Comparison",
      count: chartTypes.filter((c) => c.category === "comparison").length,
    },
    {
      id: "trend",
      label: "Trends",
      count: chartTypes.filter((c) => c.category === "trend").length,
    },
    {
      id: "correlation",
      label: "Correlation",
      count: chartTypes.filter((c) => c.category === "correlation").length,
    },
    {
      id: "distribution",
      label: "Distribution",
      count: chartTypes.filter((c) => c.category === "distribution").length,
    },
    {
      id: "statistics",
      label: "Statistics",
      count: chartTypes.filter((c) => c.category === "statistics").length,
    },
  ];

  // Resize handler
  function handleResize() {
    if (chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      chartWidth = Math.max(600, rect.width - 40);
      chartHeight = Math.max(400, chartWidth * 0.6);
      if (currentFileId && selectedXColumn && selectedYColumn) {
        updateChart();
      }
    }
  }

  function handleChartTypeChange() {
    updateChart();
  }

  onMount(() => {
    // Set initial dimensions
    handleResize();

    // Add resize listener
    window.addEventListener("resize", handleResize);

    // Initial chart render
    if (
      currentFileId &&
      selectedXColumn &&
      selectedYColumn &&
      filteredData.length > 0
    ) {
      setTimeout(() => updateChart(), 100);
    }
  });

  onDestroy(() => {
    window.removeEventListener("resize", handleResize);
  });

  // Event handlers
  function handleXColumnChange() {
    if (selectedXColumn === selectedYColumn && selectedXColumn !== "index") {
      selectedYColumn =
        numericColumns.find((c: ColumnInfo) => c.id !== selectedXColumn)?.id ||
        selectedYColumn;
    }
  }

  function handleYColumnChange() {
    if (selectedYColumn === selectedXColumn && selectedYColumn !== "index") {
      selectedXColumn = "index";
    }
  }

  // Update chart function
  async function updateChart() {
    if (
      !chartContainer ||
      !currentFileId ||
      !selectedXColumn ||
      !selectedYColumn ||
      filteredData.length === 0
    ) {
      return;
    }

    isVisualizing = true;

    try {
      // Clear existing chart
      d3.select(chartContainer).selectAll("*").remove();

      // Create SVG
      const svg = d3
        .select(chartContainer)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      // Create main group
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Add zoom behavior for interactive charts
      let zoomBehavior: any = null;
      if (enableZoom || enablePan) {
        zoomBehavior = d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 10])
          .translateExtent([
            [-innerWidth * 0.5, -innerHeight * 0.5],
            [innerWidth * 1.5, innerHeight * 1.5],
          ])
          .on("zoom", function (event) {
            g.attr(
              "transform",
              `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`,
            );
          });

        svg.call(zoomBehavior);

        // Add zoom controls
        if (enableZoom) {
          const zoomControls = svg
            .append("g")
            .attr("class", "zoom-controls")
            .attr("transform", `translate(${width - 60}, 20)`);

          // Zoom in button
          zoomControls
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 25)
            .attr("height", 25)
            .attr("fill", "rgba(255, 255, 255, 0.9)")
            .attr("stroke", "#d1d5db")
            .attr("rx", 4)
            .style("cursor", "pointer")
            .on("click", function () {
              svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
            });

          zoomControls
            .append("text")
            .attr("x", 12.5)
            .attr("y", 17)
            .attr("text-anchor", "middle")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .style("cursor", "pointer")
            .style("pointer-events", "none")
            .text("+");

          // Zoom out button
          zoomControls
            .append("rect")
            .attr("x", 0)
            .attr("y", 30)
            .attr("width", 25)
            .attr("height", 25)
            .attr("fill", "rgba(255, 255, 255, 0.9)")
            .attr("stroke", "#d1d5db")
            .attr("rx", 4)
            .style("cursor", "pointer")
            .on("click", function () {
              svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
            });

          zoomControls
            .append("text")
            .attr("x", 12.5)
            .attr("y", 47)
            .attr("text-anchor", "middle")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .style("cursor", "pointer")
            .style("pointer-events", "none")
            .text("−");

          // Reset zoom button
          zoomControls
            .append("rect")
            .attr("x", 0)
            .attr("y", 60)
            .attr("width", 25)
            .attr("height", 25)
            .attr("fill", "rgba(255, 255, 255, 0.9)")
            .attr("stroke", "#d1d5db")
            .attr("rx", 4)
            .style("cursor", "pointer")
            .on("click", function () {
              svg
                .transition()
                .duration(300)
                .call(
                  zoomBehavior.transform,
                  d3.zoomIdentity.translate(margin.left, margin.top),
                );
            });

          zoomControls
            .append("text")
            .attr("x", 12.5)
            .attr("y", 77)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .style("cursor", "pointer")
            .style("pointer-events", "none")
            .text("⭯");
        }
      }

      // Add brush behavior for selection
      let brushBehavior: any = null;
      if (enableBrush) {
        brushBehavior = d3
          .brush<SVGGElement>()
          .extent([
            [0, 0],
            [innerWidth, innerHeight],
          ])
          .on("end", function (event) {
            if (!event.selection) return;

            const [[x0, y0], [x1, y1]] = event.selection;
            // Handle brush selection logic here
            console.log("Brush selection:", { x0, y0, x1, y1 });
          });

        g.append("g").attr("class", "brush").call(brushBehavior);
      }

      // Prepare data based on chart type
      let chartData;
      let xScale, yScale;

      switch (selectedChartType) {
        case "bar":
          chartData = prepareBarData();
          ({ xScale, yScale } = createBarScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderBarChart(g, chartData, xScale, yScale, innerWidth, innerHeight);
          break;

        case "line":
          chartData = prepareLineData();
          ({ xScale, yScale } = createLineScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderLineChart(
            g,
            chartData,
            xScale,
            yScale,
            innerWidth,
            innerHeight,
          );
          break;

        case "area":
          chartData = prepareAreaData();
          ({ xScale, yScale } = createAreaScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderAreaChart(
            g,
            chartData,
            xScale,
            yScale,
            innerWidth,
            innerHeight,
          );
          break;

        case "scatter":
          chartData = prepareScatterData();
          ({ xScale, yScale } = createScatterScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderScatterChart(
            g,
            chartData,
            xScale,
            yScale,
            innerWidth,
            innerHeight,
          );
          break;

        case "pie":
          chartData = preparePieData();
          renderPieChart(g, chartData, innerWidth, innerHeight);
          break;

        case "donut":
          chartData = preparePieData();
          renderDonutChart(g, chartData, innerWidth, innerHeight);
          break;

        case "histogram":
          chartData = prepareHistogramData();
          ({ xScale, yScale } = createHistogramScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderHistogram(
            g,
            chartData,
            xScale,
            yScale,
            innerWidth,
            innerHeight,
          );
          break;

        case "boxplot":
          chartData = prepareBoxPlotData();
          ({ xScale, yScale } = createBoxPlotScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderBoxPlot(g, chartData, xScale, yScale, innerWidth, innerHeight);
          break;

        case "heatmap":
          chartData = prepareHeatmapData();
          renderHeatmap(g, chartData, innerWidth, innerHeight);
          break;

        case "bubble":
          chartData = prepareBubbleData();
          ({ xScale, yScale } = createBubbleScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderBubbleChart(
            g,
            chartData,
            xScale,
            yScale,
            innerWidth,
            innerHeight,
          );
          break;

        default:
          // Fallback to bar chart
          chartData = prepareBarData();
          ({ xScale, yScale } = createBarScales(
            chartData,
            innerWidth,
            innerHeight,
          ));
          renderBarChart(g, chartData, xScale, yScale, innerWidth, innerHeight);
          break;
      }

      // Add grid lines if enabled
      if (
        showGrid &&
        selectedChartType !== "pie" &&
        selectedChartType !== "donut"
      ) {
        addGridLines(g, xScale, yScale, innerWidth, innerHeight);
      }

      // Add axes with animations
      addAxes(svg, g, xScale, yScale, innerWidth, innerHeight);

      // Add statistical overlays if enabled
      if (
        showStatisticalOverlays &&
        (selectedChartType === "line" || selectedChartType === "scatter")
      ) {
        addStatisticalOverlays(
          g,
          chartData,
          xScale,
          yScale,
          innerWidth,
          innerHeight,
        );
      }

      // Add legend if enabled
      if (showLegend) {
        addLegend(svg, chartData, innerWidth, innerHeight);
      }

      // Add title
      addTitle(svg, selectedChartType, selectedXColumn, selectedYColumn);
    } catch (error) {
      console.error("Chart rendering error:", error);
    } finally {
      isVisualizing = false;
    }
  }

  // Data preparation functions
  function prepareBarData(): ChartDataPoint[] {
    const counts: { [key: string]: number } = {};
    filteredData.forEach((row: DataRow) => {
      const key = row[selectedXColumn];
      if (key !== null && key !== undefined && key !== "") {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 20)
      .map(([key, value]: [string, number]) => ({ x: key, y: value }));
  }

  function prepareLineData(): ChartDataPoint[] {
    if (selectedXColumn === "index") {
      return filteredData
        .map((row: DataRow, index: number) => ({
          x: index,
          y: parseFloat(row[selectedYColumn]) || 0,
        }))
        .filter((d: ChartDataPoint) => !isNaN(d.y));
    } else {
      return filteredData
        .map((row: DataRow) => ({
          x: parseFloat(row[selectedXColumn]) || 0,
          y: parseFloat(row[selectedYColumn]) || 0,
        }))
        .filter((d: ChartDataPoint) => !isNaN(d.x) && !isNaN(d.y));
    }
  }

  function prepareScatterData(): ChartDataPoint[] {
    return filteredData
      .map((row: DataRow) => ({
        x: parseFloat(row[selectedXColumn]) || 0,
        y: parseFloat(row[selectedYColumn]) || 0,
      }))
      .filter((d: ChartDataPoint) => !isNaN(d.x) && !isNaN(d.y));
  }

  function prepareAreaData(): ChartDataPoint[] {
    return prepareLineData().sort((a, b) => (a.x as number) - (b.x as number));
  }

  function preparePieData(): any[] {
    const counts: { [key: string]: number } = {};
    filteredData.forEach((row: DataRow) => {
      const key = row[selectedXColumn];
      if (key !== null && key !== undefined && key !== "") {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 10) // Limit to top 10 for readability
      .map(([key, value]: [string, number]) => ({
        label: key,
        value: value,
        percentage: 0, // Will be calculated later
      }));
  }

  function prepareHistogramData(): ChartDataPoint[] {
    const values = filteredData
      .map((row: DataRow) => parseFloat(row[selectedYColumn]))
      .filter((val) => !isNaN(val) && val !== null && val !== undefined);

    if (values.length === 0) return [];

    const bins = d3
      .histogram()
      .domain(d3.extent(values) as [number, number])
      .thresholds(20)(values);

    return bins.map((bin) => ({
      x: bin.x0 || 0,
      y: bin.length,
      x1: bin.x1 || 0,
    }));
  }

  function prepareBoxPlotData(): any[] {
    const categories = [
      ...new Set(
        filteredData
          .map((row) => row[selectedXColumn])
          .filter((x) => x !== null && x !== undefined),
      ),
    ];

    return categories
      .map((category) => {
        const values = filteredData
          .filter((row) => row[selectedXColumn] === category)
          .map((row) => parseFloat(row[selectedYColumn]))
          .filter((val) => !isNaN(val) && val !== null && val !== undefined)
          .sort((a, b) => a - b);

        if (values.length === 0) return null;

        const q1 = d3.quantile(values, 0.25) || 0;
        const median = d3.quantile(values, 0.5) || 0;
        const q3 = d3.quantile(values, 0.75) || 0;
        const min = d3.min(values) || 0;
        const max = d3.max(values) || 0;

        return {
          category,
          min,
          q1,
          median,
          q3,
          max,
          outliers: values.filter(
            (v) => v < min - 1.5 * (q3 - q1) || v > max + 1.5 * (q3 - q1),
          ),
        };
      })
      .filter((d) => d !== null);
  }

  function prepareHeatmapData(): any[] {
    const numericCols = numericColumns.slice(0, 10); // Limit to 10 columns for performance
    const heatmapData: any[] = [];

    numericCols.forEach((col1, i) => {
      numericCols.forEach((col2, j) => {
        if (i !== j) {
          const values1 = filteredData
            .map((row) => parseFloat(row[col1.id]))
            .filter((v) => !isNaN(v));
          const values2 = filteredData
            .map((row) => parseFloat(row[col2.id]))
            .filter((v) => !isNaN(v));

          if (values1.length > 0 && values2.length > 0) {
            // Calculate correlation coefficient
            const correlation = calculateCorrelation(values1, values2);
            heatmapData.push({
              x: col1.name,
              y: col2.name,
              value: correlation,
            });
          }
        }
      });
    });

    return heatmapData;
  }

  function prepareBubbleData(): ChartDataPoint[] {
    return filteredData
      .map((row: DataRow, index: number) => ({
        x: parseFloat(row[selectedXColumn]) || 0,
        y: parseFloat(row[selectedYColumn]) || 0,
        r: selectedZColumn ? parseFloat(row[selectedZColumn]) || 5 : 5,
        id: index,
      }))
      .filter((d: ChartDataPoint) => !isNaN(d.x) && !isNaN(d.y));
  }

  // Helper function to calculate correlation
  function calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Scale creation functions
  function createBarScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleBand<string>()
      .domain(data.map((d: ChartDataPoint) => String(d.x)))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3
      .scaleLinear<number, number>()
      .domain([0, d3.max(data, (d: ChartDataPoint) => d.y as number) || 0])
      .nice()
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function createLineScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.x as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.y as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function createScatterScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.x as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.y as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function createAreaScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    return createLineScales(data, innerWidth, innerHeight);
  }

  function createHistogramScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleLinear<number, number>()
      .domain([
        d3.min(data, (d) => d.x) || 0,
        d3.max(data, (d) => (d as any).x1) || 0,
      ])
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear<number, number>()
      .domain([0, d3.max(data, (d: ChartDataPoint) => d.y as number) || 0])
      .nice()
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function createBoxPlotScales(
    data: any[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.category))
      .range([0, innerWidth])
      .padding(0.2);

    const allValues = data.flatMap((d) => [d.min, d.max, ...d.outliers]);
    const yScale = d3
      .scaleLinear<number, number>()
      .domain(d3.extent(allValues) as [number, number])
      .nice()
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function createBubbleScales(
    data: ChartDataPoint[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const xScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.x as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([20, innerWidth - 20]); // Add padding for bubbles

    const yScale = d3
      .scaleLinear<number, number>()
      .domain(
        d3.extent(data, (d: ChartDataPoint) => d.y as number) as [
          number,
          number,
        ],
      )
      .nice()
      .range([innerHeight - 20, 20]); // Add padding for bubbles

    return { xScale, yScale };
  }

  // Chart rendering functions
  function renderBarChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    // Create bars with animations
    const bars = g.selectAll(".bar").data(data, (d: ChartDataPoint) => d.x);

    // Enter new bars
    bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d: ChartDataPoint) => xScale(String(d.x)) || 0)
      .attr("y", innerHeight) // Start from bottom
      .attr("width", xScale.bandwidth())
      .attr("height", 0) // Start with zero height
      .attr("fill", getColorScheme(0))
      .attr("rx", 4)
      .style("opacity", 0)
      .transition()
      .duration(animationDuration)
      .delay((d, i) => i * 50) // Stagger animation
      .attr("y", (d: ChartDataPoint) => yScale(d.y as number))
      .attr(
        "height",
        (d: ChartDataPoint) => innerHeight - yScale(d.y as number),
      )
      .style("opacity", 0.8);

    // Update existing bars
    bars
      .transition()
      .duration(animationDuration)
      .attr("x", (d: ChartDataPoint) => xScale(String(d.x)) || 0)
      .attr("y", (d: ChartDataPoint) => yScale(d.y as number))
      .attr("width", xScale.bandwidth())
      .attr(
        "height",
        (d: ChartDataPoint) => innerHeight - yScale(d.y as number),
      )
      .attr("fill", (d, i) => getColorScheme(i));

    // Remove old bars
    bars
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .attr("y", innerHeight)
      .attr("height", 0)
      .style("opacity", 0)
      .remove();

    // Add hover interactions
    g.selectAll(".bar")
      .on(
        "mouseover",
        function (this: SVGRectElement, event: MouseEvent, d: ChartDataPoint) {
          if (!showTooltips) return;

          d3.select(this)
            .transition()
            .duration(200)
            .style("opacity", 1)
            .attr("fill", "#2563eb");

          addTooltip(g, d, event);
        },
      )
      .on("mouseout", function (this: SVGRectElement) {
        if (!showTooltips) return;

        d3.select(this)
          .transition()
          .duration(200)
          .style("opacity", 0.8)
          .attr("fill", (d, i) => getColorScheme(i));

        g.select(".tooltip").remove();
      });
  }

  function renderAreaChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    const area = d3
      .area<ChartDataPoint>()
      .x((d) => xScale(d.x as number))
      .y0(innerHeight)
      .y1((d) => yScale(d.y as number));

    g.append("path")
      .datum(data)
      .attr("fill", "rgba(59, 130, 246, 0.3)")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", area);

    // Add data points on top of area
    g.selectAll(".area-point")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "area-point")
      .attr("cx", (d) => xScale(d.x as number))
      .attr("cy", (d) => yScale(d.y as number))
      .attr("r", 3)
      .attr("fill", "#3b82f6")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("r", 5);
        addTooltip(g, d, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 3);
        g.select(".tooltip").remove();
      });
  }

  function renderPieChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const pie = d3
      .pie<any>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3.arc<any>().innerRadius(0).outerRadius(radius);

    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "arc")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight / 2})`);

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 4);
        addTooltip(g, { x: d.data.label, y: d.data.value }, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 2);
        g.select(".tooltip").remove();
      });

    // Add labels
    arcs
      .append("text")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "white")
      .text((d) =>
        d.data.percentage > 5
          ? `${d.data.label}: ${d.data.percentage.toFixed(1)}%`
          : "",
      );
  }

  function renderDonutChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const pie = d3
      .pie<any>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<any>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "arc")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight / 2})`);

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 4);
        addTooltip(g, { x: d.data.label, y: d.data.value }, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 2);
        g.select(".tooltip").remove();
      });

    // Add center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight / 2})`)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Total");

    // Add labels outside
    arcs
      .append("text")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#374151")
      .text((d) =>
        d.data.percentage > 3
          ? `${d.data.label}: ${d.data.percentage.toFixed(1)}%`
          : "",
      );
  }

  function renderHistogram(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.x as number))
      .attr("y", (d) => yScale(d.y as number))
      .attr("width", (d) =>
        Math.max(0, xScale((d as any).x1) - xScale(d.x as number) - 1),
      )
      .attr("height", (d) => innerHeight - yScale(d.y as number))
      .attr("fill", "#10b981")
      .attr("stroke", "#059669")
      .attr("stroke-width", 1)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#059669");
        addTooltip(g, { x: `${d.x}-${(d as any).x1}`, y: d.y }, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#10b981");
        g.select(".tooltip").remove();
      });
  }

  function renderBoxPlot(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any[],
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    const boxWidth = xScale.bandwidth();

    data.forEach((d) => {
      const x = xScale(d.category)!;
      const xCenter = x + boxWidth / 2;

      // Whiskers
      g.append("line")
        .attr("x1", xCenter)
        .attr("x2", xCenter)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#6b7280")
        .attr("stroke-width", 2);

      // Box
      g.append("rect")
        .attr("x", x + boxWidth * 0.25)
        .attr("y", yScale(d.q3))
        .attr("width", boxWidth * 0.5)
        .attr("height", yScale(d.q1) - yScale(d.q3))
        .attr("fill", "#3b82f6")
        .attr("stroke", "#2563eb")
        .attr("stroke-width", 1)
        .attr("rx", 2);

      // Median line
      g.append("line")
        .attr("x1", x + boxWidth * 0.25)
        .attr("x2", x + boxWidth * 0.75)
        .attr("y1", yScale(d.median))
        .attr("y2", yScale(d.median))
        .attr("stroke", "#1d4ed8")
        .attr("stroke-width", 2);

      // Whisker caps
      g.append("line")
        .attr("x1", x + boxWidth * 0.2)
        .attr("x2", x + boxWidth * 0.8)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.min))
        .attr("stroke", "#6b7280")
        .attr("stroke-width", 2);

      g.append("line")
        .attr("x1", x + boxWidth * 0.2)
        .attr("x2", x + boxWidth * 0.8)
        .attr("y1", yScale(d.max))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#6b7280")
        .attr("stroke-width", 2);

      // Outliers
      g.selectAll(`.outlier-${d.category}`)
        .data(d.outliers)
        .enter()
        .append("circle")
        .attr("class", `outlier-${d.category}`)
        .attr("cx", xCenter)
        .attr("cy", (d) => yScale(d))
        .attr("r", 3)
        .attr("fill", "#ef4444")
        .attr("stroke", "#dc2626");
    });
  }

  function renderHeatmap(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const uniqueX = [...new Set(data.map((d) => d.x))];
    const uniqueY = [...new Set(data.map((d) => d.y))];

    const xScale = d3
      .scaleBand()
      .domain(uniqueX)
      .range([0, innerWidth])
      .padding(0.05);

    const yScale = d3
      .scaleBand()
      .domain(uniqueY)
      .range([0, innerHeight])
      .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([-1, 1]);

    g.selectAll(".heatmap-cell")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "heatmap-cell")
      .attr("x", (d) => xScale(d.x))
      .attr("y", (d) => yScale(d.y))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => colorScale(d.value))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 3);
        addTooltip(g, { x: `${d.x} vs ${d.y}`, y: d.value.toFixed(3) }, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 1);
        g.select(".tooltip").remove();
      });

    // Add correlation labels for strong correlations
    g.selectAll(".correlation-label")
      .data(data.filter((d) => Math.abs(d.value) > 0.7))
      .enter()
      .append("text")
      .attr("class", "correlation-label")
      .attr("x", (d) => xScale(d.x)! + xScale.bandwidth() / 2)
      .attr("y", (d) => yScale(d.y)! + yScale.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .text((d) => d.value.toFixed(2));
  }

  function renderBubbleChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    const maxRadius = 20;
    const minRadius = 3;

    // Scale for bubble sizes
    const rScale = d3
      .scaleSqrt()
      .domain(d3.extent(data, (d) => (d as any).r) as [number, number])
      .range([minRadius, maxRadius]);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    g.selectAll(".bubble")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(d.x as number))
      .attr("cy", (d) => yScale(d.y as number))
      .attr("r", (d) => rScale((d as any).r || 5))
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", 0.7)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 4).attr("opacity", 1);
        addTooltip(g, { x: d.x, y: d.y, r: (d as any).r }, event);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 2).attr("opacity", 0.7);
        g.select(".tooltip").remove();
      });
  }

  function addTooltip(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    d: any,
    event: MouseEvent,
  ) {
    const tooltip = g
      .append("g")
      .attr("class", "tooltip")
      .attr(
        "transform",
        `translate(${event.offsetX + 10}, ${event.offsetY - 10})`,
      );

    const tooltipRect = tooltip
      .append("rect")
      .attr("x", -5)
      .attr("y", -25)
      .attr("width", 100)
      .attr("height", 20)
      .attr("fill", "rgba(0,0,0,0.8)")
      .attr("rx", 4);

    tooltip
      .append("text")
      .attr("x", 45)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(`${d.x}: ${d.y}`);
  }

  function addGridLines(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: any,
    yScale: any,
    innerWidth: number,
    innerHeight: number,
  ) {
    // Add horizontal grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.3)
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .selectAll("line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2");

    // Add vertical grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.3)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => ""),
      )
      .selectAll("line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2");
  }

  function addStatisticalOverlays(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: any,
    yScale: any,
    innerWidth: number,
    innerHeight: number,
  ) {
    if (!data || data.length === 0) return;

    const values = data.map((d) => d.y as number).filter((v) => !isNaN(v));

    if (values.length === 0) return;

    // Calculate trend line
    const trendData = calculateTrendLine(data);
    if (trendData.length > 1) {
      const line = d3
        .line<ChartDataPoint>()
        .x((d) => xScale(d.x as number))
        .y((d) => yScale(d.y as number));

      g.append("path")
        .datum(trendData)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("d", line);
    }

    // Add mean line
    const mean = d3.mean(values) || 0;
    g.append("line")
      .attr("class", "mean-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(mean))
      .attr("y2", yScale(mean))
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3");

    // Add mean label
    g.append("text")
      .attr("class", "mean-label")
      .attr("x", innerWidth - 50)
      .attr("y", yScale(mean) - 5)
      .attr("font-size", "12px")
      .attr("fill", "#f59e0b")
      .text(`Mean: ${mean.toFixed(2)}`);
  }

  function calculateTrendLine(data: ChartDataPoint[]): ChartDataPoint[] {
    const validData = data.filter(
      (d) => !isNaN(d.x as number) && !isNaN(d.y as number),
    );
    if (validData.length < 2) return [];

    const n = validData.length;
    const sumX = validData.reduce((sum, d) => sum + (d.x as number), 0);
    const sumY = validData.reduce((sum, d) => sum + (d.y as number), 0);
    const sumXY = validData.reduce(
      (sum, d) => sum + (d.x as number) * (d.y as number),
      0,
    );
    const sumXX = validData.reduce(
      (sum, d) => sum + (d.x as number) * (d.x as number),
      0,
    );

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const xMin = d3.min(validData, (d) => d.x as number) || 0;
    const xMax = d3.max(validData, (d) => d.x as number) || 0;

    return [
      { x: xMin, y: slope * xMin + intercept },
      { x: xMax, y: slope * xMax + intercept },
    ];
  }

  function addLegend(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: any[],
    innerWidth: number,
    innerHeight: number,
  ) {
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${innerWidth - 120}, 20)`);

    const legendItems = legend
      .selectAll(".legend-item")
      .data(data.slice(0, 5)) // Limit to 5 items
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    // Legend color box
    legendItems
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", (d, i) => d3.schemeCategory10[i % 10]);

    // Legend text
    legendItems
      .append("text")
      .attr("x", 18)
      .attr("y", 9)
      .attr("font-size", "12px")
      .attr("fill", "#374151")
      .text((d) => d.label || d.x || `Item ${d}`);
  }

  function getColorScheme(index: number): string {
    const schemes = {
      blue: ["#3b82f6", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"],
      green: ["#10b981", "#059669", "#047857", "#065f46", "#064e3b"],
      purple: ["#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"],
      red: ["#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d"],
      orange: ["#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12"],
      teal: ["#14b8a6", "#0f766e", "#115e59", "#134e4a", "#042f2e"],
      pink: ["#ec4899", "#db2777", "#be185d", "#9d174d", "#831843"],
      rainbow: [
        "#ef4444",
        "#f59e0b",
        "#10b981",
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
      ],
      monochrome: ["#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af"],
    };

    const colors = schemes[colorScheme as keyof typeof schemes] || schemes.blue;
    return colors[index % colors.length];
  }

  // Export functions
  async function exportChart(format: string) {
    if (!chartContainer) {
      alert("No chart to export");
      return;
    }

    try {
      const svgElement = chartContainer.querySelector("svg");
      if (!svgElement) {
        alert("No SVG element found");
        return;
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename = `chart_${selectedChartType}_${timestamp}`;

      switch (format) {
        case "svg":
          exportAsSVG(svgString, filename);
          break;
        case "png":
          await exportAsPNG(svgElement, filename);
          break;
        case "pdf":
          await exportAsPDF(svgElement, filename);
          break;
        case "json":
          exportAsJSON(filename);
          break;
        default:
          alert("Unsupported export format");
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed: " + (error as Error).message);
    }
  }

  function exportAsSVG(svgString: string, filename: string) {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  async function exportAsPNG(svgElement: SVGSVGElement, filename: string) {
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Convert SVG to data URL
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${filename}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    };
    img.src = url;
  }

  async function exportAsPDF(svgElement: SVGSVGElement, filename: string) {
    // For PDF export, we'll use a simple approach with canvas
    // In a production app, you'd want to use a proper PDF library
    alert("PDF export requires additional libraries. Use PNG export instead.");
  }

  function exportAsJSON(filename: string) {
    const chartData = {
      type: selectedChartType,
      data: filteredData,
      columns: {
        x: selectedXColumn,
        y: selectedYColumn,
        z: selectedZColumn,
      },
      settings: {
        theme: chartTheme,
        colorScheme: colorScheme,
        width: chartWidth,
        height: chartHeight,
        showGrid: showGrid,
        showLegend: showLegend,
        showTooltips: showTooltips,
        animationDuration: animationDuration,
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        totalRows: filteredData.length,
        fileName: currentFileId
          ? $csvDataStore.files.find((f) => f.id === currentFileId)?.name
          : "unknown",
      },
    };

    const jsonString = JSON.stringify(chartData, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  // Statistical analysis functions
  function calculateColumnStats(columnId: string) {
    const values = filteredData
      .map((row) => parseFloat(row[columnId]))
      .filter((val) => !isNaN(val) && val !== null && val !== undefined);

    if (values.length === 0)
      return {
        count: 0,
        mean: null,
        median: null,
        min: null,
        max: null,
        stdDev: null,
      };

    const sorted = [...values].sort((a, b) => a - b);
    const mean = d3.mean(values) || 0;
    const median = d3.median(values) || 0;
    const min = d3.min(values) || 0;
    const max = d3.max(values) || 0;

    // Calculate standard deviation
    const variance = d3.variance(values) || 0;
    const stdDev = Math.sqrt(variance);

    // Calculate quartiles
    const q1 = d3.quantile(sorted, 0.25) || 0;
    const q3 = d3.quantile(sorted, 0.75) || 0;

    return {
      count: values.length,
      mean,
      median,
      min,
      max,
      stdDev,
      q1,
      q3,
      iqr: q3 - q1,
    };
  }

  function calculateDataCompleteness(): number {
    if (filteredData.length === 0 || availableColumns.length === 0) return 0;

    let totalCells = filteredData.length * availableColumns.length;
    let filledCells = 0;

    filteredData.forEach((row) => {
      availableColumns.forEach((col) => {
        const value = row[col.id];
        if (value !== null && value !== undefined && value !== "") {
          filledCells++;
        }
      });
    });

    return Math.round((filledCells / totalCells) * 100);
  }

  // Advanced filtering functions
  function getUniqueValues(columnId: string): string[] {
    const values = [
      ...new Set(
        filteredData
          .map((row) => row[columnId])
          .filter((v) => v !== null && v !== undefined && v !== ""),
      ),
    ];
    return values.slice(0, 50); // Limit to prevent performance issues
  }

  function applyRangeFilter() {
    if (!rangeFilterColumn) return;

    const filtered = filteredData.filter((row) => {
      const value = parseFloat(row[rangeFilterColumn]);
      if (isNaN(value)) return false;

      const minCheck = rangeFilterMin === null || value >= rangeFilterMin;
      const maxCheck = rangeFilterMax === null || value <= rangeFilterMax;

      return minCheck && maxCheck;
    });

    // Update the filtered data in store
    if (currentFileId) {
      csvDataActions.setFilteredData(currentFileId, filtered);
    }
  }

  function applyCategoryFilter() {
    if (!categoryFilterColumn || !categoryFilterValue) {
      // Reset to original filtered data
      if (currentFileId) {
        const originalData = $csvDataStore.parsedData.get(currentFileId) || [];
        csvDataActions.setFilteredData(currentFileId, originalData);
      }
      return;
    }

    const filtered = filteredData.filter(
      (row) => row[categoryFilterColumn] === categoryFilterValue,
    );

    if (currentFileId) {
      csvDataActions.setFilteredData(currentFileId, filtered);
    }
  }

  function applyPresetFilter(type: string) {
    if (!currentFileId) return;

    const originalData = $csvDataStore.parsedData.get(currentFileId) || [];
    let filtered = [...originalData];

    switch (type) {
      case "complete":
        // Show only rows with no missing values
        filtered = originalData.filter((row) => {
          return availableColumns.every((col) => {
            const value = row[col.id];
            return value !== null && value !== undefined && value !== "";
          });
        });
        break;

      case "incomplete":
        // Show only rows with missing values
        filtered = originalData.filter((row) => {
          return availableColumns.some((col) => {
            const value = row[col.id];
            return value === null || value === undefined || value === "";
          });
        });
        break;

      case "outliers":
        // Remove statistical outliers (using IQR method)
        if (
          selectedYColumn &&
          numericColumns.some((col) => col.id === selectedYColumn)
        ) {
          const values = originalData
            .map((row) => parseFloat(row[selectedYColumn]))
            .filter((val) => !isNaN(val) && val !== null && val !== undefined)
            .sort((a, b) => a - b);

          if (values.length > 4) {
            const q1 = d3.quantile(values, 0.25) || 0;
            const q3 = d3.quantile(values, 0.75) || 0;
            const iqr = q3 - q1;
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;

            filtered = originalData.filter((row) => {
              const value = parseFloat(row[selectedYColumn]);
              return (
                !isNaN(value) && value >= lowerBound && value <= upperBound
              );
            });
          }
        }
        break;
    }

    csvDataActions.setFilteredData(currentFileId, filtered);
  }

  function clearAdvancedFilters() {
    // Reset all advanced filters
    rangeFilterColumn = "";
    rangeFilterMin = null;
    rangeFilterMax = null;
    categoryFilterColumn = "";
    categoryFilterValue = "";

    // Reset to original data
    if (currentFileId) {
      const originalData = $csvDataStore.parsedData.get(currentFileId) || [];
      csvDataActions.setFilteredData(currentFileId, originalData);
    }
  }

  function renderLineChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    // Create line generator
    const line = d3
      .line<ChartDataPoint>()
      .x((d: ChartDataPoint) => xScale(d.x as number))
      .y((d: ChartDataPoint) => yScale(d.y as number))
      .curve(d3.curveMonotoneX);

    // Add animated line
    const path = g.selectAll(".line-path").data([data]);

    path
      .enter()
      .append("path")
      .attr("class", "line-path")
      .attr("fill", "none")
      .attr("stroke", getColorScheme(0))
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line)
      .style("opacity", 0)
      .transition()
      .duration(animationDuration)
      .style("opacity", 1);

    path
      .transition()
      .duration(animationDuration)
      .attr("d", line)
      .attr("stroke", getColorScheme(0));

    // Add animated dots
    const dots = g
      .selectAll(".dot")
      .data(data, (d: ChartDataPoint) => `${d.x}-${d.y}`);

    // Enter new dots
    dots
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d: ChartDataPoint) => xScale(d.x as number))
      .attr("cy", innerHeight) // Start from bottom
      .attr("r", 0) // Start with zero radius
      .attr("fill", getColorScheme(0))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .style("opacity", 0)
      .transition()
      .duration(animationDuration)
      .delay((d, i) => i * 100) // Stagger animation
      .attr("cy", (d: ChartDataPoint) => yScale(d.y as number))
      .attr("r", 6)
      .style("opacity", 1);

    // Update existing dots
    dots
      .transition()
      .duration(animationDuration)
      .attr("cx", (d: ChartDataPoint) => xScale(d.x as number))
      .attr("cy", (d: ChartDataPoint) => yScale(d.y as number))
      .attr("fill", getColorScheme(0));

    // Remove old dots
    dots
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .attr("r", 0)
      .style("opacity", 0)
      .remove();

    // Add hover interactions
    g.selectAll(".dot")
      .on(
        "mouseover",
        function (
          this: SVGCircleElement,
          event: MouseEvent,
          d: ChartDataPoint,
        ) {
          if (!showTooltips) return;

          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 8)
            .attr("fill", "#2563eb");

          addTooltip(g, d, event);
        },
      )
      .on("mouseout", function (this: SVGCircleElement) {
        if (!showTooltips) return;

        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 6)
          .attr("fill", getColorScheme(0));

        g.select(".tooltip").remove();
      });
  }

  function renderScatterChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartDataPoint[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    // Add dots
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d: ChartDataPoint) => xScale(d.x as number))
      .attr("cy", (d: ChartDataPoint) => yScale(d.y as number))
      .attr("r", 5)
      .attr("fill", "#8b5cf6")
      .attr("opacity", 0.7)
      .on(
        "mouseover",
        function (
          this: SVGCircleElement,
          event: MouseEvent,
          d: ChartDataPoint,
        ) {
          d3.select(this).attr("r", 8).attr("opacity", 1);

          // Add tooltip
          const tooltip = g
            .append("g")
            .attr("class", "tooltip")
            .attr(
              "transform",
              `translate(${xScale(d.x as number)}, ${yScale(d.y as number) - 20})`,
            );

          const tooltipRect = tooltip
            .append("rect")
            .attr("x", -50)
            .attr("y", -30)
            .attr("width", 100)
            .attr("height", 24)
            .attr("fill", "rgba(0,0,0,0.8)")
            .attr("rx", 4);

          tooltip
            .append("text")
            .attr("x", 0)
            .attr("y", -15)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "12px")
            .text(`(${d.x.toFixed(2)}, ${d.y.toFixed(2)})`);
        },
      )
      .on("mouseout", function (this: SVGCircleElement) {
        d3.select(this).attr("r", 5).attr("opacity", 0.7);

        g.select(".tooltip").remove();
      });
  }

  // Helper functions
  function addAxes(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    innerWidth: number,
    innerHeight: number,
  ) {
    // X-axis
    let xAxis: d3.Axis<d3.AxisDomain>;
    if (selectedChartType === "bar") {
      xAxis = d3.axisBottom(xScale as d3.ScaleBand<string>);
    } else {
      xAxis = d3.axisBottom(xScale as d3.ScaleLinear<number, number>);
    }

    if (selectedChartType === "bar") {
      (xAxis as d3.Axis<string>).tickSize(0);
    }

    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${height - margin.bottom})`)
      .call(xAxis)
      .attr("font-size", "12px")
      .attr("color", "#6b7280");

    // Y-axis
    const yAxis = d3.axisLeft(yScale);
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(yAxis)
      .attr("font-size", "12px")
      .attr("color", "#6b7280");

    // Axis labels
    svg
      .append("text")
      .attr("transform", `translate(${width / 2}, ${height - 10})`)
      .style("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#374151")
      .text(getXAxisLabel());

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 20)
      .attr("x", -(height / 2))
      .style("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#374151")
      .text(getYAxisLabel());
  }

  function addTitle(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    chartType: string,
    xColumn: string,
    yColumn: string,
  ) {
    const titleText = `${chartTypes.find((c) => c.id === chartType)?.label || chartType} - ${getYAxisLabel()} vs ${getXAxisLabel()}`;

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .attr("fill", "#1f2937")
      .text(titleText);
  }

  function getXAxisLabel(): string {
    if (selectedXColumn === "index") return "Row Index";
    const col = availableColumns.find(
      (c: ColumnInfo) => c.id === selectedXColumn,
    );
    return col ? col.name : selectedXColumn;
  }

  function getYAxisLabel(): string {
    const col = availableColumns.find(
      (c: ColumnInfo) => c.id === selectedYColumn,
    );
    return col ? col.name : selectedYColumn;
  }

  function parseCSVContent(content: string): DataRow[] {
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = index < values.length ? values[index].trim() : null;
      });
      return row;
    });

    return data;
  }
</script>

<div class="data-science">
  {#if !currentFileId || !fileStats}
    <div class="no-data-message">
      <div class="message-icon">📊</div>
      <h3>ANALYSIS_ENGINE_OFFLINE</h3>
      <p>Please select a data source to initialize visualization.</p>
    </div>
  {:else}
    <div class="visualization-container">
      <!-- LEFT SIDEBAR: Configuration -->
      <aside class="sidebar-controls custom-scrollbar">
        <div class="section-label">
          <span class="material-symbols-outlined text-xs">settings</span>
          <span class="section-label-text">Configuration</span>
        </div>

        <!-- Chart Type Selector -->
        <div class="control-group">
          <span class="control-group-title">Visualization Type</span>
          <div class="control-row">
            <select
              class="control-select"
              bind:value={selectedChartType}
              on:change={handleChartTypeChange}
            >
              {#each chartTypes as type}
                <option value={type.id}>{type.label.toUpperCase()}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Axis Mapping -->
        <div class="control-group">
          <span class="control-group-title">Axis Mapping</span>
          <div class="control-row">
            <div class="control-item">
              <label class="control-label">X-Axis</label>
              <select
                class="control-select"
                bind:value={selectedXColumn}
                on:change={handleXColumnChange}
              >
                <option value="index">INDEX</option>
                {#each availableColumns as col}
                  <option value={col.id}>{col.name.toUpperCase()}</option>
                {/each}
              </select>
            </div>
            <div class="control-item">
              <label class="control-label">Y-Axis</label>
              <select
                class="control-select"
                bind:value={selectedYColumn}
                on:change={handleYColumnChange}
              >
                {#each numericColumns as col}
                  <option value={col.id}>{col.name.toUpperCase()}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Visual Settings -->
        <div class="control-group">
          <span class="control-group-title">Appearance</span>
          <div class="control-row">
            <label class="checkbox-raw">
              <input type="checkbox" bind:checked={showGrid} />
              <span>SHOW_GRID</span>
            </label>
            <label class="checkbox-raw">
              <input type="checkbox" bind:checked={showTooltips} />
              <span>TOOLTIPS</span>
            </label>
            <div class="control-item mt-2">
              <label class="control-label">Point Size: {chartMargin}</label>
              <input
                type="range"
                min="2"
                max="20"
                class="control-slider"
                bind:value={chartMargin}
              />
            </div>
          </div>
        </div>

        <!-- Data Filters -->
        <div class="control-group">
          <span class="control-group-title">Operations</span>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <button
              class="btn-industrial-outline text-[10px] py-2"
              on:click={() => applyPresetFilter("complete")}>CLEAN</button
            >
            <button
              class="btn-industrial-outline text-[10px] py-2"
              on:click={() => applyPresetFilter("outliers")}>OUTLIERS</button
            >
            <button
              class="btn-industrial-outline text-[10px] py-2 col-span-2"
              on:click={clearAdvancedFilters}>RESET_ENGINE</button
            >
          </div>
        </div>

        <!-- Export -->
        <div class="control-group">
          <span class="control-group-title">Data Export</span>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn-industrial" on:click={() => exportChart("json")}
              >JSON</button
            >
            <button class="btn-industrial" on:click={() => exportChart("svg")}
              >SVG</button
            >
          </div>
        </div>
      </aside>

      <!-- MAIN AREA: Visualization Canvas -->
      <main class="main-canvas">
        <!-- Top Stats Bar -->
        <div class="insights-panel">
          <div class="insight-card">
            <span class="insight-label">Record Count</span>
            <span class="insight-value">{filteredData.length}</span>
          </div>
          <div class="insight-card">
            <span class="insight-label">Dimensions</span>
            <span class="insight-value">{availableColumns.length}</span>
          </div>
          <div class="insight-card">
            <span class="insight-label">Complexity</span>
            <span class="insight-value">{calculateDataCompleteness()}%</span>
          </div>
          {#if selectedYColumn && numericColumns.some((col) => col.id === selectedYColumn)}
            <div class="insight-card border-l border-slate-100">
              <span class="insight-label">Mean Val</span>
              <span class="insight-value text-blue-600"
                >{calculateColumnStats(selectedYColumn).mean?.toFixed(2) ||
                  "0.00"}</span
              >
            </div>
          {/if}
        </div>

        <!-- Chart Viewport -->
        <div class="chart-display">
          {#if isVisualizing}
            <div class="no-data-message">
              <div class="animate-spin text-2xl">⏳</div>
              <p>CALCULATING_RENDER...</p>
            </div>
          {:else if filteredData.length > 0}
            <div
              class="chart-wrapper flex items-center justify-center p-8"
              bind:this={chartContainer}
            >
              <!-- D3.js will render here -->
            </div>
          {:else}
            <div class="no-data-message">
              <div class="message-icon">📈</div>
              <p>NO_DATA_STREAM_DETECTED</p>
            </div>
          {/if}
        </div>

        <!-- Detailed Stats Footer (Optional) -->
        <div class="bg-slate-50 border-t border-slate-200 p-2">
          <div class="flex items-center justify-between px-2">
            <span class="text-[9px] font-mono text-slate-400"
              >ENGINE_STATUS: NOMINAL</span
            >
            <span class="text-[9px] font-mono text-slate-400"
              >RENDER_MODE: D3_SVG</span
            >
          </div>
        </div>
      </main>
    </div>
  {/if}
</div>

<style>
  /* INDUSTRIAL THEME: Base Layout */
  .data-science {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0;
  }

  .visualization-container {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1px;
    background: #e2e8f0;
    border: 1px solid #e2e8f0;
    min-height: 600px;
  }

  .sidebar-controls {
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    max-height: calc(100vh - 200px);
  }

  .main-canvas {
    background: white;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Section Headers */
  .section-label {
    padding: 0.75rem 1rem;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-label-text {
    font-size: 10px;
    font-weight: 800;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* Control Groups */
  .control-group {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .control-group-title {
    font-size: 10px;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
    display: block;
  }

  .control-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .control-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .control-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }

  /* Industrial Inputs */
  .control-select,
  .control-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 2px;
    font-size: 12px;
    color: #334155;
    outline: none;
    transition: border-color 0.15s;
  }

  .control-select:focus,
  .control-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
  }

  .control-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    background: #e2e8f0;
    border-radius: 0;
    outline: none;
    margin: 10px 0;
  }

  .control-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border-radius: 0;
    cursor: pointer;
  }

  /* Insights & Stats */
  .insights-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px;
    background: #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
  }

  .insight-card {
    background: white;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .insight-value {
    font-family: inherit;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    font-variant-numeric: tabular-nums;
  }

  .insight-label {
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* D3 Chart Area */
  .chart-display {
    flex: 1;
    position: relative;
    padding: 2rem;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chart-wrapper {
    width: 100%;
    height: 100%;
    max-height: 600px;
  }

  /* Utility Buttons */
  .btn-industrial {
    padding: 0.5rem 0.75rem;
    background: #3b82f6;
    color: white;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 2px;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-industrial:hover {
    background: #2563eb;
  }

  .btn-industrial-outline {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }

  .btn-industrial-outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  /* Empty State */
  .no-data-message {
    height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    gap: 1rem;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .message-icon {
    font-size: 40px;
  }

  /* Grid helper for detailed stats */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-family: ui-monospace, monospace;
  }

  .stat-label {
    color: #64748b;
  }
  .stat-value {
    color: #1e293b;
    font-weight: bold;
  }

  /* Interactive items style */
  .category-btn {
    padding: 0.4rem 0.75rem;
    background: transparent;
    border: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 2px;
  }

  .category-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  /* Generic grid lines for industrial look */
  :global(.chart-display .grid line) {
    stroke: #f1f5f9;
    stroke-opacity: 0.7;
    shape-rendering: crispEdges;
  }

  :global(.chart-display .axis path),
  :global(.chart-display .axis line) {
    stroke: #cbd5e1;
  }

  :global(.chart-display .axis text) {
    fill: #64748b;
    font-size: 10px;
    font-family: inherit;
  }
</style>
