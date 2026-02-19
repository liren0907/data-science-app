<script lang="ts">
	import PlotlyDemo from "./components/PlotlyDemo.svelte";
	import D3Demo from "./components/D3Demo.svelte";

	// Tab state
	let activeTab = "plotly"; // 'plotly' or 'd3'

	// Sample data that works for both libraries
	const sampleData = {
		// Business metrics for Plotly
		business: {
			months: [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			],
			revenue: [
				8500, 9200, 10100, 11800, 13500, 14200, 15800, 16500, 17200,
				18900, 19800, 21200,
			],
			orders: [
				185, 202, 223, 261, 298, 312, 348, 363, 379, 416, 436, 468,
			],
			categories: [
				"Electronics",
				"Clothing",
				"Books",
				"Home & Garden",
				"Sports",
			],
			sales: [45200, 32100, 15800, 28900, 19600],
			regions: [
				"North America",
				"Europe",
				"Asia Pacific",
				"Latin America",
				"Middle East",
			],
			percentages: [35, 28, 22, 10, 5],
		},

		// Scientific/technical data for D3
		scientific: {
			categories: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
			values: [23, 45, 67, 34, 89, 56, 78, 90, 43, 65],
			xValues: [
				1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22, 25, 28, 32, 35,
				38, 42,
			],
			yValues: [
				10, 15, 23, 28, 35, 42, 38, 45, 52, 48, 55, 58, 62, 65, 68, 70,
				72, 75, 78, 80,
			],
			bubbleData: [
				{ x: 10, y: 20, r: 5, category: "Type A" },
				{ x: 15, y: 25, r: 8, category: "Type B" },
				{ x: 20, y: 30, r: 12, category: "Type C" },
				{ x: 25, y: 35, r: 6, category: "Type A" },
				{ x: 30, y: 40, r: 10, category: "Type B" },
				{ x: 35, y: 45, r: 15, category: "Type C" },
				{ x: 40, y: 50, r: 7, category: "Type A" },
				{ x: 45, y: 55, r: 9, category: "Type B" },
			],
		},
	};

	// Handle tab switching
	function switchTab(tab: string) {
		activeTab = tab;
	}
</script>

<svelte:head>
	<title>Data Visualization - AI Surveillance System</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto space-y-8">
	<!-- Page Header -->
	<div
		class="flex flex-col md:flex-row md:items-center justify-between gap-4"
	>
		<div>
			<h1 class="text-3xl font-bold text-slate-800 tracking-tight">
				Data Visualization
			</h1>
			<p class="text-slate-500 mt-1">
				Analyze trends and explore data relationships
			</p>
		</div>

		<!-- Modern Pill Navigation -->
		<div
			class="inline-flex bg-slate-100 p-1 rounded-xl items-center self-start md:self-auto"
		>
			<button
				class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                   {activeTab === 'plotly'
					? 'bg-white text-blue-600 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
				on:click={() => switchTab("plotly")}
			>
				Business Analytics
			</button>
			<button
				class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                   {activeTab === 'd3'
					? 'bg-white text-blue-600 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
				on:click={() => switchTab("d3")}
			>
				Scientific Data
			</button>
		</div>
	</div>

	<!-- Main Content Area -->
	<div
		class="bg-white rounded-2xl border border-slate-200/60 shadow-sm min-h-[500px] p-6"
	>
		{#if activeTab === "plotly"}
			<PlotlyDemo
				businessData={sampleData.business}
				isActive={activeTab === "plotly"}
			/>
		{:else if activeTab === "d3"}
			<D3Demo
				scientificData={sampleData.scientific}
				isActive={activeTab === "d3"}
				businessData={sampleData.business}
			/>
		{/if}
	</div>
</div>
