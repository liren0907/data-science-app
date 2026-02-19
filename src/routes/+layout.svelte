<script>
	import "../app.css";
	import Sidebar from "$lib/components/Sidebar.svelte";
</script>

<div class="drawer lg:drawer-open h-screen w-screen overflow-hidden">
	<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
	<div
		class="drawer-content flex flex-col items-center bg-base-100 h-full overflow-hidden"
	>
		<!-- Page content here -->
		<div class="w-full navbar bg-base-100 lg:hidden shrink-0">
			<div class="flex-none">
				<label for="my-drawer-2" class="btn btn-square btn-ghostDrawer">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block w-6 h-6 stroke-current"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						></path></svg
					>
				</label>
			</div>
			<div class="flex-1">
				<a href="/" class="btn btn-ghost text-xl">Data Science App</a>
			</div>
		</div>

		<main class="w-full flex-1 p-4 overflow-y-auto relative">
			<slot />
		</main>
	</div>

	<div class="drawer-side z-50">
		<label for="my-drawer-2" class="drawer-overlay"></label>
		<Sidebar />
	</div>
</div>

<style>
	/* Fix for Vite parsing issue */
</style>
