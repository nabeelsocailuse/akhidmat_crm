// vite.config.js
import { defineConfig } from "file:///home/erp/frappe-maarij/apps/crm/node_modules/vite/dist/node/index.js";
import vue from "file:///home/erp/frappe-maarij/apps/crm/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueJsx from "file:///home/erp/frappe-maarij/apps/crm/node_modules/@vitejs/plugin-vue-jsx/dist/index.mjs";
import path from "path";
import fs from "fs";
import frappeui from "file:///home/erp/frappe-maarij/apps/crm/node_modules/frappe-ui/vite/index.js";
var __vite_injected_original_dirname = "/home/erp/frappe-maarij/apps/crm/frontend";
function appPath(app) {
  const root = path.resolve(__vite_injected_original_dirname, "../..");
  const frontendPaths = [
    // Standard frontend structure: appname/frontend/src
    path.join(root, app, "frontend", "src"),
    // Desk-based apps: appname/desk/src
    path.join(root, app, "desk", "src"),
    // Alternative frontend structures
    path.join(root, app, "client", "src"),
    path.join(root, app, "ui", "src"),
    // Direct src structure: appname/src
    path.join(root, app, "src")
  ];
  return frontendPaths.find((srcPath) => fs.existsSync(srcPath)) || null;
}
function hasApp(app) {
  return fs.existsSync(appPath(app));
}
var apps = [];
var alias = [
  // Default "@" for this app
  {
    find: "@",
    replacement: path.resolve(__vite_injected_original_dirname, "src")
  },
  // App-specific aliases like @helpdesk, @hrms, etc.
  ...apps.map(
    (app) => hasApp(app) ? { find: `@${app}`, replacement: appPath(app) } : { find: `@${app}`, replacement: `virtual:${app}` }
  )
];
var defineFlags = Object.fromEntries(
  apps.map((app) => [
    `__HAS_${app.toUpperCase()}__`,
    JSON.stringify(hasApp(app))
  ])
);
var virtualStubPlugin = {
  name: "virtual-empty-modules",
  resolveId(id) {
    if (id.startsWith("virtual:"))
      return "\0" + id;
  },
  load(id) {
    if (id.startsWith("\0virtual:")) {
      return "export default {}; export const missing = true;";
    }
  }
};
console.log("Generated app aliases:", alias);
var vite_config_default = defineConfig({
  define: defineFlags,
  plugins: [
    frappeui({
      frappeProxy: true,
      lucideIcons: true,
      jinjaBootData: true,
      buildConfig: {
        indexHtmlPath: "../crm/www/crm.html",
        emptyOutDir: true,
        sourcemap: true
      }
    }),
    vue(),
    vueJsx(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   devOptions: {
    //     enabled: true,
    //   },
    //   manifest: {
    //     display: 'standalone',
    //     name: 'Frappe CRM',
    //     short_name: 'Frappe CRM',
    //     start_url: '/crm',
    //     description:
    //       'Modern & 100% Open-source CRM tool to supercharge your sales operations',
    //     icons: [
    //       {
    //         src: '/assets/crm/manifest/manifest-icon-192.maskable.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //         purpose: 'any',
    //       },
    //       {
    //         src: '/assets/crm/manifest/manifest-icon-192.maskable.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //         purpose: 'maskable',
    //       },
    //       {
    //         src: '/assets/crm/manifest/manifest-icon-512.maskable.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'any',
    //       },
    //       {
    //         src: '/assets/crm/manifest/manifest-icon-512.maskable.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'maskable',
    //       },
    //     ],
    //   },
    // }),
    virtualStubPlugin
  ],
  resolve: { alias },
  optimizeDeps: {
    include: [
      "feather-icons",
      "showdown",
      "tailwind.config.js",
      "prosemirror-state",
      "prosemirror-view",
      "lowlight"
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9lcnAvZnJhcHBlLW1hYXJpai9hcHBzL2NybS9mcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvZXJwL2ZyYXBwZS1tYWFyaWovYXBwcy9jcm0vZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvZXJwL2ZyYXBwZS1tYWFyaWovYXBwcy9jcm0vZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgdnVlSnN4IGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZS1qc3gnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGZyYXBwZXVpIGZyb20gJ2ZyYXBwZS11aS92aXRlJ1xuLy8gaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcblxuZnVuY3Rpb24gYXBwUGF0aChhcHApIHtcbiAgY29uc3Qgcm9vdCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLicpIC8vIHBvaW50cyB0byBhcHBzXG4gIGNvbnN0IGZyb250ZW5kUGF0aHMgPSBbXG4gICAgLy8gU3RhbmRhcmQgZnJvbnRlbmQgc3RydWN0dXJlOiBhcHBuYW1lL2Zyb250ZW5kL3NyY1xuICAgIHBhdGguam9pbihyb290LCBhcHAsICdmcm9udGVuZCcsICdzcmMnKSxcbiAgICAvLyBEZXNrLWJhc2VkIGFwcHM6IGFwcG5hbWUvZGVzay9zcmNcbiAgICBwYXRoLmpvaW4ocm9vdCwgYXBwLCAnZGVzaycsICdzcmMnKSxcbiAgICAvLyBBbHRlcm5hdGl2ZSBmcm9udGVuZCBzdHJ1Y3R1cmVzXG4gICAgcGF0aC5qb2luKHJvb3QsIGFwcCwgJ2NsaWVudCcsICdzcmMnKSxcbiAgICBwYXRoLmpvaW4ocm9vdCwgYXBwLCAndWknLCAnc3JjJyksXG4gICAgLy8gRGlyZWN0IHNyYyBzdHJ1Y3R1cmU6IGFwcG5hbWUvc3JjXG4gICAgcGF0aC5qb2luKHJvb3QsIGFwcCwgJ3NyYycpLFxuICBdXG4gIHJldHVybiBmcm9udGVuZFBhdGhzLmZpbmQoKHNyY1BhdGgpID0+IGZzLmV4aXN0c1N5bmMoc3JjUGF0aCkpIHx8IG51bGxcbn1cblxuZnVuY3Rpb24gaGFzQXBwKGFwcCkge1xuICByZXR1cm4gZnMuZXhpc3RzU3luYyhhcHBQYXRoKGFwcCkpXG59XG5cbi8vIExpc3Qgb2YgZnJvbnRlbmQgYXBwcyB1c2VkIGluIHRoaXMgcHJvamVjdFxubGV0IGFwcHMgPSBbXVxuXG5jb25zdCBhbGlhcyA9IFtcbiAgLy8gRGVmYXVsdCBcIkBcIiBmb3IgdGhpcyBhcHBcbiAge1xuICAgIGZpbmQ6ICdAJyxcbiAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYycpLFxuICB9LFxuXG4gIC8vIEFwcC1zcGVjaWZpYyBhbGlhc2VzIGxpa2UgQGhlbHBkZXNrLCBAaHJtcywgZXRjLlxuICAuLi5hcHBzLm1hcCgoYXBwKSA9PlxuICAgIGhhc0FwcChhcHApXG4gICAgICA/IHsgZmluZDogYEAke2FwcH1gLCByZXBsYWNlbWVudDogYXBwUGF0aChhcHApIH1cbiAgICAgIDogeyBmaW5kOiBgQCR7YXBwfWAsIHJlcGxhY2VtZW50OiBgdmlydHVhbDoke2FwcH1gIH0sXG4gICksXG5dXG5cbmNvbnN0IGRlZmluZUZsYWdzID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICBhcHBzLm1hcCgoYXBwKSA9PiBbXG4gICAgYF9fSEFTXyR7YXBwLnRvVXBwZXJDYXNlKCl9X19gLFxuICAgIEpTT04uc3RyaW5naWZ5KGhhc0FwcChhcHApKSxcbiAgXSksXG4pXG5cbmNvbnN0IHZpcnR1YWxTdHViUGx1Z2luID0ge1xuICBuYW1lOiAndmlydHVhbC1lbXB0eS1tb2R1bGVzJyxcbiAgcmVzb2x2ZUlkKGlkKSB7XG4gICAgaWYgKGlkLnN0YXJ0c1dpdGgoJ3ZpcnR1YWw6JykpIHJldHVybiAnXFwwJyArIGlkXG4gIH0sXG4gIGxvYWQoaWQpIHtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnXFwwdmlydHVhbDonKSkge1xuICAgICAgcmV0dXJuICdleHBvcnQgZGVmYXVsdCB7fTsgZXhwb3J0IGNvbnN0IG1pc3NpbmcgPSB0cnVlOydcbiAgICB9XG4gIH0sXG59XG5cbmNvbnNvbGUubG9nKCdHZW5lcmF0ZWQgYXBwIGFsaWFzZXM6JywgYWxpYXMpXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBkZWZpbmU6IGRlZmluZUZsYWdzLFxuICBwbHVnaW5zOiBbXG4gICAgZnJhcHBldWkoe1xuICAgICAgZnJhcHBlUHJveHk6IHRydWUsXG4gICAgICBsdWNpZGVJY29uczogdHJ1ZSxcbiAgICAgIGppbmphQm9vdERhdGE6IHRydWUsXG4gICAgICBidWlsZENvbmZpZzoge1xuICAgICAgICBpbmRleEh0bWxQYXRoOiAnLi4vY3JtL3d3dy9jcm0uaHRtbCcsXG4gICAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICB9LFxuICAgIH0pLFxuICAgIHZ1ZSgpLFxuICAgIHZ1ZUpzeCgpLFxuICAgIC8vIFZpdGVQV0Eoe1xuICAgIC8vICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgLy8gICBkZXZPcHRpb25zOiB7XG4gICAgLy8gICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgLy8gICB9LFxuICAgIC8vICAgbWFuaWZlc3Q6IHtcbiAgICAvLyAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgIC8vICAgICBuYW1lOiAnRnJhcHBlIENSTScsXG4gICAgLy8gICAgIHNob3J0X25hbWU6ICdGcmFwcGUgQ1JNJyxcbiAgICAvLyAgICAgc3RhcnRfdXJsOiAnL2NybScsXG4gICAgLy8gICAgIGRlc2NyaXB0aW9uOlxuICAgIC8vICAgICAgICdNb2Rlcm4gJiAxMDAlIE9wZW4tc291cmNlIENSTSB0b29sIHRvIHN1cGVyY2hhcmdlIHlvdXIgc2FsZXMgb3BlcmF0aW9ucycsXG4gICAgLy8gICAgIGljb25zOiBbXG4gICAgLy8gICAgICAge1xuICAgIC8vICAgICAgICAgc3JjOiAnL2Fzc2V0cy9jcm0vbWFuaWZlc3QvbWFuaWZlc3QtaWNvbi0xOTIubWFza2FibGUucG5nJyxcbiAgICAvLyAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgLy8gICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAvLyAgICAgICAgIHB1cnBvc2U6ICdhbnknLFxuICAgIC8vICAgICAgIH0sXG4gICAgLy8gICAgICAge1xuICAgIC8vICAgICAgICAgc3JjOiAnL2Fzc2V0cy9jcm0vbWFuaWZlc3QvbWFuaWZlc3QtaWNvbi0xOTIubWFza2FibGUucG5nJyxcbiAgICAvLyAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgLy8gICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAvLyAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZScsXG4gICAgLy8gICAgICAgfSxcbiAgICAvLyAgICAgICB7XG4gICAgLy8gICAgICAgICBzcmM6ICcvYXNzZXRzL2NybS9tYW5pZmVzdC9tYW5pZmVzdC1pY29uLTUxMi5tYXNrYWJsZS5wbmcnLFxuICAgIC8vICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAvLyAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgIC8vICAgICAgICAgcHVycG9zZTogJ2FueScsXG4gICAgLy8gICAgICAgfSxcbiAgICAvLyAgICAgICB7XG4gICAgLy8gICAgICAgICBzcmM6ICcvYXNzZXRzL2NybS9tYW5pZmVzdC9tYW5pZmVzdC1pY29uLTUxMi5tYXNrYWJsZS5wbmcnLFxuICAgIC8vICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAvLyAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgIC8vICAgICAgICAgcHVycG9zZTogJ21hc2thYmxlJyxcbiAgICAvLyAgICAgICB9LFxuICAgIC8vICAgICBdLFxuICAgIC8vICAgfSxcbiAgICAvLyB9KSxcbiAgICB2aXJ0dWFsU3R1YlBsdWdpbixcbiAgXSxcbiAgcmVzb2x2ZTogeyBhbGlhcyB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbXG4gICAgICAnZmVhdGhlci1pY29ucycsXG4gICAgICAnc2hvd2Rvd24nLFxuICAgICAgJ3RhaWx3aW5kLmNvbmZpZy5qcycsXG4gICAgICAncHJvc2VtaXJyb3Itc3RhdGUnLFxuICAgICAgJ3Byb3NlbWlycm9yLXZpZXcnLFxuICAgICAgJ2xvd2xpZ2h0JyxcbiAgICBdLFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlMsU0FBUyxvQkFBb0I7QUFDMVUsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxjQUFjO0FBTHJCLElBQU0sbUNBQW1DO0FBUXpDLFNBQVMsUUFBUSxLQUFLO0FBQ3BCLFFBQU0sT0FBTyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUM1QyxRQUFNLGdCQUFnQjtBQUFBO0FBQUEsSUFFcEIsS0FBSyxLQUFLLE1BQU0sS0FBSyxZQUFZLEtBQUs7QUFBQTtBQUFBLElBRXRDLEtBQUssS0FBSyxNQUFNLEtBQUssUUFBUSxLQUFLO0FBQUE7QUFBQSxJQUVsQyxLQUFLLEtBQUssTUFBTSxLQUFLLFVBQVUsS0FBSztBQUFBLElBQ3BDLEtBQUssS0FBSyxNQUFNLEtBQUssTUFBTSxLQUFLO0FBQUE7QUFBQSxJQUVoQyxLQUFLLEtBQUssTUFBTSxLQUFLLEtBQUs7QUFBQSxFQUM1QjtBQUNBLFNBQU8sY0FBYyxLQUFLLENBQUMsWUFBWSxHQUFHLFdBQVcsT0FBTyxDQUFDLEtBQUs7QUFDcEU7QUFFQSxTQUFTLE9BQU8sS0FBSztBQUNuQixTQUFPLEdBQUcsV0FBVyxRQUFRLEdBQUcsQ0FBQztBQUNuQztBQUdBLElBQUksT0FBTyxDQUFDO0FBRVosSUFBTSxRQUFRO0FBQUE7QUFBQSxFQUVaO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixhQUFhLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsRUFDNUM7QUFBQTtBQUFBLEVBR0EsR0FBRyxLQUFLO0FBQUEsSUFBSSxDQUFDLFFBQ1gsT0FBTyxHQUFHLElBQ04sRUFBRSxNQUFNLElBQUksR0FBRyxJQUFJLGFBQWEsUUFBUSxHQUFHLEVBQUUsSUFDN0MsRUFBRSxNQUFNLElBQUksR0FBRyxJQUFJLGFBQWEsV0FBVyxHQUFHLEdBQUc7QUFBQSxFQUN2RDtBQUNGO0FBRUEsSUFBTSxjQUFjLE9BQU87QUFBQSxFQUN6QixLQUFLLElBQUksQ0FBQyxRQUFRO0FBQUEsSUFDaEIsU0FBUyxJQUFJLFlBQVksQ0FBQztBQUFBLElBQzFCLEtBQUssVUFBVSxPQUFPLEdBQUcsQ0FBQztBQUFBLEVBQzVCLENBQUM7QUFDSDtBQUVBLElBQU0sb0JBQW9CO0FBQUEsRUFDeEIsTUFBTTtBQUFBLEVBQ04sVUFBVSxJQUFJO0FBQ1osUUFBSSxHQUFHLFdBQVcsVUFBVTtBQUFHLGFBQU8sT0FBTztBQUFBLEVBQy9DO0FBQUEsRUFDQSxLQUFLLElBQUk7QUFDUCxRQUFJLEdBQUcsV0FBVyxZQUFZLEdBQUc7QUFDL0IsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxRQUFRLElBQUksMEJBQTBCLEtBQUs7QUFHM0MsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLElBQ1AsU0FBUztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsYUFBYTtBQUFBLE1BQ2IsZUFBZTtBQUFBLE1BQ2YsYUFBYTtBQUFBLFFBQ1gsZUFBZTtBQUFBLFFBQ2YsYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLE1BQ2I7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNELElBQUk7QUFBQSxJQUNKLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBeUNQO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUyxFQUFFLE1BQU07QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTO0FBQUEsTUFDUDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
