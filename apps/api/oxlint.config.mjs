import rootConfig from "../../oxlint.config.mjs";

export default {
  ...rootConfig,
  env: {
    ...rootConfig.env,
    builtin: true,
  },
};
