import adapter from "@sveltejs/adapter-static";

const config = {
  compilerOptions: {
    runes: true,
  },
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    alias: {
      $shared: "../../packages/shared/src",
    },
  },
};

export default config;
