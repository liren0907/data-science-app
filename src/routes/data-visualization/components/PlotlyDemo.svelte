<script lang="ts">
	import { onMount } from "svelte";
	// @ts-ignore - Plotly.js types are complex, using any for now
	import Plotly from "plotly.js/dist/plotly.min.js";

	export let businessData: any;
	export let isActive: boolean;

	// Plotly.js state
	let plotlyChartsLoaded = false;
	let plotlyChartContainer: HTMLElement;

	// Dashboard metrics - computed from business data
	$: dashboardMetrics = businessData
		? {
				totalRevenue: businessData.revenue.reduce(
					(a: number, b: number) => a + b,
					0,
				),
				totalOrders: businessData.orders.reduce(
					(a: number, b: number) => a + b,
					0,
				),
				avgOrderValue: Math.round(
					businessData.revenue.reduce(
						(a: number, b: number) => a + b,
						0,
					) /
						businessData.orders.reduce(
							(a: number, b: number) => a + b,
							0,
						),
				),
				conversionRate: 3.24,
			}
		: {
				totalRevenue: 0,
				totalOrders: 0,
				avgOrderValue: 0,
				conversionRate: 0,
			};

	// Initialize Plotly charts when component mounts or becomes active
	$: if (isActive && businessData && plotlyChartContainer) {
		setTimeout(() => {
			initializePlotlyCharts();
		}, 100);
	}

	// Initialize Plotly charts
	async function initializePlotlyCharts() {
		if (!businessData) return;

		try {
			console.log("Initializing Plotly charts...");

			// Revenue Trend Chart (Line Chart)
			const revenueData = [
				{
					x: businessData.months,
					y: businessData.revenue,
					type: "scatter",
					mode: "lines+markers",
					name: "Revenue",
					line: { color: "#10b981", width: 3, shape: "spline" },
					marker: { color: "#10b981", size: 6 },
					fill: "tozeroy",
					fillcolor: "rgba(16, 185, 129, 0.1)",
				},
			];

			const revenueLayout = {
				title: {
					text: "REVENUE_TREND_ANALYSIS",
					font: {
						size: 12,
						color: "#64748b",
						family: "ui-monospace, monospace",
					},
				},
				xaxis: {
					showgrid: false,
					zeroline: false,
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				yaxis: {
					showgrid: true,
					gridcolor: "#f1f5f9",
					tickprefix: "$",
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				paper_bgcolor: "transparent",
				plot_bgcolor: "transparent",
				margin: { t: 40, r: 20, b: 40, l: 60 },
				showlegend: false,
				height: 300,
			};

			// Sales by Category (Bar Chart)
			const categoryData = [
				{
					x: businessData.categories,
					y: businessData.sales,
					type: "bar",
					name: "Sales",
					marker: {
						color: "#3b82f6",
						line: { color: "rgba(255,255,255,0.8)", width: 1 },
					},
					text: businessData.sales.map(
						(val: number) => `$${val.toLocaleString()}`,
					),
					textposition: "auto",
					textfont: { family: "ui-monospace, monospace", size: 9 },
					hovertemplate: "<b>%{x}</b><br>$%{y:,.0f}<extra></extra>",
				},
			];

			const categoryLayout = {
				title: {
					text: "SALES_BY_CATEGORY",
					font: {
						size: 12,
						color: "#64748b",
						family: "ui-monospace, monospace",
					},
				},
				xaxis: {
					showgrid: false,
					zeroline: false,
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				yaxis: {
					showgrid: true,
					gridcolor: "#f1f5f9",
					tickprefix: "$",
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				paper_bgcolor: "transparent",
				plot_bgcolor: "transparent",
				margin: { t: 40, r: 20, b: 40, l: 60 },
				showlegend: false,
				height: 300,
			};

			// Regional Distribution (Pie Chart)
			const regionalData = [
				{
					values: businessData.percentages,
					labels: businessData.regions,
					type: "pie",
					hole: 0.4,
					textinfo: "label+percent",
					textposition: "outside",
					marker: {
						colors: [
							"#1e40af",
							"#1d4ed8",
							"#3b82f6",
							"#60a5fa",
							"#93c5fd",
						],
					},
					hoverlabel: { font: { family: "ui-monospace, monospace" } },
					hovertemplate:
						"<b>%{label}</b><br>%{percent}<br>%{value}% of total<extra></extra>",
					outsidetextfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#64748b",
					},
				},
			];

			const regionalLayout = {
				title: {
					text: "REGIONAL_DISTRIBUTION",
					font: {
						size: 12,
						color: "#64748b",
						family: "ui-monospace, monospace",
					},
				},
				paper_bgcolor: "transparent",
				plot_bgcolor: "transparent",
				margin: { t: 40, r: 20, b: 20, l: 20 },
				showlegend: true,
				legend: {
					font: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#64748b",
					},
					x: 0.5,
					y: -0.1,
					xanchor: "center",
					yanchor: "top",
					orientation: "h",
				},
				height: 300,
			};

			// Orders Trend (Area Chart)
			const ordersData = [
				{
					x: businessData.months,
					y: businessData.orders,
					type: "scatter",
					mode: "lines",
					name: "Orders",
					line: { color: "#3b82f6", width: 2 },
					fill: "tozeroy",
					fillcolor: "rgba(59, 130, 246, 0.1)",
					hovertemplate: "<b>%{x}</b><br>%{y} orders<extra></extra>",
				},
			];

			const ordersLayout = {
				title: {
					text: "MONTHLY_ORDER_VOLUME",
					font: {
						size: 12,
						color: "#64748b",
						family: "ui-monospace, monospace",
					},
				},
				xaxis: {
					showgrid: false,
					zeroline: false,
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				yaxis: {
					showgrid: true,
					gridcolor: "#f1f5f9",
					tickfont: {
						size: 10,
						family: "ui-monospace, monospace",
						color: "#94a3b8",
					},
				},
				paper_bgcolor: "transparent",
				plot_bgcolor: "transparent",
				margin: { t: 40, r: 20, b: 40, l: 60 },
				showlegend: false,
				height: 300,
			};

			// Render charts
			const containers = [
				"revenue-chart",
				"category-chart",
				"regional-chart",
				"orders-chart",
			];
			const chartData = [
				revenueData,
				categoryData,
				regionalData,
				ordersData,
			];
			const layouts = [
				revenueLayout,
				categoryLayout,
				regionalLayout,
				ordersLayout,
			];

			for (let i = 0; i < containers.length; i++) {
				const container = document.getElementById(containers[i]);
				if (container) {
					await Plotly.newPlot(container, chartData[i], layouts[i], {
						responsive: true,
					});
				}
			}

			plotlyChartsLoaded = true;
			console.log("Plotly charts initialized successfully");
		} catch (error) {
			console.error("Error initializing Plotly charts:", error);
		}
	}
</script>

<div class="plotly-demo space-y-8">
	<!-- KPI Section -->
	<section class="kpi-section">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="kpi-card">
				<div class="flex justify-between items-start">
					<div>
						<p class="text-sm font-medium text-slate-500">
							Total Revenue
						</p>
						<h3 class="text-2xl font-bold text-slate-800 mt-1">
							${dashboardMetrics.totalRevenue.toLocaleString()}
						</h3>
					</div>
					<div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
						<span class="material-symbols-outlined">payments</span>
					</div>
				</div>
				<div class="mt-4 flex items-center text-sm">
					<span
						class="text-emerald-600 font-medium flex items-center gap-0.5"
					>
						<span class="material-symbols-outlined text-base"
							>trending_up</span
						>
						15.2%
					</span>
					<span class="text-slate-400 ml-2">vs last month</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="flex justify-between items-start">
					<div>
						<p class="text-sm font-medium text-slate-500">
							Total Orders
						</p>
						<h3 class="text-2xl font-bold text-slate-800 mt-1">
							{dashboardMetrics.totalOrders.toLocaleString()}
						</h3>
					</div>
					<div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
						<span class="material-symbols-outlined"
							>shopping_cart</span
						>
					</div>
				</div>
				<div class="mt-4 flex items-center text-sm">
					<span
						class="text-emerald-600 font-medium flex items-center gap-0.5"
					>
						<span class="material-symbols-outlined text-base"
							>trending_up</span
						>
						12.8%
					</span>
					<span class="text-slate-400 ml-2">vs last month</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="flex justify-between items-start">
					<div>
						<p class="text-sm font-medium text-slate-500">
							Avg Order Value
						</p>
						<h3 class="text-2xl font-bold text-slate-800 mt-1">
							${dashboardMetrics.avgOrderValue}
						</h3>
					</div>
					<div class="p-2 bg-purple-50 text-purple-600 rounded-lg">
						<span class="material-symbols-outlined"
							>credit_card</span
						>
					</div>
				</div>
				<div class="mt-4 flex items-center text-sm">
					<span
						class="text-emerald-600 font-medium flex items-center gap-0.5"
					>
						<span class="material-symbols-outlined text-base"
							>trending_up</span
						>
						2.1%
					</span>
					<span class="text-slate-400 ml-2">vs last month</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="flex justify-between items-start">
					<div>
						<p class="text-sm font-medium text-slate-500">
							Conversion Rate
						</p>
						<h3 class="text-2xl font-bold text-slate-800 mt-1">
							{dashboardMetrics.conversionRate}%
						</h3>
					</div>
					<div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
						<span class="material-symbols-outlined">target</span>
					</div>
				</div>
				<div class="mt-4 flex items-center text-sm">
					<span
						class="text-slate-500 font-medium flex items-center gap-0.5"
					>
						<span class="material-symbols-outlined text-base"
							>remove</span
						>
						0.0%
					</span>
					<span class="text-slate-400 ml-2">vs last month</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Charts Grid -->
	<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
		<div class="chart-card">
			<div class="p-4 border-b border-slate-100">
				<h3 class="font-bold text-slate-700">Revenue Trend</h3>
			</div>
			<div class="p-4 h-[350px]">
				<div
					bind:this={plotlyChartContainer}
					class="w-full h-full"
					id="revenue-chart"
				></div>
			</div>
		</div>

		<div class="chart-card">
			<div class="p-4 border-b border-slate-100">
				<h3 class="font-bold text-slate-700">Sales by Category</h3>
			</div>
			<div class="p-4 h-[350px]">
				<div class="w-full h-full" id="category-chart"></div>
			</div>
		</div>

		<div class="chart-card">
			<div class="p-4 border-b border-slate-100">
				<h3 class="font-bold text-slate-700">Regional Distribution</h3>
			</div>
			<div class="p-4 h-[350px]">
				<div class="w-full h-full" id="regional-chart"></div>
			</div>
		</div>

		<div class="chart-card">
			<div class="p-4 border-b border-slate-100">
				<h3 class="font-bold text-slate-700">Monthly Orders</h3>
			</div>
			<div class="p-4 h-[350px]">
				<div class="w-full h-full" id="orders-chart"></div>
			</div>
		</div>
	</div>
</div>

<style>
	.kpi-card {
		background: white;
		border: 1px solid #f1f5f9;
		border-radius: 0.75rem; /* rounded-xl */
		padding: 1.5rem;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
		transition: all 0.2s;
	}

	.kpi-card:hover {
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
	}

	.chart-card {
		background: white;
		border: 1px solid #f1f5f9;
		border-radius: 0.75rem; /* rounded-xl */
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
		transition: all 0.2s;
	}

	.chart-card:hover {
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
	}
</style>
