/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Break the cycle by moving the shared piece into its own module.",
      from: {},
      to: { circular: true },
    },
    {
      name: "server-and-lib-not-from-ui",
      severity: "error",
      comment: "src/server and src/lib are below the UI: depend downward on lib/types, never on components, hooks or app routes.",
      from: { path: "^src/(server|lib)/", pathNot: "(__tests__|\\.test\\.)" },
      to: { path: "^src/(components|hooks|app)/" },
    },
    {
      name: "components-not-from-app-routes",
      severity: "error",
      comment: "Components must not import route modules under src/app; move shared code into components, lib or server.",
      from: { path: "^src/(components|hooks)/", pathNot: "(__tests__|\\.test\\.)" },
      to: { path: "^src/app/" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^src/generated" },
  },
};
