<script>
    import { page } from "$app/stores";
    import { sidebarExpanded } from "../../store.js";

    const menuItems = [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
            href: "/data-visualization",
            label: "Data Visualization",
            icon: "analytics",
        },
    ];

    function toggleSidebar() {
        sidebarExpanded.update((v) => !v);
    }
</script>

<aside
    class="relative h-full transition-all duration-300 ease-spring flex flex-col border-r border-slate-200/60 shadow-sm z-50 bg-white/80 backdrop-blur-xl"
    class:w-64={$sidebarExpanded}
    class:w-20={!$sidebarExpanded}
>
    <!-- Header -->
    <div
        class="flex items-center h-16 mb-2 transition-all duration-300
        {$sidebarExpanded ? 'justify-between px-4' : 'justify-center'}"
    >
        {#if $sidebarExpanded}
            <div class="whitespace-nowrap overflow-hidden">
                <h2
                    class="font-bold text-lg text-slate-800 tracking-tight leading-tight"
                >
                    Data Science App
                </h2>
            </div>
        {/if}

        <button
            class="btn btn-ghost btn-sm btn-circle text-slate-500 hover:bg-slate-100"
            on:click={toggleSidebar}
            title={$sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
            <span class="material-symbols-outlined text-xl">
                {$sidebarExpanded ? "first_page" : "last_page"}
            </span>
        </button>
    </div>

    <!-- Menu -->
    <nav class="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar">
        <ul class="flex flex-col gap-1.5">
            {#each menuItems as item}
                {@const isActive = $page.url.pathname === item.href}
                <li>
                    <a
                        href={item.href}
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                        {isActive
                            ? 'bg-blue-50/80 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/50 hover:text-slate-900'}"
                        title={!$sidebarExpanded ? item.label : ""}
                    >
                        <span
                            class="material-symbols-outlined flex-shrink-0 transition-colors duration-200 {isActive
                                ? 'text-blue-600'
                                : 'text-slate-400 group-hover:text-slate-600'}"
                        >
                            {item.icon}
                        </span>

                        {#if $sidebarExpanded}
                            <span
                                class="whitespace-nowrap font-medium text-sm transition-opacity duration-200"
                            >
                                {item.label}
                            </span>
                        {/if}
                    </a>
                </li>
            {/each}
        </ul>
    </nav>
</aside>

<style>
    /* Smooth width transition spring effect */
    .ease-spring {
        transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0);
        border-radius: 10px;
    }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.3);
    }
</style>
